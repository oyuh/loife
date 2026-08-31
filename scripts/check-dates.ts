/**
 * Checks the Today view's bucketing and ordering.
 *
 *   pnpm check:urgency
 */
import assert from 'node:assert/strict'
import {
  calendarDaysBetween,
  bucketFor,
  groupByUrgency,
  overdueCount,
  type Urgent,
} from '../src/lib/urgency.ts'

const now = new Date('2026-09-15T15:00:00')

const make = (over: Partial<Urgent> = {}): Urgent => ({
  name: 'thing',
  dueAt: null,
  allDay: true,
  priority: 'normal',
  status: 'todo',
  ...over,
})

const at = (iso: string) => new Date(iso)

// Buckets are calendar based, so the clock only decides today's edge case.
assert.equal(bucketFor(make({ dueAt: at('2026-09-14T23:00:00') }), now), 'overdue')
assert.equal(bucketFor(make({ dueAt: at('2026-09-16T08:00:00') }), now), 'tomorrow')
assert.equal(bucketFor(make({ dueAt: at('2026-09-22T08:00:00') }), now), 'week')
assert.equal(bucketFor(make({ dueAt: at('2026-09-23T08:00:00') }), now), 'later')
assert.equal(bucketFor(make({ dueAt: null }), now), 'someday')
console.log('ok  calendar buckets')

// An all-day item stays "today" all day. A timed one goes late once its time
// passes, which is the whole reason allDay exists.
assert.equal(
  bucketFor(make({ dueAt: at('2026-09-15T09:00:00'), allDay: true }), now),
  'today',
  'an all-day item due today is not overdue at 3pm',
)
assert.equal(
  bucketFor(make({ dueAt: at('2026-09-15T09:00:00'), allDay: false }), now),
  'overdue',
  'a 9am item is overdue at 3pm',
)
assert.equal(
  bucketFor(make({ dueAt: at('2026-09-15T17:00:00'), allDay: false }), now),
  'today',
  'a 5pm item is not overdue at 3pm',
)
console.log('ok  all-day items are not late until the day ends')

// The 11pm case that a UTC server would misfile as tomorrow.
assert.equal(
  bucketFor(make({ dueAt: at('2026-09-15T23:00:00'), allDay: false }), now),
  'today',
  'an 11pm item is still today',
)
console.log('ok  late-evening items stay on today')

// Priority ranks above the clock inside a bucket.
const groups = groupByUrgency(
  [
    make({ name: 'low but early', dueAt: at('2026-09-15T09:00:00'), priority: 'low' }),
    make({ name: 'high but late', dueAt: at('2026-09-15T22:00:00'), priority: 'high' }),
    make({ name: 'normal midday', dueAt: at('2026-09-15T12:00:00') }),
  ],
  now,
)
assert.equal(groups.length, 1)
assert.equal(groups[0].bucket, 'today')
assert.deepEqual(
  groups[0].items.map((i) => i.name),
  ['high but late', 'normal midday', 'low but early'],
)
console.log('ok  priority outranks the clock, clock breaks ties')

// Buckets come back in reading order, and empty ones are dropped.
const ordered = groupByUrgency(
  [
    make({ name: 'later', dueAt: at('2026-10-01T09:00:00') }),
    make({ name: 'overdue', dueAt: at('2026-09-01T09:00:00') }),
    make({ name: 'today', dueAt: at('2026-09-15T09:00:00') }),
    make({ name: 'someday' }),
  ],
  now,
)
assert.deepEqual(
  ordered.map((g) => g.bucket),
  ['overdue', 'today', 'later', 'someday'],
  'no empty buckets, and overdue leads',
)
console.log('ok  bucket order, empties dropped')

// Finished work stays visible on its own day and disappears afterwards, so
// today shows what you got through without yesterday's ticks piling up.
const done = groupByUrgency(
  [
    make({ name: 'done today', dueAt: at('2026-09-15T09:00:00'), status: 'done' }),
    make({ name: 'done yesterday', dueAt: at('2026-09-14T09:00:00'), status: 'done' }),
  ],
  now,
)
assert.deepEqual(
  done.flatMap((g) => g.items.map((i) => i.name)),
  ['done today'],
)
console.log('ok  completed work clears out after its day')

// A finished item is not counted as late.
assert.equal(
  overdueCount(
    [
      make({ dueAt: at('2026-09-01T09:00:00'), status: 'done' }),
      make({ dueAt: at('2026-09-02T09:00:00') }),
    ],
    now,
  ),
  1,
)
console.log('ok  overdue count ignores finished work')

console.log('\nurgency check passed')

// --- due-date field conversion ------------------------------------------

const { toDueValue, toDueFields } = await import('../src/lib/due-date.ts')

// The UTC trap: a bare date string must not shift the calendar day.
const endOfDay = toDueValue({ date: '2026-09-15', time: '' })
assert.equal(endOfDay.allDay, true)
assert.equal(endOfDay.dueAt?.getDate(), 15, 'the day must not shift')
assert.equal(endOfDay.dueAt?.getMonth(), 8, 'September')
assert.equal(endOfDay.dueAt?.getHours(), 23, 'no time means due by end of day')
console.log('ok  a date with no time lands on that day at 23:59 local')

const timed = toDueValue({ date: '2026-09-15', time: '17:30' })
assert.equal(timed.allDay, false)
assert.equal(timed.dueAt?.getHours(), 17)
assert.equal(timed.dueAt?.getMinutes(), 30)
console.log('ok  a date with a time is not all day')

assert.deepEqual(toDueValue({ date: '', time: '' }), { dueAt: null, allDay: true })
assert.deepEqual(toDueValue({ date: '', time: '09:00' }), { dueAt: null, allDay: true })
console.log('ok  no date means no due date, whatever the time says')

// Round tripping through the form must not drift.
for (const fields of [
  { date: '2026-09-15', time: '' },
  { date: '2026-01-01', time: '00:00' },
  { date: '2026-12-31', time: '23:59' },
  { date: '', time: '' },
]) {
  assert.deepEqual(toDueFields(toDueValue(fields)), fields, `round trip ${JSON.stringify(fields)}`)
}
console.log('ok  form values survive a round trip')

console.log('\ndate checks passed')

// --- dropping an item on a bucket reschedules it -------------------------

const { dueDateForBucket } = await import('../src/lib/urgency.ts')

assert.equal(dueDateForBucket('overdue', now), null, 'overdue is not a drop target')
assert.deepEqual(dueDateForBucket('someday', now), { dueAt: null }, 'someday clears the date')
console.log('ok  overdue rejects drops, someday clears the date')

for (const [bucket, offset] of [['today', 0], ['tomorrow', 1], ['week', 7], ['later', 30]] as const) {
  const result = dueDateForBucket(bucket, now)
  assert.ok(result?.dueAt, `${bucket} produces a date`)
  assert.equal(
    calendarDaysBetween(now, result.dueAt as Date),
    offset,
    `${bucket} lands ${offset} days out`,
  )
  // The point of rescheduling is that the item then sorts into that bucket.
  assert.equal(
    bucketFor(make({ dueAt: result.dueAt, allDay: true }), now),
    bucket,
    `an item dropped on ${bucket} reads back as ${bucket}`,
  )
}
console.log('ok  every drop target round trips back to its own bucket')

console.log('\nreschedule checks passed')
