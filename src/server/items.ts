import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { courses, items } from '#/db/schema'
import { requireUser } from '#/lib/session.server'

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
