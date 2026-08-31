import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db'
import { courses, items } from '#/db/schema'
import { requireUser } from '#/lib/session.server'
import { syncItem } from './calendar'

// Nothing here may export a plain function that touches the session. The
// bundler strips a createServerFn handler body from the client build, but a
// live export keeps its imports alive and drags server-only code across.

export interface ItemRow {
  id: number
  name: string
  type: 'assignment' | 'exam' | 'task' | 'reading'
  dueAt: Date | null
  allDay: boolean
  priority: 'low' | 'normal' | 'high'
  status: 'todo' | 'doing' | 'done'
  location: string | null
  notes: string | null
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
        courseId: courses.id,
        courseName: courses.name,
        courseCode: courses.code,
        courseColor: courses.color,
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
    await db
      .update(items)
      .set({ status: data.status })
      .where(eq(items.id, data.id))
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
  priority: z.enum(['low', 'normal', 'high']),
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
