/**
 * Checks the day planner.
 *
 *   pnpm check:plan
 */
import assert from 'node:assert/strict'
import {
  freeWindows,
  planDay,
  type Busy,
  type Plannable,
} from '../src/lib/plan-day.ts'

const day = new Date('2026-09-15T00:00:00')
const at = (hhmm: string) => new Date(`2026-09-15T${hhmm}:00`)
const minutes = (a: Date, b: Date) => Math.round((+b - +a) / 60_000)

const busy = (from: string, to: string, label = 'class'): Busy => ({
  start: at(from),
  end: at(to),
  label,
})

const task = (over: Partial<Plannable> = {}): Plannable => ({
  id: 1,
  name: 'thing',
  estimatedMinutes: 60,
  priority: 3,
  dueAt: at('23:59'),
  status: 'todo',
  ...over,
})

// An empty day is one window.
assert.deepEqual(
  freeWindows(day, '09:00', '17:00', []).map((w) => [
    w.start.getHours(),
    w.end.getHours(),
  ]),
  [[9, 17]],
)
console.log('ok  a clear day is one window')

// A class in the middle splits it in two.
const split = freeWindows(day, '09:00', '17:00', [busy('12:00', '13:00')])
assert.equal(split.length, 2)
assert.equal(minutes(split[0].start, split[0].end), 180)
assert.equal(minutes(split[1].start, split[1].end), 240)
console.log('ok  a commitment splits the day around it')

// Overlapping events merge. Left unmerged, each would carve its own hole and
// leave a phantom gap between them that nothing could actually use.
const overlapping = freeWindows(day, '09:00', '17:00', [
  busy('10:00', '12:00'),
  busy('11:00', '13:00'),
])
assert.equal(overlapping.length, 2, 'two windows, not three')
assert.equal(minutes(overlapping[0].start, overlapping[0].end), 60)
assert.equal(overlapping[1].start.getHours(), 13)
console.log('ok  overlapping commitments merge into one gap')

// Back to back events leave no gap between them.
const backToBack = freeWindows(day, '09:00', '17:00', [
  busy('10:00', '11:00'),
  busy('11:00', '12:00'),
])
assert.equal(backToBack.length, 2)
assert.equal(backToBack[1].start.getHours(), 12)
console.log('ok  touching commitments leave no phantom gap')

// Nothing is ever suggested in the past.
const afternoon = freeWindows(day, '09:00', '17:00', [], at('14:00'))
assert.equal(afternoon[0].start.getHours(), 14, 'starts from now, not 9am')
assert.equal(freeWindows(day, '09:00', '17:00', [], at('18:00')).length, 0)
console.log('ok  the plan never suggests a time that has passed')

// Urgent work is placed first.
const plan = planDay({
  day,
  dayStart: '09:00',
  dayEnd: '17:00',
  breakMinutes: 10,
  busy: [busy('12:00', '13:00')],
  now: at('09:00'),
  items: [
    task({ id: 1, name: 'later', priority: 5, dueAt: at('23:59') }),
    task({ id: 2, name: 'urgent', priority: 1, dueAt: at('23:59') }),
  ],
})
assert.equal(plan.blocks[0].item.name, 'urgent', 'the P1 goes first')
assert.equal(plan.blocks.length, 2)
console.log('ok  urgent work takes the earliest slot')

// Breaks land between blocks.
const gap = minutes(plan.blocks[0].end, plan.blocks[1].start)
assert.equal(gap, 10, 'ten minutes of breathing room')
console.log('ok  a break sits between consecutive blocks')

// Nothing is scheduled over a commitment.
for (const block of plan.blocks) {
  assert.ok(
    block.end <= at('12:00') || block.start >= at('13:00'),
    `${block.item.name} must not overlap the noon class`,
  )
}
console.log('ok  nothing is scheduled over an existing commitment')

// Without an estimate there is nothing to schedule, and it says so rather
// than guessing a duration.
const noEstimate = planDay({
  day,
  dayStart: '09:00',
  dayEnd: '17:00',
  breakMinutes: 10,
  busy: [],
  now: at('09:00'),
  items: [task({ id: 9, name: 'vague', estimatedMinutes: null })],
})
assert.equal(noEstimate.blocks.length, 0)
assert.equal(noEstimate.unplaced[0].reason, 'no estimate')
console.log('ok  work with no estimate is listed, not invented')

// A task too big for the first gap still takes a later one rather than
// blocking everything behind it.
const spill = planDay({
  day,
  dayStart: '09:00',
  dayEnd: '17:00',
  breakMinutes: 0,
  busy: [busy('10:00', '11:00')],
  now: at('09:00'),
  items: [task({ id: 1, name: 'long', estimatedMinutes: 120, priority: 1 })],
})
assert.equal(spill.blocks.length, 1)
assert.equal(spill.blocks[0].start.getHours(), 11, 'skipped the one hour gap')
console.log('ok  a long task waits for a gap that fits it')

// A day with no room says so.
const packed = planDay({
  day,
  dayStart: '09:00',
  dayEnd: '10:00',
  breakMinutes: 0,
  busy: [],
  now: at('09:00'),
  items: [task({ id: 1, estimatedMinutes: 120 })],
})
assert.equal(packed.unplaced[0].reason, 'no room')
assert.equal(packed.freeMinutes, 60)
console.log('ok  a full day reports what would not fit')

// Finished work is never scheduled.
assert.equal(
  planDay({
    day,
    dayStart: '09:00',
    dayEnd: '17:00',
    breakMinutes: 0,
    busy: [],
    now: at('09:00'),
    items: [task({ status: 'done' })],
  }).blocks.length,
  0,
)
console.log('ok  finished work is never scheduled')

console.log('\nplanner checks passed')
