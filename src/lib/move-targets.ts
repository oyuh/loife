/**
 * Where a row can be moved to.
 *
 * Named days rather than free dragging, because the Today list is sorted by a
 * computed score. Dropping a row between two others would have nowhere to
 * store that position, whereas a new due date is real and survives a reload.
 */
export const MOVE_TARGETS = [
  { label: 'Today', days: 0, weekend: false },
  { label: 'Tomorrow', days: 1, weekend: false },
  { label: 'This weekend', days: null, weekend: true },
  { label: 'Next week', days: 7, weekend: false },
  { label: 'No date', days: null, weekend: false },
] as const

export type MoveTarget = (typeof MOVE_TARGETS)[number]

/**
 * The due date a target means, built from parts so it lands on the local day
 * rather than a UTC one.
 */
export function moveTargetDate(
  target: MoveTarget,
  now: Date = new Date(),
): Date | null {
  if (target.days === null && !target.weekend) return null

  const result = new Date(now)

  if (target.weekend) {
    // The coming Saturday. Asked on a Saturday it means the next one, since
    // moving something to today is what the Today target is for.
    const daysToSaturday = (6 - result.getDay() + 7) % 7 || 7
    result.setDate(result.getDate() + daysToSaturday)
  } else {
    result.setDate(result.getDate() + (target.days ?? 0))
  }

  result.setHours(23, 59, 0, 0)
  return result
}
