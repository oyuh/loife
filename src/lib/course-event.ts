import type { CalendarEventBody } from './calendar-event'

/**
 * Turns a course's meeting pattern into one recurring Google Calendar event.
 *
 * One event per course rather than one per week keeps a term at a handful of
 * API calls instead of forty. Pure and dependency free so it can be tested.
 */

export interface MeetingCourse {
  name: string
  code: string | null
  location: string | null
  /** 0 is Sunday through 6 is Saturday, matching Date.getDay(). */
  days: number[] | null
  /** Postgres `time` arrives as `10:00:00`, a form field gives `10:00`. */
  startTime: string | null
  endTime: string | null
  /** Postgres `date` arrives as `2026-08-24`. */
  termStart: string | null
  termEnd: string | null
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

const pad = (n: number) => String(n).padStart(2, '0')

function parseDateOnly(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  // Built from parts, since `new Date('2026-08-24')` is UTC midnight and lands
  // on the day before west of Greenwich.
  return new Date(year, month - 1, day)
}

function applyTime(base: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const result = new Date(base)
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0)
  return result
}

/**
 * The first day on or after `termStart` that the course actually meets. A term
 * starting on a Sunday for a Monday/Wednesday class must begin on the Monday,
 * or the whole series is offset by a week.
 */
export function firstMeetingOn(termStart: Date, days: number[]): Date | null {
  for (let offset = 0; offset < 7; offset++) {
    const candidate = new Date(termStart)
    candidate.setDate(candidate.getDate() + offset)
    if (days.includes(candidate.getDay())) return candidate
  }
  return null
}

/** RRULE UNTIL is UTC in basic format, so `2026-12-15` becomes `20261216T055959Z`. */
export function toUntil(termEnd: string): string | null {
  const parsed = parseDateOnly(termEnd)
  if (!parsed) return null

  const endOfDay = applyTime(parsed, '23:59')
  endOfDay.setSeconds(59)
  return `${endOfDay.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

export function toCourseEvent(
  course: MeetingCourse,
  timeZone: string,
): (CalendarEventBody & { recurrence: string[] }) | null {
  const { days, startTime, endTime, termStart, termEnd } = course

  // A course without a meeting pattern is still a course, it just has nothing
  // to put on a calendar.
  if (!days?.length || !startTime || !endTime || !termStart || !termEnd) {
    return null
  }

  const start = parseDateOnly(termStart)
  if (!start) return null

  const first = firstMeetingOn(start, days)
  if (!first) return null

  const until = toUntil(termEnd)
  if (!until) return null

  const byDay = [...days]
    .sort((a, b) => a - b)
    .map((day) => BYDAY[day])
    .join(',')

  return {
    summary: course.code ? `${course.code} ${course.name}` : course.name,
    location: course.location ?? undefined,
    start: {
      dateTime: applyTime(first, startTime).toISOString(),
      timeZone,
    },
    end: {
      dateTime: applyTime(first, endTime).toISOString(),
      timeZone,
    },
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${until}`],
  }
}

/** Mon through Sun for the toggle chips, ordered the way a timetable reads. */
export const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
] as const

/** `10:00:00` from Postgres renders as `10:00` in a time input. */
export function trimSeconds(time: string | null): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  return `${pad(Number(hours))}:${minutes ?? '00'}`
}
