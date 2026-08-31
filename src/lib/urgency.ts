/**
 * Bucketing and ordering for the Today view.
 *
 * Deliberately free of database and React imports so it stays a pure function
 * of its inputs, which is what makes scripts/check-urgency.ts able to run it.
 *
 * All day boundaries come from the host timezone, so the server sets TZ.
 * Without it a container on UTC calls an 11pm assignment "tomorrow".
 */

export type Bucket =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'later'
  | 'someday'

export interface Urgent {
  dueAt: Date | null
  allDay: boolean
  /** 1 is most urgent through 5 is least. 3 is the default. */
  priority: number
  status: 'todo' | 'doing' | 'done'
  name: string
  /** When it was ticked, which is what the grace period counts from. */
  completedAt?: Date | null
}

/**
 * How long a ticked item stays on screen before it disappears.
 *
 * Ticking is one tap and easy to do by accident, so nothing vanishes the
 * instant it is marked. Important work lingers longest, because mis-ticking a
 * P1 is the mistake worth catching.
 */
const GRACE_MINUTES_BY_PRIORITY: Record<number, number> = {
  1: 120,
  2: 60,
  3: 30,
  4: 15,
  5: 10,
}

export const DEFAULT_GRACE_MINUTES = 30

export function completionGraceMinutes(
  priority: number,
  override: number | null | undefined,
): number {
  // A number set in preferences wins outright, including zero, which means
  // hide it at once.
  if (typeof override === 'number') return Math.max(0, override)
  return GRACE_MINUTES_BY_PRIORITY[priority] ?? DEFAULT_GRACE_MINUTES
}

/**
 * Whether a finished item has been finished long enough to drop off the list.
 *
 * An item ticked before this existed has no completedAt, so it falls back to
 * the old rule of staying only on the day it was due.
 */
export function isCompletionExpired(
  item: Urgent,
  now: Date = new Date(),
  override?: number | null,
): boolean {
  if (item.status !== 'done') return false

  if (!item.completedAt) {
    return bucketFor(item, now) !== 'today'
  }

  const minutes = completionGraceMinutes(item.priority, override)
  return now.getTime() - item.completedAt.getTime() > minutes * 60_000
}

export const PRIORITY_LEVELS = [1, 2, 3, 4, 5] as const
export const DEFAULT_PRIORITY = 3

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Drop everything',
  2: 'High',
  3: 'Normal',
  4: 'Low',
  5: 'Whenever',
}

export const BUCKET_ORDER: readonly Bucket[] = [
  'overdue',
  'today',
  'tomorrow',
  'week',
  'later',
  'someday',
]

export const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'Next 7 days',
  later: 'Later',
  someday: 'No date',
}

const MS_PER_DAY = 86_400_000

function startOfDay(value: Date): Date {
  const copy = new Date(value)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/** Whole calendar days from `from` to `to`, ignoring clock time. */
export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY,
  )
}

export function bucketFor(item: Urgent, now: Date): Bucket {
  if (!item.dueAt) return 'someday'

  const days = calendarDaysBetween(now, item.dueAt)
  if (days < 0) return 'overdue'

  if (days === 0) {
    // An all-day item is not late until the day is over. A timed one is late
    // the moment its time passes, which is the difference that matters at 3pm
    // on a day holding both.
    if (!item.allDay && item.dueAt.getTime() < now.getTime()) return 'overdue'
    return 'today'
  }

  if (days === 1) return 'tomorrow'
  if (days <= 7) return 'week'
  return 'later'
}

/** Each step of priority is worth this many days of urgency. */
const DAYS_PER_PRIORITY_STEP = 2

/** An item with no due date sits this far out before priority moves it. */
const UNDATED_HORIZON_DAYS = 30

/**
 * One number combining when a thing is due with how much it matters, lower
 * being more urgent.
 *
 * Three named levels could only ever break ties inside a day. Blending them
 * means a 1 due Friday can outrank a 5 due tomorrow, which is the behaviour
 * worth having, and a step of two days is what sets that exchange rate.
 */
export function urgencyScore(item: Urgent, now: Date = new Date()): number {
  const days = item.dueAt
    ? calendarDaysBetween(now, item.dueAt)
    : UNDATED_HORIZON_DAYS

  const priority = Number.isFinite(item.priority)
    ? item.priority
    : DEFAULT_PRIORITY

  return days + (priority - DEFAULT_PRIORITY) * DAYS_PER_PRIORITY_STEP
}

/**
 * Score first, then the clock, then the name so the order never wobbles
 * between renders.
 */
export function compareUrgency(
  a: Urgent,
  b: Urgent,
  now: Date = new Date(),
): number {
  const byScore = urgencyScore(a, now) - urgencyScore(b, now)
  if (byScore !== 0) return byScore

  const aTime = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY
  const bTime = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY
  if (aTime !== bTime) return aTime - bTime

  return a.name.localeCompare(b.name)
}

export interface BucketGroup<T extends Urgent> {
  bucket: Bucket
  label: string
  items: T[]
}

/**
 * Groups into display order and drops empty buckets. Finished work stays
 * visible only on the day it was due, so today's list still shows what you got
 * through without yesterday's ticks piling up.
 */
export function groupByUrgency<T extends Urgent>(
  items: T[],
  now: Date = new Date(),
  hideCompletedAfterMinutes?: number | null,
): BucketGroup<T>[] {
  const groups = new Map<Bucket, T[]>()

  for (const item of items) {
    const bucket = bucketFor(item, now)
    // A ticked item stays put until its grace period runs out, wherever it
    // sits, so an accidental tap on an overdue row is recoverable.
    if (isCompletionExpired(item, now, hideCompletedAfterMinutes)) continue
    const existing = groups.get(bucket)
    if (existing) existing.push(item)
    else groups.set(bucket, [item])
  }

  return BUCKET_ORDER.filter((bucket) => groups.has(bucket)).map((bucket) => ({
    bucket,
    label: BUCKET_LABELS[bucket],
    items: (groups.get(bucket) as T[]).sort((a, b) =>
      compareUrgency(a, b, now),
    ),
  }))
}

/** Count of things that are late, which the Today header leads with. */
export function overdueCount(items: Urgent[], now: Date = new Date()): number {
  return items.filter(
    (item) => item.status !== 'done' && bucketFor(item, now) === 'overdue',
  ).length
}

/** Dot colour beside each group heading in the kibo list. */
export const BUCKET_COLORS: Record<Bucket, string> = {
  overdue: 'var(--destructive)',
  today: 'var(--primary)',
  tomorrow: 'var(--muted-foreground)',
  week: 'var(--muted-foreground)',
  later: 'var(--muted-foreground)',
  someday: 'var(--border)',
}

/** Days ahead that each bucket reschedules to when something is dropped on it. */
const DROP_OFFSET_DAYS: Partial<Record<Bucket, number>> = {
  today: 0,
  tomorrow: 1,
  week: 7,
  later: 30,
}

/**
 * Where a dropped item should land. Dragging between groups reschedules, so
 * each bucket needs one unambiguous date rather than a range.
 *
 * Returns null when the bucket is not a valid target, which is only `overdue`,
 * since deliberately making something late is not a thing anyone wants to drag
 * to. `someday` returns a null date, meaning the due date is cleared.
 */
export function dueDateForBucket(
  bucket: Bucket,
  now: Date = new Date(),
): { dueAt: Date | null } | null {
  if (bucket === 'overdue') return null
  if (bucket === 'someday') return { dueAt: null }

  const offset = DROP_OFFSET_DAYS[bucket]
  if (offset === undefined) return null

  const target = new Date(now)
  target.setDate(target.getDate() + offset)
  target.setHours(23, 59, 0, 0)
  return { dueAt: target }
}
