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
  /** 1 is weekly, 2 is every other week, and so on. */
  meetingInterval?: number | null
  /** One-off meetings that follow no weekly pattern. */
  meetingDates?: string[] | null
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

/** RDATE wants UTC basic format, the same shape as UNTIL. */
function toRDate(value: Date): string {
  return `${value.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

export function toCourseEvent(
  course: MeetingCourse,
  timeZone: string,
): (CalendarEventBody & { recurrence: string[] }) | null {
  const { days, startTime, endTime, termStart, termEnd } = course

  // Times are what make a meeting, so without them there is nothing to place.
  if (!startTime || !endTime) return null

  const explicit = (course.meetingDates ?? [])
    .map(parseDateOnly)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime())

  const hasWeekly = Boolean(days?.length && termStart && termEnd)

  // A course with neither a weekly pattern nor explicit dates is still a
  // course, it just has nothing to put on a calendar.
  if (!hasWeekly && explicit.length === 0) return null

  // The anchor is the weekly pattern's first meeting when there is one, so the
  // RRULE expands from a day the class actually meets. Explicit dates are
  // additions on top, which is why they never move it.
  let anchor: Date | null = null
  const recurrence: string[] = []

  if (hasWeekly) {
    const start = parseDateOnly(termStart as string)
    anchor = start ? firstMeetingOn(start, days as number[]) : null
    const until = toUntil(termEnd as string)

    if (anchor && until) {
      const byDay = [...(days as number[])]
        .sort((a, b) => a - b)
        .map((day) => BYDAY[day])
        .join(',')

      const interval = Math.max(1, course.meetingInterval ?? 1)
      const every = interval > 1 ? `INTERVAL=${interval};` : ''

      recurrence.push(`RRULE:FREQ=WEEKLY;${every}BYDAY=${byDay};UNTIL=${until}`)
    } else {
      anchor = null
    }
  }

  if (!anchor) {
    anchor = explicit[0] ?? null
    if (!anchor) return null
  }

  // The anchor is already the event start, so it must not repeat as an RDATE.
  const extras = explicit.filter(
    (date) => date.getTime() !== (anchor as Date).getTime(),
  )

  if (extras.length > 0) {
    recurrence.push(
      `RDATE:${extras.map((date) => toRDate(applyTime(date, startTime))).join(',')}`,
    )
  }

  if (recurrence.length === 0) {
    // A single explicit meeting and nothing else, which is a plain event.
    return {
      summary: course.code ? `${course.code} ${course.name}` : course.name,
      location: course.location ?? undefined,
      start: { dateTime: applyTime(anchor, startTime).toISOString(), timeZone },
      end: { dateTime: applyTime(anchor, endTime).toISOString(), timeZone },
      recurrence: [],
    }
  }

  return {
    summary: course.code ? `${course.code} ${course.name}` : course.name,
    location: course.location ?? undefined,
    start: { dateTime: applyTime(anchor, startTime).toISOString(), timeZone },
    end: { dateTime: applyTime(anchor, endTime).toISOString(), timeZone },
    recurrence,
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
