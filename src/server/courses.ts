import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db'
import { courses } from '#/db/schema'
import { requireUser } from '#/lib/session.server'
import { syncCourse } from './calendar.server'

export interface CourseRow {
  id: number
  name: string
  code: string | null
  color: string | null
  term: string | null
  termStart: string | null
  termEnd: string | null
  days: number[] | null
  startTime: string | null
  endTime: string | null
  meetingInterval: number
  meetingDates: string[] | null
  location: string | null
  instructor: string | null
  instructorEmail: string | null
  notes: string | null
  active: boolean
}

export const listCourses = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CourseRow[]> => {
    await requireUser()
    return db
      .select({
        id: courses.id,
        name: courses.name,
        code: courses.code,
        color: courses.color,
        term: courses.term,
        termStart: courses.termStart,
        termEnd: courses.termEnd,
        days: courses.days,
        startTime: courses.startTime,
        endTime: courses.endTime,
        meetingInterval: courses.meetingInterval,
        meetingDates: courses.meetingDates,
        location: courses.location,
        instructor: courses.instructor,
        instructorEmail: courses.instructorEmail,
        notes: courses.notes,
        active: courses.active,
      })
      .from(courses)
      .orderBy(asc(courses.active), asc(courses.code), asc(courses.name))
  },
)

const emptyToNull = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a calendar date')
  .nullable()

const timeOnly = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use a 24 hour time')
  .nullable()

const courseInput = z.object({
  name: z.string().trim().min(1, 'Give it a name').max(200),
  code: z.string().max(40).nullable().transform(emptyToNull),
  color: z.string().max(40).nullable().transform(emptyToNull),
  term: z.string().max(80).nullable().transform(emptyToNull),
  termStart: dateOnly,
  termEnd: dateOnly,
  // 0 is Sunday through 6 is Saturday.
  days: z.array(z.number().int().min(0).max(6)).max(7),
  startTime: timeOnly,
  endTime: timeOnly,
  meetingInterval: z.number().int().min(1).max(8),
  meetingDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60),
  location: z.string().max(200).nullable().transform(emptyToNull),
  instructor: z.string().max(200).nullable().transform(emptyToNull),
  // Blank is allowed and means "not recorded". Anything else has to look like
  // an address, since the page turns it into a mailto link.
  instructorEmail: z
    .string()
    .max(320)
    .nullable()
    .transform(emptyToNull)
    .refine(
      (value) => value === null || z.email().safeParse(value).success,
      'That does not look like an email address',
    ),
  notes: z.string().max(2000).nullable().transform(emptyToNull),
  active: z.boolean(),
})

export const createCourse = createServerFn({ method: 'POST' })
  .validator(courseInput)
  .handler(async ({ data }) => {
    await requireUser()
    const [row] = await db
      .insert(courses)
      .values(data)
      .returning({ id: courses.id })
    // Not awaited, so a slow Google call never holds up the response.
    void syncCourse(row.id)
    return row
  })

export const updateCourse = createServerFn({ method: 'POST' })
  .validator(courseInput.extend({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await requireUser()
    const { id, ...fields } = data
    await db.update(courses).set(fields).where(eq(courses.id, id))
    void syncCourse(id)
    return { id }
  })
