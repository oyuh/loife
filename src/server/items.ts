import { createServerFn } from '@tanstack/react-start'
import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db'
import { attachments, courses, itemEvents, items } from '#/db/schema'
import { requireUser } from '#/lib/session.server'
import { removeItemEvent, syncItem } from './calendar.server'

// Nothing here may export a plain function that touches the session. The
// bundler strips a createServerFn handler body from the client build, but a
// live export keeps its imports alive and drags server-only code across.

export interface ItemRow {
  id: number
  name: string
  type: 'assignment' | 'exam' | 'task' | 'reading'
  dueAt: Date | null
  allDay: boolean
  priority: number
  status: 'todo' | 'doing' | 'done'
  location: string | null
  notes: string | null
  completedAt: Date | null
  attachmentCount: number
  course: {
    id: number
    name: string
    code: string | null
    color: string | null
  } | null
}

/**
 * Every item in one query, joined to its course. Bucketing and filtering run in
 * JavaScript afterwards, because one person's school year is a few hundred rows
 * and a second round trip costs more than scanning them.
 */
export const listItems = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ItemRow[]> => {
    await requireUser()

    const rows = await db
      .select({
        id: items.id,
        name: items.name,
        type: items.type,
        dueAt: items.dueAt,
        allDay: items.allDay,
        priority: items.priority,
        status: items.status,
        location: items.location,
        notes: items.notes,
        completedAt: items.completedAt,
        courseId: courses.id,
        courseName: courses.name,
        courseCode: courses.code,
        courseColor: courses.color,
        // A correlated count rather than a join, so the row is not multiplied
        // by its attachments and then collapsed again.
        attachmentCount: sql<number>`(
          select count(*)::int from ${attachments}
          where ${attachments.itemId} = ${items.id}
        )`,
      })
      .from(items)
      .leftJoin(courses, eq(items.courseId, courses.id))

    return rows.map(
      ({ courseId, courseName, courseCode, courseColor, ...item }) => ({
        ...item,
        course:
          courseId && courseName
            ? {
                id: courseId,
                name: courseName,
                code: courseCode,
                color: courseColor,
              }
            : null,
      }),
    )
  },
)

// A server function is an HTTP endpoint, so its input is parsed rather than
// trusted, even though this app has one user.
const statusInput = z.object({
  id: z.number().int().positive(),
  status: z.enum(['todo', 'doing', 'done']),
})

export const setItemStatus = createServerFn({ method: 'POST' })
  .validator(statusInput)
  .handler(async ({ data }) => {
    await requireUser()
    const done = data.status === 'done'

    await db
      .update(items)
      .set({
        status: data.status,
        // Cleared on reopening, so the grace period restarts rather than
        // measuring from a completion that was undone.
        completedAt: done ? new Date() : null,
      })
      .where(eq(items.id, data.id))

    await db.insert(itemEvents).values({
      itemId: data.id,
      kind: done ? 'completed' : 'reopened',
    })
  })

const emptyToNull = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const createInput = z.object({
  name: z.string().trim().min(1, 'Give it a name').max(200),
  courseId: z.number().int().positive().nullable(),
  type: z.enum(['assignment', 'exam', 'task', 'reading']),
  dueAt: z.coerce.date().nullable(),
  allDay: z.boolean(),
  priority: z.number().int().min(1).max(5),
  location: z.string().max(200).nullable().transform(emptyToNull),
  notes: z.string().max(2000).nullable().transform(emptyToNull),
})

export const createItem = createServerFn({ method: 'POST' })
  .validator(createInput)
  .handler(async ({ data }) => {
    await requireUser()
    const [row] = await db
      .insert(items)
      .values(data)
      .returning({ id: items.id })
    await db.insert(itemEvents).values({ itemId: row.id, kind: 'created' })
    // Deliberately not awaited. The calendar is a rendering of the database,
    // so a slow Google call must never hold up the response.
    void syncItem(row.id)
    return row
  })

const dueInput = z.object({
  id: z.number().int().positive(),
  dueAt: z.coerce.date().nullable(),
  allDay: z.boolean(),
})

/** Backs dragging a row onto another group in the Today list. */
export const setItemDue = createServerFn({ method: 'POST' })
  .validator(dueInput)
  .handler(async ({ data }) => {
    await requireUser()
    await db
      .update(items)
      .set({ dueAt: data.dueAt, allDay: data.allDay })
      .where(eq(items.id, data.id))

    await db.insert(itemEvents).values({
      itemId: data.id,
      kind: 'moved',
      detail: data.dueAt
        ? `moved to ${data.dueAt.toDateString()}`
        : 'due date cleared',
    })

    void syncItem(data.id)
  })

/**
 * Bulk insert from a syllabus paste. Capped at 200, which is well past a
 * semester and keeps one bad paste from writing thousands of rows.
 */
export const createItems = createServerFn({ method: 'POST' })
  .validator(z.object({ items: z.array(createInput).min(1).max(200) }))
  .handler(async ({ data }) => {
    await requireUser()

    const rows = await db
      .insert(items)
      .values(data.items)
      .returning({ id: items.id })

    // Serial rather than all at once, so a fifty item paste does not fire
    // fifty simultaneous Google requests. Still not awaited, so the response
    // does not wait on any of it.
    void (async () => {
      for (const row of rows) await syncItem(row.id)
    })()

    return { count: rows.length }
  })

export const updateItem = createServerFn({ method: 'POST' })
  .validator(createInput.extend({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await requireUser()
    const { id, ...fields } = data
    await db.update(items).set(fields).where(eq(items.id, id))
    void syncItem(id)
    return { id }
  })

export const deleteItem = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await requireUser()
    // Attachments cascade with the row. The calendar event has to be taken off
    // by hand, since Google knows nothing about the foreign key.
    const [row] = await db
      .delete(items)
      .where(eq(items.id, data.id))
      .returning({ googleEventId: items.googleEventId })
    if (row?.googleEventId) void removeItemEvent(row.googleEventId)
  })

/** Backs the priority control in the detail sheet, without a full form. */
export const updateItemPriority = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.number().int().positive(),
      priority: z.number().int().min(1).max(5),
    }),
  )
  .handler(async ({ data }) => {
    await requireUser()
    await db
      .update(items)
      .set({ priority: data.priority })
      .where(eq(items.id, data.id))
    void syncItem(data.id)
  })

/** What happened to one item, newest first. */
export const listItemEvents = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await requireUser()
    return db
      .select()
      .from(itemEvents)
      .where(eq(itemEvents.itemId, data.id))
      .orderBy(desc(itemEvents.at))
      .limit(50)
  })

/** Recent activity across everything, for the Today footer. */
export const listRecentActivity = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireUser()
    return db
      .select({
        id: itemEvents.id,
        kind: itemEvents.kind,
        detail: itemEvents.detail,
        at: itemEvents.at,
        name: items.name,
      })
      .from(itemEvents)
      .innerJoin(items, eq(itemEvents.itemId, items.id))
      .orderBy(desc(itemEvents.at))
      .limit(30)
  },
)
