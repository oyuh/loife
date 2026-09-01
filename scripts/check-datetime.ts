/**
 * Checks the site-wide date and time formatting.
 *
 *   pnpm check:datetime
 *
 * Runs with TZ deliberately set to something other than central, because the
 * whole point of the module is that the display does not follow the machine.
 */
import assert from 'node:assert/strict'
import {
  calendarDaysApart,
  DISPLAY_TIME_ZONE,
  formatClock,
  formatClockWithSeconds,
  formatDay,
  formatDayAndTime,
  formatDayLong,
  formatDuration,
  formatFull,
  formatRelative,
  isSameZonedDay,
  toDateKey,
  zonedParts,
} from '../src/lib/datetime.ts'

assert.equal(DISPLAY_TIME_ZONE, 'America/Chicago')

// 2026-09-15 is a Tuesday. 22:00 UTC is 5pm central, daylight saving being on.
const afternoon = new Date('2026-09-15T22:00:00Z')

assert.equal(formatDay(afternoon), 'Tue, Sep 15')
assert.equal(formatDayLong(afternoon), 'Tuesday, September 15')
assert.equal(formatClock(afternoon), '5:00 PM')
assert.equal(formatClockWithSeconds(afternoon), '5:00:00 PM')
console.log('ok  weekday, month, day and a 12 hour clock')

// The am/pm boundaries, which is where a 12 hour clock goes wrong if it is
// written by hand.
assert.equal(formatClock(new Date('2026-09-15T05:00:00Z')), '12:00 AM')
assert.equal(formatClock(new Date('2026-09-15T17:00:00Z')), '12:00 PM')
assert.equal(formatClock(new Date('2026-09-15T18:30:00Z')), '1:30 PM')
console.log('ok  midnight is 12 AM and noon is 12 PM')

// The reason the zone is pinned. 04:00 UTC is still the 14th in Chicago, and a
// formatter following the machine would call it the 15th.
const lateNight = new Date('2026-09-15T04:00:00Z')
assert.equal(formatDay(lateNight), 'Mon, Sep 14')
assert.equal(formatClock(lateNight), '11:00 PM')
assert.equal(toDateKey(lateNight), '2026-09-14')
console.log('ok  an 11pm central instant stays on its own day')

// Daylight saving, which a fixed -6 offset would get wrong for half the year.
assert.match(formatFull(afternoon), /CDT$/)
assert.match(formatFull(new Date('2026-01-15T22:00:00Z')), /CST$/)
console.log('ok  the zone abbreviation follows daylight saving')

const parts = zonedParts(afternoon)
assert.deepEqual(parts, {
  year: 2026,
  month: 9,
  day: 15,
  hour: 17,
  minute: 0,
  second: 0,
})
// Midnight is hour 0, not hour 24, which some engines write for a 24h clock.
assert.equal(zonedParts(new Date('2026-09-15T05:00:00Z')).hour, 0)
console.log('ok  wall clock parts read in the display zone')

// Calendar days ignore the clock, so 11pm to 1am is a day apart.
const elevenPm = new Date('2026-09-15T04:00:00Z') // 11pm on the 14th
const onePm = new Date('2026-09-15T18:00:00Z') // 1pm on the 15th
assert.equal(calendarDaysApart(elevenPm, onePm), 1)
assert.equal(calendarDaysApart(onePm, elevenPm), -1)
assert.equal(calendarDaysApart(afternoon, afternoon), 0)
assert.equal(isSameZonedDay(elevenPm, onePm), false)
assert.equal(isSameZonedDay(onePm, afternoon), true)
console.log('ok  calendar days are counted in the display zone')

// Relative time. Under an hour is elapsed minutes, past that it is calendar
// days, so an evening look at tomorrow morning says tomorrow.
const at = (iso: string) => new Date(iso)
const now = at('2026-09-15T22:00:00Z') // 5pm central

assert.equal(formatRelative(now, now), 'just now')
assert.equal(formatRelative(at('2026-09-15T22:00:20Z'), now), 'just now')
assert.equal(formatRelative(at('2026-09-15T22:30:00Z'), now), 'in 30 minutes')
assert.equal(formatRelative(at('2026-09-15T21:30:00Z'), now), '30 minutes ago')
assert.equal(formatRelative(at('2026-09-16T01:00:00Z'), now), 'in 3 hours')
console.log('ok  short gaps count real elapsed time')

// 8pm central looking at 9am the next morning is 13 hours away, and the useful
// word for that is tomorrow.
const evening = at('2026-09-16T01:00:00Z') // 8pm on the 15th
const nextMorning = at('2026-09-16T14:00:00Z') // 9am on the 16th
assert.equal(formatRelative(nextMorning, evening), 'tomorrow')
assert.equal(formatRelative(evening, nextMorning), 'yesterday')
console.log('ok  a gap that crosses midnight is named by the day')

assert.equal(formatRelative(at('2026-09-18T22:00:00Z'), now), 'in 3 days')
assert.equal(formatRelative(at('2026-09-12T22:00:00Z'), now), '3 days ago')
assert.equal(formatRelative(at('2026-09-29T22:00:00Z'), now), 'in 2 weeks')
assert.equal(formatRelative(at('2026-11-15T22:00:00Z'), now), 'in 2 months')
// 426 days truncates to one year, which `numeric: 'auto'` writes as a word.
assert.equal(formatRelative(at('2027-11-15T22:00:00Z'), now), 'next year')
assert.equal(formatRelative(at('2029-01-15T22:00:00Z'), now), 'in 2 years')
console.log('ok  longer gaps step up through weeks, months and years')

// An all-day item is stored at 23:59 so it sorts last in its day. Printing
// that back as a time would be a time nobody typed.
const endOfDay = at('2026-09-16T04:59:00Z') // 11:59pm on the 15th
assert.equal(formatDayAndTime(endOfDay, true), 'Tue, Sep 15')
assert.equal(formatDayAndTime(afternoon, false), 'Tue, Sep 15 at 5:00 PM')
console.log('ok  an all-day item prints no time')

assert.equal(formatDuration(45), '45m')
assert.equal(formatDuration(60), '1h')
assert.equal(formatDuration(150), '2h 30m')
console.log('ok  durations read in hours and minutes')

console.log('\ndatetime checks passed')

// Date-only values. A journal entry for the 15th is the 15th on any machine,
// so these must not go through the zoned formatters at all.
const {
  dateKeyOf,
  dateKeysApart,
  formatKeyDay,
  formatKeyDayNumber,
  formatKeyMonth,
  formatKeyRelative,
  formatKeyWeekday,
  parseDateKey,
  shiftDateKey,
  startOfWeekKey,
  todayKey,
  weekdayOfKey,
} = await import('../src/lib/datetime.ts')

assert.equal(formatKeyDay('2026-09-15'), 'Tue, Sep 15')
assert.equal(formatKeyWeekday('2026-09-15'), 'Tuesday')
assert.equal(formatKeyDayNumber('2026-09-15'), '15')
assert.equal(formatKeyMonth('2026-09-15'), 'September 2026')
assert.equal(dateKeyOf(parseDateKey('2026-09-15')), '2026-09-15')
console.log('ok  a date-only value keeps its digits')

assert.equal(dateKeysApart('2026-09-15', '2026-09-18'), 3)
assert.equal(dateKeysApart('2026-09-18', '2026-09-15'), -3)
assert.equal(shiftDateKey('2026-09-30', 1), '2026-10-01')
assert.equal(shiftDateKey('2026-01-01', -1), '2025-12-31')
console.log('ok  date keys add and subtract across month and year ends')

// Daylight saving is the case a naive "add 86400000ms" gets wrong. In 2026 the
// US springs forward on 8 March, so that day is 23 hours long.
assert.equal(shiftDateKey('2026-03-07', 1), '2026-03-08')
assert.equal(shiftDateKey('2026-03-08', 1), '2026-03-09')
assert.equal(dateKeysApart('2026-03-07', '2026-03-09'), 2)
console.log('ok  a short day is still one day')

// 2026-09-15 is a Tuesday, so the grid starts on Sunday the 13th.
assert.equal(weekdayOfKey('2026-09-15'), 2)
assert.equal(startOfWeekKey('2026-09-15'), '2026-09-13')
assert.equal(startOfWeekKey('2026-09-13'), '2026-09-13')
console.log('ok  a week starts on the Sunday on or before')

assert.equal(todayKey(afternoon), '2026-09-15')
assert.equal(todayKey(lateNight), '2026-09-14')
assert.equal(formatKeyRelative('2026-09-15', afternoon), 'today')
assert.equal(formatKeyRelative('2026-09-16', afternoon), 'tomorrow')
assert.equal(formatKeyRelative('2026-09-18', afternoon), 'in 3 days')
console.log('ok  a date key is compared against today in the display zone')

console.log('\ndate-only checks passed')
