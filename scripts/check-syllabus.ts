/**
 * Checks the syllabus paste parser.
 *
 *   pnpm check:syllabus
 */
import assert from 'node:assert/strict'
import { parseSyllabus, parseSyllabusLine } from '../src/lib/parse-syllabus.ts'

// Mid-semester, so year inference has something to lean on.
const now = new Date('2026-09-15T12:00:00')

const one = (line: string) => parseSyllabusLine(line, now)

// The shapes a syllabus actually arrives in.
for (const [line, expectedName, month, day] of [
  ['HW1 - Sep 5', 'HW1', 8, 5],
  ['Problem set 6 — 9/12', 'Problem set 6', 8, 12],
  ['Midterm 2, October 14', 'Midterm 2', 9, 14],
  ['Reading ch 3 due 2026-09-20', 'Reading ch 3', 8, 20],
  ['Essay draft: Sept. 30th', 'Essay draft', 8, 30],
  ['Final project by Dec 11', 'Final project', 11, 11],
] as const) {
  const parsed = one(line)
  assert.equal(parsed?.name, expectedName, `name from "${line}"`)
  assert.equal(parsed?.dueAt?.getMonth(), month, `month from "${line}"`)
  assert.equal(parsed?.dueAt?.getDate(), day, `day from "${line}"`)
}
console.log('ok  reads month names, slashes, and ISO dates')

// "Problem set 6" must not have its 6 read as a date, which is why the numeric
// form requires a slash.
const noDate = one('Read chapter 6')
assert.equal(noDate?.dueAt, null, 'a bare number is not a date')
assert.equal(noDate?.name, 'Read chapter 6')
console.log('ok  a bare number is never mistaken for a date')

// A line with no date is still worth keeping, with the date filled in by hand.
assert.equal(one('Buy the textbook')?.name, 'Buy the textbook')
assert.equal(one('Buy the textbook')?.dueAt, null)
console.log('ok  undated lines survive for manual dating')

// No time means due by end of day, which matches the add form.
const allDay = one('HW1 - Sep 5')
assert.equal(allDay?.allDay, true)
assert.equal(allDay?.dueAt?.getHours(), 23)
assert.equal(allDay?.dueAt?.getMinutes(), 59)
console.log('ok  a dateless time means end of day')

// Times, in both the shapes people write them.
const evening = one('Essay draft 10/3 5pm')
assert.equal(evening?.allDay, false)
assert.equal(evening?.dueAt?.getHours(), 17)
assert.equal(evening?.name, 'Essay draft')

const halfPast = one('Lab report Oct 3 at 5:30pm')
assert.equal(halfPast?.dueAt?.getHours(), 17)
assert.equal(halfPast?.dueAt?.getMinutes(), 30)

const military = one('Quiz 4 - Nov 2 17:00')
assert.equal(military?.dueAt?.getHours(), 17)
assert.equal(military?.dueAt?.getMinutes(), 0)
console.log('ok  reads 5pm, 5:30pm, and 17:00')

// The date is removed before the time is searched, so 9/12 cannot be read as
// a clock time of 9:12.
const noFalseTime = one('Problem set 6 — 9/12')
assert.equal(noFalseTime?.allDay, true, 'a slash date is not also a time')
console.log('ok  a date is not re-read as a time')

// An August syllabus listing January means the following January.
const autumn = new Date('2026-09-15T12:00:00')
assert.equal(
  parseSyllabusLine('Final exam Jan 12', autumn)?.dueAt?.getFullYear(),
  2027,
  'a January deadline seen in September is next year',
)
assert.equal(
  parseSyllabusLine('Midterm Oct 14', autumn)?.dueAt?.getFullYear(),
  2026,
  'an October deadline seen in September is this year',
)
console.log('ok  the year is inferred across a semester boundary')

// An explicit year always wins over inference.
assert.equal(one('Thesis due March 3, 2028')?.dueAt?.getFullYear(), 2028)
assert.equal(one('Draft 3/3/27')?.dueAt?.getFullYear(), 2027)
console.log('ok  an explicit year beats inference')

// Whole paste: blanks dropped, order kept.
const parsed = parseSyllabus(
  ['HW1 - Sep 5', '', '   ', 'Midterm 2, October 14', 'Buy the textbook'].join('\n'),
  now,
)
assert.equal(parsed.length, 3, 'blank lines are dropped')
assert.deepEqual(
  parsed.map((p) => p.name),
  ['HW1', 'Midterm 2', 'Buy the textbook'],
)
assert.equal(parsed[0].raw, 'HW1 - Sep 5', 'the original line is kept for the preview')
console.log('ok  a whole paste drops blanks and keeps order')

console.log('\nsyllabus parser checks passed')
