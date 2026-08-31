import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { db } from '#/db'
import { courses } from '#/db/schema'
import { requireUser } from '#/lib/session.server'

export interface CourseOption {
  id: number
  name: string
  code: string | null
  color: string | null
}

export const listCourses = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CourseOption[]> => {
    await requireUser()
    return db
      .select({
        id: courses.id,
        name: courses.name,
        code: courses.code,
        color: courses.color,
      })
      .from(courses)
      .where(eq(courses.active, true))
      .orderBy(asc(courses.code), asc(courses.name))
  },
)
