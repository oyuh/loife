/**
 * Checks the day planner.
 *
 *   pnpm check:plan
 */
import assert from 'node:assert/strict'
import { toBusyPeriods } from '../src/lib/busy.ts'
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

// --- study time ----------------------------------------------------------

const { studyShareToday, STUDY_LEAD_DAYS, MIN_STUDY_BLOCK } = await import(
  '../src/lib/plan-day.ts'
)

const exam = (over: Partial<Plannable> = {}): Plannable =>
  task({ id: 7, name: 'Midterm 2', estimatedMinutes: null, studyMinutes: 600, ...over })

const inDays = (n: number) => {
  const d = new Date(at('09:00'))
  d.setDate(d.getDate() + n)
  return d
}
const nine = at('09:00')

// Nothing is revised for a month early. That is noise, not help.
assert.equal(studyShareToday(exam({ dueAt: inDays(30) }), nine), 0)
assert.equal(studyShareToday(exam({ dueAt: inDays(STUDY_LEAD_DAYS + 1) }), nine), 0)
assert.ok(studyShareToday(exam({ dueAt: inDays(STUDY_LEAD_DAYS) }), nine) > 0)
console.log('ok  study starts only once the exam is inside the lead window')

// Ten hours over ten days is an hour a day, today included.
assert.equal(studyShareToday(exam({ dueAt: inDays(9) }), nine), 60)
console.log('ok  the total is spread evenly across the days left')

// Falling behind raises today's share rather than losing the time.
assert.equal(studyShareToday(exam({ dueAt: inDays(4) }), nine), 120)
assert.equal(
  studyShareToday(exam({ dueAt: inDays(4), studiedMinutes: 300 }), nine),
  60,
  'work already done comes off the remainder',
)
console.log('ok  falling behind raises the share, progress lowers it')

// The day of the exam takes whatever is left.
assert.equal(studyShareToday(exam({ dueAt: inDays(0) }), nine), 600)
console.log('ok  the last day takes the whole remainder')

// Finished preparation, or a passed date, asks for nothing.
assert.equal(studyShareToday(exam({ dueAt: inDays(4), studiedMinutes: 600 }), nine), 0)
assert.equal(studyShareToday(exam({ dueAt: inDays(-1) }), nine), 0)
assert.equal(studyShareToday(exam({ dueAt: inDays(2), status: 'done' }), nine), 0)
console.log('ok  nothing is asked once it is done or past')

// A trickle is rounded up to something worth sitting down for.
const trickle = studyShareToday(exam({ studyMinutes: 30, dueAt: inDays(13) }), nine)
assert.equal(trickle, MIN_STUDY_BLOCK, 'never schedules a two minute session')
console.log('ok  a tiny share becomes one worthwhile block')

// An exam with no estimate still earns study blocks rather than being
// dismissed as unschedulable, which is the whole point.
const examPlan = planDay({
  day,
  dayStart: '09:00',
  dayEnd: '17:00',
  breakMinutes: 10,
  busy: [],
  now: nine,
  items: [exam({ dueAt: inDays(9) })],
})
assert.equal(examPlan.blocks.length, 1)
assert.equal(examPlan.blocks[0].kind, 'study')
assert.equal(minutes(examPlan.blocks[0].start, examPlan.blocks[0].end), 60)
assert.equal(examPlan.unplaced.length, 0, 'not reported as missing an estimate')
console.log('ok  an exam with study time is scheduled, not dismissed')

// Something with both gets a study block and a work block.
const both = planDay({
  day,
  dayStart: '09:00',
  dayEnd: '17:00',
  breakMinutes: 0,
  busy: [],
  now: nine,
  items: [exam({ dueAt: inDays(9), estimatedMinutes: 120 })],
})
assert.deepEqual(both.blocks.map((b) => b.kind).sort(), ['study', 'work'])
console.log('ok  preparing and doing are separate blocks')

console.log('\nstudy planning checks passed')

// --- what counts as busy ------------------------------------------------

const utc = (hhmm: string) => `2026-09-15T${hhmm}:00.000Z`
const meeting = (over: Record<string, unknown> = {}) => ({
  summary: 'Dentist',
  start: { dateTime: utc('14:00') },
  end: { dateTime: utc('15:00') },
  ...over,
})

const [appointment] = toBusyPeriods([meeting()])
assert.equal(appointment.label, 'Dentist')
assert.equal(+appointment.end - +appointment.start, 60 * 60_000)
console.log('ok  an ordinary meeting takes its slot')

// A birthday or a public holiday would otherwise blank out the whole day.
assert.equal(
  toBusyPeriods([
    { summary: 'Labor Day', start: { date: '2026-09-15' }, end: { date: '2026-09-16' } },
  ]).length,
  0,
)
console.log('ok  an all day event does not blank out the day')

// Google's own free/busy flag says this one costs no time.
assert.equal(toBusyPeriods([meeting({ transparency: 'transparent' })]).length, 0)
console.log('ok  events marked free in Google cost nothing')

assert.equal(
  toBusyPeriods([
    meeting({ attendees: [{ self: true, responseStatus: 'declined' }] }),
  ]).length,
  0,
)
console.log('ok  an invitation you declined is not a commitment')

// Somebody else declining is not you declining.
assert.equal(
  toBusyPeriods([
    meeting({
      attendees: [
        { self: true, responseStatus: 'accepted' },
        { responseStatus: 'declined' },
      ],
    }),
  ]).length,
  1,
)
console.log('ok  one you accepted still is')

assert.equal(toBusyPeriods([meeting({ status: 'cancelled' })]).length, 0)
assert.equal(
  toBusyPeriods([meeting({ end: { dateTime: utc('14:00') } })]).length,
  0,
)
console.log('ok  cancelled and zero length events are dropped')

// A private event on a shared calendar arrives without a title.
assert.equal(toBusyPeriods([meeting({ summary: undefined })])[0].label, 'Busy')
console.log('ok  a private event still blocks the time, without a name')

// Two calendars are read separately, so the merged list has to come back sorted.
const mixed = toBusyPeriods([
  meeting({ summary: 'Later', start: { dateTime: utc('16:00') }, end: { dateTime: utc('17:00') } }),
  meeting({ summary: 'Earlier' }),
])
assert.deepEqual(
  mixed.map((slot) => slot.label),
  ['Earlier', 'Later'],
)
console.log('ok  events from several calendars come back in order')

// The planner cannot tell a dentist appointment from a lecture, and should not.
const carved = freeWindows(day, '09:00', '17:00', [
  { start: at('12:00'), end: at('13:00'), label: 'Dentist' },
])
assert.equal(carved.length, 2)
assert.equal(carved[0].end.getHours(), 12)
assert.equal(carved[1].start.getHours(), 13)
console.log('ok  a calendar event carves a hole the same way a class does')

console.log('\nbusy time checks passed')
