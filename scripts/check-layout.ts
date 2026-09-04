/**
 * Checks the Today page's saved section order.
 *
 * A stored order outlives the build that wrote it, so the interesting cases
 * are all disagreements between what is in localStorage and what the code
 * knows about.
 *
 *   pnpm check:layout
 */
import assert from 'node:assert/strict'
import {
  readCollapsed,
  reconcile,
  reorder,
  SECTION_ORDER,
  type SectionId,
  writeCollapsed,
} from '../src/lib/today-layout.ts'

const DEFAULT = [...SECTION_ORDER]

assert.deepEqual(reconcile([]), DEFAULT)
assert.deepEqual(reconcile(DEFAULT), DEFAULT)
console.log('ok  nothing stored, and everything stored, both give the default')

// A saved arrangement is what actually has to survive.
const custom: SectionId[] = [
  'plan',
  'overdue',
  'calendar',
  'timer',
  'today',
  'tomorrow',
  'week',
  'later',
  'someday',
]
assert.deepEqual(reconcile(custom), custom)
console.log('ok  a saved arrangement round trips untouched')

// A build that drops a section leaves its id behind in every saved order.
assert.deepEqual(reconcile([...custom, 'a-section-we-deleted']), custom)
console.log('ok  an id the code no longer knows is dropped')

// A build that adds one leaves it missing from every saved order. It has to
// come back, and next to the sections it shipped next to.
const withoutPlan = custom.filter((id) => id !== 'plan')
const healed = reconcile(withoutPlan)
assert.equal(healed.length, DEFAULT.length)
assert.deepEqual([...healed].sort(), [...DEFAULT].sort())
assert.equal(
  healed.indexOf('plan'),
  healed.indexOf('timer') + 1,
  'plan belongs after timer, which is where the default order puts it',
)
console.log('ok  a section missing from a saved order comes back in place')

// Whatever gets added around them, the sections that were stored keep the
// order they were stored in — here, deliberately the reverse of the default.
const sparse = reconcile(['someday', 'today'])
assert.ok(
  sparse.indexOf('someday') < sparse.indexOf('today'),
  'a stored pair was reordered by the sections filled in around it',
)
console.log('ok  additions do not disturb what was already arranged')

// The order every existing install has stored, written before the calendar
// section existed. It has to come back, at the top, without disturbing the
// arrangement around it.
const beforeCalendar = ['timer', 'plan', 'overdue', 'today', 'tomorrow', 'week', 'later', 'someday']
const withCalendar = reconcile(beforeCalendar)
assert.deepEqual(withCalendar, ['calendar', ...beforeCalendar])
console.log('ok  an order saved before the calendar existed gains it at the top')

// And if it was arranged, the arrangement survives.
const arrangedBefore = ['someday', 'plan', 'timer', 'overdue', 'today', 'tomorrow', 'week', 'later']
const arrangedAfter = reconcile(arrangedBefore)
assert.equal(arrangedAfter.length, DEFAULT.length)
assert.deepEqual([...arrangedAfter].sort(), [...DEFAULT].sort())
assert.deepEqual(
  arrangedAfter.filter((id) => id !== 'calendar'),
  arrangedBefore,
  'adding the calendar reshuffled the sections around it',
)
console.log('ok  a rearranged order keeps its arrangement when a section lands')

for (const junk of [['timer', 'timer'], ['nope'], []]) {
  const out = reconcile(junk)
  assert.equal(
    new Set(out).size,
    out.length,
    `reconcile(${JSON.stringify(junk)}) rendered a section twice`,
  )
}
console.log('ok  no input produces a duplicated section')

/*
 * Dropping onto a section takes its slot and pushes it up, so dragging the
 * timer down onto Today leaves the timer where Today was. Everything between
 * them shifts up by one.
 */
assert.deepEqual(reorder(DEFAULT, 'timer', 'today'), [
  'calendar',
  'plan',
  'overdue',
  'today',
  'timer',
  'tomorrow',
  'week',
  'later',
  'someday',
])
// And moving back up puts it exactly where it started.
assert.deepEqual(
  reorder(reorder(DEFAULT, 'timer', 'today'), 'timer', 'plan'),
  DEFAULT,
)
console.log('ok  a move and the move back cancel out')

assert.deepEqual(reorder(DEFAULT, 'timer', 'timer'), DEFAULT)
assert.deepEqual(reorder(DEFAULT, 'timer', 'nope' as SectionId), DEFAULT)
console.log('ok  a no-op drop changes nothing')

for (const [from, to] of [
  ['timer', 'someday'],
  ['someday', 'timer'],
  ['week', 'overdue'],
] as const) {
  const out = reorder(DEFAULT, from, to)
  assert.equal(out.length, DEFAULT.length)
  assert.deepEqual([...out].sort(), [...DEFAULT].sort(), `${from} -> ${to}`)
}
console.log('ok  a move never loses or duplicates a section')

// A stored set of collapsed sections, which expires rather than persisting.
const store = new Map<string, string>()
// @ts-expect-error a two-method stand-in is all these two functions touch.
globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
}

const FALLBACK = ['week', 'later', 'someday']

assert.deepEqual(readCollapsed(FALLBACK), FALLBACK)
console.log('ok  nothing stored means the default sections are folded')

writeCollapsed(['today'])
assert.deepEqual(readCollapsed(FALLBACK), ['today'])
console.log('ok  a saved set comes back, including one that folds less')

writeCollapsed([])
assert.deepEqual(readCollapsed(FALLBACK), [])
console.log('ok  everything open is a state, not an empty store')

// Five hours and a minute ago, which is the far side of the window.
store.set(
  'loife:today-collapsed',
  JSON.stringify({ at: Date.now() - (5 * 60 + 1) * 60_000, ids: ['today'] }),
)
assert.deepEqual(readCollapsed(FALLBACK), FALLBACK)

store.set(
  'loife:today-collapsed',
  JSON.stringify({ at: Date.now() - 4 * 60 * 60_000, ids: ['today'] }),
)
assert.deepEqual(readCollapsed(FALLBACK), ['today'])
console.log('ok  a set older than five hours is forgotten, a newer one is not')

store.set('loife:today-collapsed', 'not json')
assert.deepEqual(readCollapsed(FALLBACK), FALLBACK)
console.log('ok  junk in the store falls back rather than throwing')

console.log('\nlayout checks passed')
