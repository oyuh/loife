import { BUCKET_ORDER } from './urgency.ts'

/**
 * The Today page as a list of movable sections.
 *
 * The panels come first, then one section per urgency bucket. Bucket keys are
 * reused verbatim so a section id and a bucket name are the same string.
 *
 * Adding an id here is safe for anyone with a saved order: `reconcile` puts a
 * new section back where it would have been rather than on the end.
 */
export const SECTION_ORDER = [
  'calendar',
  'timer',
  'plan',
  ...BUCKET_ORDER,
] as const

export type SectionId = (typeof SECTION_ORDER)[number]

const KEY = 'loife:today-order'

/**
 * A stored order, made safe to render.
 *
 * The stored list can disagree with the code in both directions: a build that
 * adds a section leaves it missing from every saved order, and a build that
 * removes one leaves a dead id behind. Dropping the unknown ids and appending
 * the missing ones in their default position means neither case loses a
 * section or renders a hole.
 */
export function reconcile(stored: readonly string[]): SectionId[] {
  const known = new Set<string>(SECTION_ORDER)
  // Deduped, because a repeated id would render that section twice and
  // collide on its React key.
  const kept = [...new Set(stored)].filter((id): id is SectionId =>
    known.has(id),
  )
  const seen = new Set(kept)
  const added = SECTION_ORDER.filter((id) => !seen.has(id))

  if (added.length === 0) return kept

  // A new section goes back where it would have been rather than onto the end,
  // so an arrangement made before it existed still reads the way it was left.
  const out = [...kept]
  for (const id of added) {
    const before = new Set<string>(
      SECTION_ORDER.slice(0, SECTION_ORDER.indexOf(id)),
    )
    // After the last section it used to follow, not before the first section
    // it did not: the sections it follows can be scattered through a custom
    // order, and only the last of them fixes where this one belongs.
    let index = 0
    out.forEach((existing, at) => {
      if (before.has(existing)) index = at + 1
    })
    out.splice(index, 0, id)
  }
  return out
}

/** Moves one id to another's position, the way a drop reads. */
export function reorder(
  order: readonly SectionId[],
  from: SectionId,
  to: SectionId,
): SectionId[] {
  const out = [...order]
  const at = out.indexOf(from)
  const onto = out.indexOf(to)
  if (at === -1 || onto === -1 || at === onto) return out
  out.splice(at, 1)
  out.splice(onto, 0, from)
  return out
}

export function readOrder(): SectionId[] {
  try {
    const raw = localStorage.getItem(KEY)
    return reconcile(raw ? JSON.parse(raw) : [])
  } catch {
    // Private mode, a cleared store, or something that is no longer JSON.
    return [...SECTION_ORDER]
  }
}

export function writeOrder(order: readonly SectionId[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(order))
  } catch {
    // Not worth interrupting a drag over.
  }
}
