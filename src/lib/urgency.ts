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
  priority: 'low' | 'normal' | 'high'
  status: 'todo' | 'doing' | 'done'
  name: string
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

const PRIORITY_RANK: Record<Urgent['priority'], number> = {
  high: 0,
  normal: 1,
  low: 2,
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

/**
 * Priority first, because ranking work is the point of having the field, then
 * the clock, then the name so the order never wobbles between renders.
 */
export function compareUrgency(a: Urgent, b: Urgent): number {
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (byPriority !== 0) return byPriority

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
): BucketGroup<T>[] {
  const groups = new Map<Bucket, T[]>()

  for (const item of items) {
    const bucket = bucketFor(item, now)
    if (item.status === 'done' && bucket !== 'today') continue
    const existing = groups.get(bucket)
    if (existing) existing.push(item)
    else groups.set(bucket, [item])
  }

  return BUCKET_ORDER.filter((bucket) => groups.has(bucket)).map((bucket) => ({
    bucket,
    label: BUCKET_LABELS[bucket],
    items: (groups.get(bucket) as T[]).sort(compareUrgency),
  }))
}

/** Count of things that are late, which the Today header leads with. */
export function overdueCount(items: Urgent[], now: Date = new Date()): number {
  return items.filter(
    (item) => item.status !== 'done' && bucketFor(item, now) === 'overdue',
  ).length
}
