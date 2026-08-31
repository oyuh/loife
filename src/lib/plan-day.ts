/**
 * Suggests when to do things today.
 *
 * Takes the hours you are willing to work, subtracts what is already on the
 * calendar, and fills what is left with the most urgent work that fits. Pure
 * and dependency free, so scripts/check-plan.ts can exercise it.
 *
 * These are suggestions. Nothing here writes to the calendar or moves a due
 * date, because a plan that quietly rearranges your commitments is worse than
 * no plan.
 */

import type { BusyPeriod } from './busy'

export type Busy = BusyPeriod

export interface Plannable {
  id: number
  name: string
  /** Minutes. Anything without one cannot be scheduled. */
  estimatedMinutes: number | null
  /** Total preparation needed before the due date, spread over the days left. */
  studyMinutes?: number | null
  /** Minutes of that already done, summed from finished sessions. */
  studiedMinutes?: number
  /** 1 is most urgent through 5 is least. */
  priority: number
  dueAt: Date | null
  status: 'todo' | 'doing' | 'done'
}

export interface Window {
  start: Date
  end: Date
}

export interface Block {
  start: Date
  end: Date
  item: Plannable
  /** Preparing for it, as opposed to doing it. */
  kind: 'work' | 'study'
}

/** Nobody revises for something a month out, so study starts inside this. */
export const STUDY_LEAD_DAYS = 14

/** A study block shorter than this is not worth sitting down for. */
export const MIN_STUDY_BLOCK = 15

/**
 * How much preparation this deserves today.
 *
 * The remaining time is spread evenly across the days left, today included, so
 * falling behind raises tomorrow's share rather than silently vanishing. It
 * stays at zero until the due date is inside the lead window, because
 * scheduling revision a month early is noise rather than help.
 */
export function studyShareToday(item: Plannable, now: Date): number {
  const total = item.studyMinutes ?? 0
  if (total <= 0 || !item.dueAt || item.status === 'done') return 0

  const remaining = total - (item.studiedMinutes ?? 0)
  if (remaining <= 0) return 0

  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const dueDay = new Date(item.dueAt)
  dueDay.setHours(0, 0, 0, 0)

  const daysLeft = Math.round((+dueDay - +midnight) / 86_400_000)
  // Past its due date there is nothing left to prepare for.
  if (daysLeft < 0) return 0
  if (daysLeft > STUDY_LEAD_DAYS) return 0

  // Today counts, so a deadline today gets the whole remainder.
  const share = Math.ceil(remaining / (daysLeft + 1))
  return share < MIN_STUDY_BLOCK ? Math.min(remaining, MIN_STUDY_BLOCK) : share
}

export interface Plan {
  blocks: Block[]
  /** Wanted a slot and did not get one, with the reason. */
  unplaced: { item: Plannable; reason: 'no estimate' | 'no room' }[]
  freeMinutes: number
}

const MINUTE = 60_000

function atTime(day: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number)
  const result = new Date(day)
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0)
  return result
}

/**
 * The parts of the working window that nothing already occupies.
 *
 * Busy periods are merged first, because two overlapping calendar events would
 * otherwise each carve out their own hole and leave a phantom gap between them.
 */
export function freeWindows(
  day: Date,
  dayStart: string,
  dayEnd: string,
  busy: Busy[],
  now?: Date,
): Window[] {
  const windowStart = atTime(day, dayStart)
  const windowEnd = atTime(day, dayEnd)

  // Never suggest a slot that has already passed. Past the end of the window
  // there is nothing left to offer, and falling back to the window start here
  // would cheerfully propose 9am at six in the evening.
  if (now && now >= windowEnd) return []
  const from = now && now > windowStart ? new Date(now) : windowStart
  if (from >= windowEnd) return []

  const merged: Window[] = []
  for (const period of [...busy].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  )) {
    const last = merged.at(-1)
    if (last && period.start <= last.end) {
      if (period.end > last.end) last.end = new Date(period.end)
    } else {
      merged.push({ start: new Date(period.start), end: new Date(period.end) })
    }
  }

  const windows: Window[] = []
  let cursor = from

  for (const period of merged) {
    if (period.end <= cursor) continue
    if (period.start >= windowEnd) break
    if (period.start > cursor) {
      windows.push({
        start: cursor,
        end: new Date(Math.min(+period.start, +windowEnd)),
      })
    }
    if (period.end > cursor) cursor = new Date(period.end)
  }

  if (cursor < windowEnd) windows.push({ start: cursor, end: windowEnd })

  return windows.filter((w) => w.end > w.start)
}

/** Same ordering the Today list uses, so a plan matches what you already see. */
function byUrgency(a: Plannable, b: Plannable, now: Date): number {
  const score = (item: Plannable) => {
    const days = item.dueAt
      ? Math.round((+item.dueAt - +now) / (24 * 60 * MINUTE))
      : 30
    return days + (item.priority - 3) * 2
  }
  return score(a) - score(b) || a.id - b.id
}

export function planDay(input: {
  day: Date
  dayStart: string
  dayEnd: string
  breakMinutes: number
  busy: Busy[]
  items: Plannable[]
  now?: Date
}): Plan {
  const now = input.now ?? new Date()
  const windows = freeWindows(
    input.day,
    input.dayStart,
    input.dayEnd,
    input.busy,
    now,
  )

  const freeMinutes = windows.reduce(
    (total, w) => total + (+w.end - +w.start) / MINUTE,
    0,
  )

  const candidates = input.items
    .filter((item) => item.status !== 'done')
    .sort((a, b) => byUrgency(a, b, now))

  const blocks: Block[] = []
  const unplaced: Plan['unplaced'] = []

  /** What each candidate wants today, and why. */
  const wants: { item: Plannable; minutes: number; kind: 'work' | 'study' }[] =
    []

  for (const item of candidates) {
    const study = studyShareToday(item, now)
    if (study > 0) wants.push({ item, minutes: study, kind: 'study' })

    if (item.estimatedMinutes && item.estimatedMinutes > 0) {
      wants.push({ item, minutes: item.estimatedMinutes, kind: 'work' })
    } else if (study === 0) {
      unplaced.push({ item, reason: 'no estimate' })
    }
  }

  // Each window keeps its own cursor, so a task that does not fit the current
  // gap can still land in a later one rather than blocking everything behind it.
  const cursors = windows.map((w) => new Date(w.start))

  for (const want of wants) {
    const needed = want.minutes * MINUTE
    let placed = false

    for (let i = 0; i < windows.length; i++) {
      const remaining = +windows[i].end - +cursors[i]
      if (remaining < needed) continue

      const start = new Date(cursors[i])
      const end = new Date(+start + needed)
      blocks.push({ start, end, item: want.item, kind: want.kind })

      // A break after each block, unless it would spill past the window.
      const next = +end + input.breakMinutes * MINUTE
      cursors[i] = new Date(Math.min(next, +windows[i].end))
      placed = true
      break
    }

    if (!placed) unplaced.push({ item: want.item, reason: 'no room' })
  }

  blocks.sort((a, b) => +a.start - +b.start)
  return { blocks, unplaced, freeMinutes }
}
