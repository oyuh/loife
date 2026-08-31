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
  priority: 3,
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
    make({ name: 'low but early', dueAt: at('2026-09-15T09:00:00'), priority: 4 }),
    make({ name: 'high but late', dueAt: at('2026-09-15T22:00:00'), priority: 2 }),
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

// --- google calendar event mapping --------------------------------------

const { toCalendarEvent, localDateString } = await import(
  '../src/lib/calendar-event.ts'
)

const calItem = (over: Record<string, unknown> = {}) => ({
  name: 'Problem set 7',
  type: 'assignment',
  priority: 3,
  dueAt: at('2026-09-15T23:59:00'),
  allDay: true,
  location: null,
  notes: null,
  ...over,
}) as Parameters<typeof toCalendarEvent>[0]

const opts = { timeZone: 'America/Chicago' }

assert.equal(toCalendarEvent(calItem({ dueAt: null }), opts), null, 'no due date, no event')
console.log('ok  an item with no due date produces no event')

// Google treats all-day end.date as exclusive. Same-day start and end draws
// nothing in most clients, which is the bug this pins down.
const allDayEvent = toCalendarEvent(calItem(), opts)
assert.equal(allDayEvent?.start.date, '2026-09-15')
assert.equal(allDayEvent?.end.date, '2026-09-16', 'all-day end must be the next day')
assert.equal(allDayEvent?.start.dateTime, undefined, 'all-day uses date, never dateTime')
console.log('ok  all-day events end on the following day')

// Local calendar date, not the UTC one, which is already tomorrow at 11pm CDT.
assert.equal(localDateString(at('2026-09-15T23:00:00')), '2026-09-15')
console.log('ok  event dates use the local day, not the UTC one')

const timedEvent = toCalendarEvent(calItem({ allDay: false, dueAt: at('2026-09-15T17:00:00') }), opts)
assert.ok(timedEvent?.start.dateTime && timedEvent.end.dateTime)
assert.equal(timedEvent?.start.date, undefined, 'timed uses dateTime, never date')
assert.ok(
  new Date(timedEvent.end.dateTime as string) > new Date(timedEvent.start.dateTime as string),
  'Google rejects an end at or before the start',
)
console.log('ok  timed events have a non-zero duration')

const titledEvent = toCalendarEvent(calItem(), { ...opts, courseLabel: 'CS 2340' })
assert.equal(titledEvent?.summary, 'CS 2340: Problem set 7')
assert.match(titledEvent?.description ?? '', /assignment/)
console.log('ok  the course leads the summary')

console.log('\ncalendar event checks passed')

// --- recurring course meetings ------------------------------------------

const { toCourseEvent, firstMeetingOn, toUntil, trimSeconds } = await import(
  '../src/lib/course-event.ts'
)

const course = (over: Record<string, unknown> = {}) => ({
  name: 'Computer Systems',
  code: 'CS 2340',
  location: 'ECSS 2.410',
  days: [1, 3, 5],
  startTime: '10:00:00',
  endTime: '10:50:00',
  termStart: '2026-08-24',
  termEnd: '2026-12-15',
  ...over,
}) as Parameters<typeof toCourseEvent>[0]

// A term opening on a Sunday must not start a Mon/Wed/Fri series that day.
const sunday = new Date(2026, 7, 23)
assert.equal(sunday.getDay(), 0, 'fixture really is a Sunday')
assert.equal(firstMeetingOn(sunday, [1, 3, 5])?.getDay(), 1, 'skips to Monday')
assert.equal(firstMeetingOn(new Date(2026, 7, 24), [1, 3, 5])?.getDay(), 1, 'already Monday')
console.log('ok  the series starts on the first day the class actually meets')

const meeting = toCourseEvent(course(), 'America/Chicago')
assert.ok(meeting)
assert.match(meeting.recurrence[0], /FREQ=WEEKLY/)
assert.match(meeting.recurrence[0], /BYDAY=MO,WE,FR/, 'day numbers become RRULE codes in week order')
assert.match(meeting.recurrence[0], /UNTIL=\d{8}T\d{6}Z$/, 'UNTIL is UTC basic format')
console.log('ok  weekly rule carries the meeting days and an end')

// Days are sorted, so entering Friday first still reads MO,WE,FR.
assert.match(
  toCourseEvent(course({ days: [5, 1, 3] }), 'America/Chicago')?.recurrence[0] ?? '',
  /BYDAY=MO,WE,FR/,
)
console.log('ok  day order does not depend on click order')

const startsAt = new Date(meeting.start.dateTime as string)
const endsAt = new Date(meeting.end.dateTime as string)
assert.equal(startsAt.getHours(), 10)
assert.equal(startsAt.getMinutes(), 0)
assert.equal(endsAt.getHours(), 10)
assert.equal(endsAt.getMinutes(), 50)
assert.ok(endsAt > startsAt)
console.log('ok  the first meeting spans the class times, local')

// A course with no meeting pattern is valid, it just has no event.
for (const missing of [{ days: [] }, { startTime: null }, { endTime: null }, { termEnd: null }]) {
  assert.equal(toCourseEvent(course(missing), 'America/Chicago'), null, JSON.stringify(missing))
}
console.log('ok  an incomplete meeting pattern produces no event')

assert.equal(trimSeconds('10:00:00'), '10:00', 'postgres time renders in a time input')
assert.equal(trimSeconds(null), '')
assert.ok(toUntil('2026-12-15'))
console.log('ok  postgres time values round trip into the form')

console.log('\ncourse meeting checks passed')

// --- irregular meeting patterns -----------------------------------------

// Biweekly labs.
const biweekly = toCourseEvent(
  course({ days: [2], meetingInterval: 2, startTime: '14:00:00', endTime: '16:50:00' }),
  'America/Chicago',
)
assert.match(biweekly?.recurrence[0] ?? '', /FREQ=WEEKLY;INTERVAL=2;BYDAY=TU/)
console.log('ok  a biweekly lab carries INTERVAL=2')

// Weekly stays clean, with no redundant INTERVAL=1.
assert.doesNotMatch(
  toCourseEvent(course({ meetingInterval: 1 }), 'America/Chicago')?.recurrence[0] ?? '',
  /INTERVAL/,
  'weekly omits INTERVAL entirely',
)
console.log('ok  a weekly course omits INTERVAL')

// A weekly pattern plus one-off extra sessions.
const withExtras = toCourseEvent(
  course({ meetingDates: ['2026-10-31', '2026-11-07'] }),
  'America/Chicago',
)
assert.equal(withExtras?.recurrence.length, 2, 'an RRULE and an RDATE')
assert.match(withExtras?.recurrence[1] ?? '', /^RDATE:\d{8}T\d{6}Z,\d{8}T\d{6}Z$/)
console.log('ok  extra sessions ride along as RDATE')

// No weekly pattern at all, just a handful of scattered lab dates.
const scattered = toCourseEvent(
  course({
    days: [], termStart: null, termEnd: null,
    meetingDates: ['2026-09-04', '2026-09-25', '2026-10-16'],
  }),
  'America/Chicago',
)
assert.ok(scattered, 'scattered dates alone still make an event')
assert.equal(scattered.recurrence.length, 1, 'RDATE only, no RRULE')
assert.match(scattered.recurrence[0], /^RDATE:/)
// The first date anchors the event, so it must not also appear in the RDATE.
assert.equal(new Date(scattered.start.dateTime as string).getDate(), 4)
assert.equal((scattered.recurrence[0].match(/,/g) ?? []).length, 1, 'two extras, not three')
console.log('ok  scattered dates work with no weekly rule, anchor not repeated')

// One single meeting is a plain event with no recurrence at all.
const once = toCourseEvent(
  course({ days: [], termStart: null, termEnd: null, meetingDates: ['2026-09-04'] }),
  'America/Chicago',
)
assert.deepEqual(once?.recurrence, [])
console.log('ok  a single session needs no recurrence')

// Still nothing to place without times, or without any pattern or dates.
assert.equal(toCourseEvent(course({ startTime: null }), 'America/Chicago'), null)
assert.equal(
  toCourseEvent(course({ days: [], termStart: null, termEnd: null, meetingDates: [] }), 'America/Chicago'),
  null,
)
console.log('ok  no times or no dates still means no event')

console.log('\nirregular meeting checks passed')

// --- the blended urgency score ------------------------------------------

const { urgencyScore, DEFAULT_PRIORITY } = await import('../src/lib/urgency.ts')

const scored = (over: Partial<Urgent>) => urgencyScore(make(over), now)

// A default priority scores purely on the clock.
assert.equal(scored({ dueAt: at('2026-09-15T09:00:00'), priority: 3 }), 0)
assert.equal(scored({ dueAt: at('2026-09-20T09:00:00'), priority: 3 }), 5)
console.log('ok  at the default priority the score is just days remaining')

// This is the whole point of a number. A P1 five days out beats a P5 tomorrow.
const importantLater = scored({ dueAt: at('2026-09-20T09:00:00'), priority: 1 })
const trivialSooner = scored({ dueAt: at('2026-09-16T09:00:00'), priority: 5 })
assert.ok(
  importantLater < trivialSooner,
  `P1 in five days (${importantLater}) must beat P5 tomorrow (${trivialSooner})`,
)
console.log('ok  a P1 next week outranks a P5 tomorrow')

// Priority alone never jumps an arbitrary distance. Two steps is four days,
// so a P1 three weeks out stays behind a P3 due today.
assert.ok(
  scored({ dueAt: at('2026-10-06T09:00:00'), priority: 1 }) >
    scored({ dueAt: at('2026-09-15T09:00:00'), priority: 3 }),
  'priority does not outweigh three weeks',
)
console.log('ok  priority bends the order without overturning it')

// A low priority overdue item can score the same as a normal one due soon,
// and that is fine: the bucket decides what leads, the score only orders
// within a bucket. This pins that division of labour down.
const lateAndTrivial = make({ dueAt: at('2026-09-13T09:00:00'), priority: 5 })
const soonAndNormal = make({ dueAt: at('2026-09-17T09:00:00'), priority: 3 })
assert.equal(scored({ dueAt: at('2026-09-13T09:00:00'), priority: 5 }), 2)
assert.equal(scored({ dueAt: at('2026-09-17T09:00:00'), priority: 3 }), 2)
assert.equal(bucketFor(lateAndTrivial, now), 'overdue')
assert.equal(bucketFor(soonAndNormal, now), 'week')
assert.deepEqual(
  groupByUrgency([soonAndNormal, lateAndTrivial], now).map((g) => g.bucket),
  ['overdue', 'week'],
  'the bucket puts overdue first even on an equal score',
)
console.log('ok  buckets decide what leads, the score orders within one')

// No due date sits far out until priority pulls it in.
assert.ok(scored({ dueAt: null, priority: 3 }) > scored({ dueAt: at('2026-10-01T09:00:00'), priority: 3 }))
assert.ok(scored({ dueAt: null, priority: 1 }) < scored({ dueAt: null, priority: 5 }))
console.log('ok  undated work is deferred but still ranks by priority')

assert.equal(DEFAULT_PRIORITY, 3)
console.log('\nurgency score checks passed')

// --- move targets --------------------------------------------------------

const { moveTargetDate, MOVE_TARGETS } = await import(
  '../src/lib/move-targets.ts'
)

const target = (label: string) =>
  MOVE_TARGETS.find((t: { label: string }) => t.label === label) as (typeof MOVE_TARGETS)[number]

// now is Tuesday 15 September 2026.
assert.equal(now.getDay(), 2, 'fixture really is a Tuesday')

assert.equal(calendarDaysBetween(now, moveTargetDate(target('Today'), now) as Date), 0)
assert.equal(calendarDaysBetween(now, moveTargetDate(target('Tomorrow'), now) as Date), 1)
assert.equal(calendarDaysBetween(now, moveTargetDate(target('Next week'), now) as Date), 7)
assert.equal(moveTargetDate(target('No date'), now), null)
console.log('ok  named move targets land the right number of days out')

// The weekend means the coming Saturday, not a fixed offset.
const weekend = moveTargetDate(target('This weekend'), now) as Date
assert.equal(weekend.getDay(), 6, 'lands on a Saturday')
assert.equal(calendarDaysBetween(now, weekend), 4, 'Tuesday to Saturday is four days')

// Asked on a Saturday it means the next one, not today.
const saturday = new Date('2026-09-19T12:00:00')
assert.equal(saturday.getDay(), 6)
assert.equal(calendarDaysBetween(saturday, moveTargetDate(target('This weekend'), saturday) as Date), 7)
console.log('ok  the weekend is the coming Saturday, and never today')

// Everything with a date is due at end of day, matching the add form.
assert.equal((moveTargetDate(target('Tomorrow'), now) as Date).getHours(), 23)
console.log('ok  moved items are due by end of day')

console.log('\nmove target checks passed')
