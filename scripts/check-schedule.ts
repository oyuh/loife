/**
 * Checks the course meeting expansion behind the courses calendar.
 *
 *   pnpm check:schedule
 */
import assert from 'node:assert/strict'
import {
  firstMeetingKey,
  hasSchedule,
  meetingKeysInRange,
  meetsOnKey,
  monthGridKeys,
  nextMeetingKey,
  type ScheduledCourse,
  weekKeys,
} from '../src/lib/course-schedule.ts'

/** September 2026 starts on a Tuesday. The 1st is Tue, the 7th is Mon. */
const make = (over: Partial<ScheduledCourse> = {}): ScheduledCourse => ({
  days: [1, 3], // Monday and Wednesday
  startTime: '10:00',
  endTime: '11:15',
  termStart: '2026-09-07',
  termEnd: '2026-12-11',
  meetingInterval: 1,
  meetingDates: [],
  ...over,
})

// A term starting on the Monday means the Monday is the first meeting.
assert.equal(firstMeetingKey('2026-09-07', [1, 3]), '2026-09-07')
// A term starting on a Sunday for a Mon/Wed class begins on the Monday, not
// the Sunday. Getting this wrong offsets an alternating course by a week.
assert.equal(firstMeetingKey('2026-09-06', [1, 3]), '2026-09-07')
assert.equal(firstMeetingKey('2026-09-08', [1, 3]), '2026-09-09')
assert.equal(firstMeetingKey('2026-09-07', []), null)
console.log('ok  the first meeting is the first day the pattern lands on')

const mw = make()
assert.equal(meetsOnKey(mw, '2026-09-07'), true) // Monday
assert.equal(meetsOnKey(mw, '2026-09-09'), true) // Wednesday
assert.equal(meetsOnKey(mw, '2026-09-08'), false) // Tuesday
assert.equal(meetsOnKey(mw, '2026-09-12'), false) // Saturday
console.log('ok  a weekly pattern meets on its own days')

// Outside the term it meets on nothing, whatever the weekday says.
assert.equal(meetsOnKey(mw, '2026-09-02'), false) // Wednesday, before the term
assert.equal(meetsOnKey(mw, '2026-12-14'), false) // Monday, after the term
assert.equal(meetsOnKey(mw, '2026-12-11'), false) // Friday, the last day
assert.equal(meetsOnKey(mw, '2026-12-09'), true) // Wednesday, still inside
console.log('ok  the term bounds the pattern at both ends')

// Every other week. The parity is measured from the week holding the first
// meeting, so both days of an "on" week count and neither day of an "off" one.
const biweekly = make({ meetingInterval: 2 })
assert.equal(meetsOnKey(biweekly, '2026-09-07'), true) // week 0, Monday
assert.equal(meetsOnKey(biweekly, '2026-09-09'), true) // week 0, Wednesday
assert.equal(meetsOnKey(biweekly, '2026-09-14'), false) // week 1, skipped
assert.equal(meetsOnKey(biweekly, '2026-09-16'), false) // week 1, skipped
assert.equal(meetsOnKey(biweekly, '2026-09-21'), true) // week 2, back on
console.log('ok  an alternating course skips whole weeks, not single days')

// A term starting mid-week still anchors on its first real meeting, so the
// parity does not depend on which day the term happens to open.
const offset = make({ meetingInterval: 2, termStart: '2026-09-08' })
assert.equal(firstMeetingKey('2026-09-08', [1, 3]), '2026-09-09')
assert.equal(meetsOnKey(offset, '2026-09-09'), true)
assert.equal(meetsOnKey(offset, '2026-09-14'), false)
assert.equal(meetsOnKey(offset, '2026-09-23'), true)
console.log('ok  the alternating anchor follows the first meeting')

// One-off dates are additions. A Saturday lab counts even though Saturday is
// in no weekly pattern, and it counts in a week the pattern skips.
const withLab = make({
  meetingInterval: 2,
  meetingDates: ['2026-09-12', '2026-09-14'],
})
assert.equal(meetsOnKey(withLab, '2026-09-12'), true) // Saturday
assert.equal(meetsOnKey(withLab, '2026-09-14'), true) // inside a skipped week
console.log('ok  one-off dates are added on top of the rule')

// A course with only one-off dates and no term at all is still on a calendar.
const oneOffOnly = make({
  days: [],
  termStart: null,
  termEnd: null,
  meetingDates: ['2026-10-03'],
})
assert.equal(meetsOnKey(oneOffOnly, '2026-10-03'), true)
assert.equal(meetsOnKey(oneOffOnly, '2026-10-04'), false)
assert.equal(hasSchedule(oneOffOnly), true)
assert.equal(hasSchedule(make({ days: [], termStart: null, termEnd: null })), false)
console.log('ok  a course with no weekly pattern still places its one-offs')

// The first fortnight, expanded.
assert.deepEqual(meetingKeysInRange(mw, '2026-09-07', '2026-09-18'), [
  '2026-09-07',
  '2026-09-09',
  '2026-09-14',
  '2026-09-16',
])
assert.deepEqual(meetingKeysInRange(biweekly, '2026-09-07', '2026-09-25'), [
  '2026-09-07',
  '2026-09-09',
  '2026-09-21',
  '2026-09-23',
])
// A backwards range is empty rather than an error.
assert.deepEqual(meetingKeysInRange(mw, '2026-09-18', '2026-09-07'), [])
console.log('ok  a range expands in order')

assert.equal(nextMeetingKey(mw, '2026-09-10'), '2026-09-14')
assert.equal(nextMeetingKey(mw, '2026-09-14'), '2026-09-14')
// Past the end of term there is no next meeting, and the search stops.
assert.equal(nextMeetingKey(mw, '2026-12-12'), null)
console.log('ok  the next meeting is found, or honestly reported as none')

// A week grid runs Sunday to Saturday around whatever day it is handed.
assert.deepEqual(weekKeys('2026-09-09'), [
  '2026-09-06',
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-10',
  '2026-09-11',
  '2026-09-12',
])
console.log('ok  a week runs Sunday to Saturday')

// A month grid is whole weeks, so no row is ragged. September 2026 starts on
// a Tuesday and ends on a Wednesday, so it needs 5 weeks of padding.
const grid = monthGridKeys('2026-09-15')
assert.equal(grid.length % 7, 0)
assert.equal(grid[0], '2026-08-30') // the Sunday before the 1st
assert.equal(grid.at(-1), '2026-10-03') // the Saturday after the 30th
assert.ok(grid.includes('2026-09-01') && grid.includes('2026-09-30'))
// February in a non-leap year, which is the month that lines up exactly.
const february = monthGridKeys('2027-02-10')
assert.equal(february.length % 7, 0)
assert.ok(february.includes('2027-02-28'))
console.log('ok  a month grid is padded to whole weeks')

console.log('\nschedule checks passed')

// A course with days and times but no term dates, which is what you get from
// filling in the obvious half of the form. Google cannot build an RRULE from
// it, but the page can still say which days it meets, and marking nothing
// would leave the calendar blank for the commonest half-filled course there is.
const noTerm = make({ termStart: null, termEnd: null })
assert.equal(meetsOnKey(noTerm, '2026-09-07'), true) // a Monday
assert.equal(meetsOnKey(noTerm, '2026-09-08'), false) // a Tuesday
assert.equal(meetsOnKey(noTerm, '2027-04-05'), true) // a Monday, a year out
assert.equal(hasSchedule(noTerm), true)
console.log('ok  a pattern with no term dates still meets on its days')

// One open end still bounds the other.
const startedOnly = make({ termEnd: null })
assert.equal(meetsOnKey(startedOnly, '2026-09-02'), false) // before it starts
assert.equal(meetsOnKey(startedOnly, '2027-04-05'), true) // no end to stop it
const endedOnly = make({ termStart: null })
assert.equal(meetsOnKey(endedOnly, '2026-09-02'), true) // no start to gate it
assert.equal(meetsOnKey(endedOnly, '2026-12-14'), false) // after it ends
console.log('ok  each term bound applies on its own')

// An alternating course with no term start has no anchor to count weeks from,
// so it falls back to weekly rather than to silence.
const biweeklyNoTerm = make({ meetingInterval: 2, termStart: null, termEnd: null })
assert.equal(meetsOnKey(biweeklyNoTerm, '2026-09-07'), true)
assert.equal(meetsOnKey(biweeklyNoTerm, '2026-09-14'), true)
console.log('ok  an alternating course with no anchor falls back to weekly')
