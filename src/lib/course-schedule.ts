/**
 * Which days a course actually meets, expanded from its pattern.
 *
 * `course-event.ts` turns the same pattern into one RRULE for Google, which is
 * the right shape for a calendar server and the wrong one for drawing a week.
 * This walks the pattern out into plain dates so the courses page can ask
 * "does CS 210 meet on the 17th" without reimplementing recurrence rules in a
 * component.
 *
 * Everything is a `2026-09-15` key rather than a Date. A meeting day is a
 * civil date with no zone, and keeping it as a string is what stops it being
 * shifted by whatever the machine thinks local midnight is.
 *
 * Pure and dependency free, so scripts/check-schedule.ts can exercise it.
 */

import type { MeetingCourse } from './course-event.ts'
import {
  dateKeysApart,
  shiftDateKey,
  startOfWeekKey,
  weekdayOfKey,
} from './datetime.ts'

/** Everything needed to place a course on a calendar. */
export type ScheduledCourse = Pick<
  MeetingCourse,
  | 'days'
  | 'startTime'
  | 'endTime'
  | 'termStart'
  | 'termEnd'
  | 'meetingInterval'
  | 'meetingDates'
>

/**
 * The first day on or after `termStart` that the pattern actually lands on.
 *
 * A term beginning on a Sunday for a Monday/Wednesday class starts on the
 * Monday. Getting this wrong offsets an every-other-week course by a full
 * week, which is why `course-event.ts` computes the same anchor for the RRULE.
 */
export function firstMeetingKey(
  termStart: string,
  days: number[],
): string | null {
  for (let offset = 0; offset < 7; offset++) {
    const candidate = shiftDateKey(termStart, offset)
    if (days.includes(weekdayOfKey(candidate))) return candidate
  }
  return null
}

/**
 * Whether the weekly rule puts a meeting on this date.
 *
 * The interval counts whole weeks from the week holding the first meeting,
 * not from the date itself, which is how an RRULE reads it: an every-other-week
 * Monday/Wednesday class meets on both days of the weeks it runs, and on
 * neither day of the weeks it skips.
 */
function weeklyRuleCovers(course: ScheduledCourse, key: string): boolean {
  const { days, termStart, termEnd } = course
  if (!days?.length) return false
  if (!days.includes(weekdayOfKey(key))) return false

  /*
   * Term dates bound the pattern, they do not enable it.
   *
   * Google needs both ends to build an RRULE, so `course-event.ts` insists on
   * them. Drawing a calendar does not: a course recorded as "Mon Wed Fri at
   * ten" is on those days whether or not anyone typed the term in, and
   * refusing to mark it would leave the page blank for the most common
   * half-filled course there is. Each bound is applied only when it is there.
   */
  if (termStart && dateKeysApart(termStart, key) < 0) return false
  if (termEnd && dateKeysApart(key, termEnd) < 0) return false

  const interval = Math.max(1, course.meetingInterval ?? 1)
  if (interval === 1) return true

  // An alternating course needs a first meeting to count weeks from, and the
  // term start is the only thing that supplies one. Without it there is no
  // parity to compute, so it falls back to weekly rather than to nothing.
  if (!termStart) return true

  const anchor = firstMeetingKey(termStart, days)
  if (!anchor) return false

  const weeks = dateKeysApart(startOfWeekKey(anchor), startOfWeekKey(key)) / 7
  return weeks >= 0 && Number.isInteger(weeks) && weeks % interval === 0
}

/**
 * Does this course meet on this date, by either route?
 *
 * One-off dates are additions on top of the weekly rule, so a lab scheduled on
 * a Saturday counts even though Saturday is in no weekly pattern, and it counts
 * whether or not the term dates are filled in at all.
 */
export function meetsOnKey(course: ScheduledCourse, key: string): boolean {
  if (course.meetingDates?.includes(key)) return true
  return weeklyRuleCovers(course, key)
}

/**
 * Every date this course meets between two keys, inclusive, in order.
 *
 * Walks day by day rather than jumping week to week. A term is a few hundred
 * iterations of an integer comparison, and the straightforward version has no
 * off-by-one week to get wrong.
 */
export function meetingKeysInRange(
  course: ScheduledCourse,
  fromKey: string,
  toKey: string,
): string[] {
  const span = dateKeysApart(fromKey, toKey)
  if (span < 0) return []

  const keys: string[] = []
  for (let offset = 0; offset <= span; offset++) {
    const key = shiftDateKey(fromKey, offset)
    if (meetsOnKey(course, key)) keys.push(key)
  }
  return keys
}

/** How far ahead `nextMeetingKey` is willing to look before giving up. */
const SEARCH_DAYS = 366

/**
 * The next day this course meets, on or after `fromKey`, or null.
 *
 * Bounded rather than open ended, because a course whose term has ended meets
 * on no day ever again and the loop has to stop somewhere.
 */
export function nextMeetingKey(
  course: ScheduledCourse,
  fromKey: string,
): string | null {
  for (let offset = 0; offset <= SEARCH_DAYS; offset++) {
    const key = shiftDateKey(fromKey, offset)
    if (meetsOnKey(course, key)) return key
  }
  return null
}

/** The seven keys of the week holding `key`, Sunday first. */
export function weekKeys(key: string): string[] {
  const start = startOfWeekKey(key)
  return Array.from({ length: 7 }, (_, index) => shiftDateKey(start, index))
}

/**
 * Every key in the month holding `key`, padded out to whole weeks so a grid
 * has no ragged first and last row.
 */
export function monthGridKeys(key: string): string[] {
  const [year, month] = key.split('-').map(Number)
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const last = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  const start = startOfWeekKey(first)
  // The Saturday on or after the last, so the final week is complete.
  const end = shiftDateKey(startOfWeekKey(last), 6)

  const span = dateKeysApart(start, end)
  return Array.from({ length: span + 1 }, (_, index) =>
    shiftDateKey(start, index),
  )
}

/** Whether the course has enough filled in to appear on a calendar at all. */
export function hasSchedule(course: ScheduledCourse): boolean {
  return Boolean(course.days?.length || course.meetingDates?.length)
}
