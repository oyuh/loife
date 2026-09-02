/**
 * Checks the filter language behind the command palette and the history page.
 *
 *   pnpm check:search
 */
import assert from 'node:assert/strict'
import {
  matches,
  parseFilterDate,
  parseMinutes,
  parseQuery,
  search,
  type Searchable,
} from '../src/lib/search.ts'

const now = new Date('2026-09-15T12:00:00')
const at = (iso: string) => new Date(iso)

const entry = (over: Partial<Searchable> = {}): Searchable => ({
  kind: 'item',
  title: 'Problem set 6',
  body: '',
  date: at('2026-09-20T23:59:00'),
  courseCode: 'MATH 220',
  type: 'assignment',
  priority: 3,
  status: 'todo',
  hasAttachment: false,
  ...over,
})

// Anything that is not a known key stays free text, so a stray colon in a
// title never silently becomes a filter.
assert.deepEqual(parseQuery('essay draft', now).text, ['essay', 'draft'])
assert.deepEqual(parseQuery('ratio:2 essay', now).text, ['ratio:2', 'essay'])
console.log('ok  unknown keys stay as search words')

// Free text has to match every word, across title and body.
assert.ok(matches(entry(), parseQuery('problem set', now)))
assert.ok(!matches(entry(), parseQuery('problem missing', now)))
assert.ok(matches(entry({ body: 'chapter four' }), parseQuery('chapter', now)))
console.log('ok  every word must appear somewhere')

// Course codes match with or without the space.
assert.ok(matches(entry(), parseQuery('in:math220', now)))
assert.ok(matches(entry(), parseQuery('course:MATH220', now)))
assert.ok(!matches(entry(), parseQuery('in:cs210', now)))
console.log('ok  course codes ignore spacing and case')

assert.ok(matches(entry({ type: 'exam' }), parseQuery('type:exam', now)))
assert.ok(!matches(entry(), parseQuery('type:exam', now)))
assert.ok(matches(entry({ priority: 1 }), parseQuery('p:1', now)))
assert.ok(!matches(entry(), parseQuery('p:1', now)))
assert.ok(matches(entry({ status: 'done' }), parseQuery('is:done', now)))
console.log('ok  type, priority, and status filter')

assert.ok(matches(entry({ hasAttachment: true }), parseQuery('has:file', now)))
assert.ok(!matches(entry(), parseQuery('has:file', now)))
assert.ok(
  matches(entry({ hasAttachment: true }), parseQuery('is:attached', now)),
)
console.log('ok  attachments filter')

// Dates take an ISO day or a relative word.
assert.ok(matches(entry(), parseQuery('before:2026-10-01', now)))
assert.ok(!matches(entry(), parseQuery('before:2026-09-01', now)))
assert.ok(matches(entry(), parseQuery('after:today', now)))
assert.ok(
  !matches(
    entry({ date: at('2026-09-14T09:00:00') }),
    parseQuery('after:today', now),
  ),
)
console.log('ok  before and after take a date or a word')

// A dateless entry must not slip through a date filter.
assert.ok(!matches(entry({ date: null }), parseQuery('before:2026-10-01', now)))
assert.ok(!matches(entry({ date: null }), parseQuery('after:today', now)))
assert.ok(matches(entry({ date: null }), parseQuery('problem', now)))
console.log('ok  dateless entries drop out of date filters, not through them')

// Journal entries come back too, and can be isolated.
const mixed = [
  entry({ title: 'Problem set 6' }),
  entry({
    kind: 'journal',
    title: 'Rough one',
    body: 'missed calc',
    date: at('2026-09-12T00:00:00'),
    courseCode: null,
    type: null,
    priority: null,
    status: null,
  }),
]
assert.equal(search(mixed, 'kind:journal', now).length, 1)
assert.equal(search(mixed, 'kind:item', now).length, 1)
assert.equal(search(mixed, 'calc', now).length, 1, 'journal bodies are searched')
console.log('ok  journal entries are searchable and separable')

// Filters combine, which is the point of having them.
const many = [
  entry({
    title: 'Essay',
    courseCode: 'ENGL 150',
    type: 'assignment',
    priority: 1,
    hasAttachment: true,
  }),
  entry({
    title: 'Essay',
    courseCode: 'ENGL 150',
    type: 'assignment',
    priority: 3,
    hasAttachment: false,
  }),
  entry({
    title: 'Essay',
    courseCode: 'CS 210',
    type: 'assignment',
    priority: 1,
    hasAttachment: true,
  }),
]
assert.equal(search(many, 'essay in:engl150 p:1 has:file', now).length, 1)
console.log('ok  filters stack')

// ---------------------------------------------------------------------------
// Dates, written the ways someone actually types one.
// ---------------------------------------------------------------------------

const day = (value: Date | undefined) =>
  value && `${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()}`

for (const written of ['2026-09-20', '2026/09/20', '2026-9-20']) {
  assert.equal(day(parseFilterDate(written, now)), '2026-9-20', written)
}
console.log('ok  a full date reads with either separator')

for (const written of [
  '9/20',
  '09-20',
  'sep20',
  'sep-20',
  '20-sep',
  'september20',
]) {
  assert.equal(day(parseFilterDate(written, now)), '2026-9-20', written)
}
console.log('ok  a month and day fill in the current year')

assert.equal(day(parseFilterDate('today', now)), '2026-9-15')
assert.equal(day(parseFilterDate('tomorrow', now)), '2026-9-16')
assert.equal(day(parseFilterDate('yesterday', now)), '2026-9-14')
assert.equal(day(parseFilterDate('week', now)), '2026-9-22')
assert.equal(day(parseFilterDate('lastweek', now)), '2026-9-8')
console.log('ok  the relative words land on the right day')

assert.equal(day(parseFilterDate('5d', now)), '2026-9-20')
assert.equal(day(parseFilterDate('-5d', now)), '2026-9-10')
assert.equal(day(parseFilterDate('1w', now)), '2026-9-22')
assert.equal(day(parseFilterDate('-2w', now)), '2026-9-1')
console.log('ok  signed offsets go both ways')

// Local midnight, not a UTC one that lands on the day before.
const parsed = parseFilterDate('2026-09-20', now)
assert.equal(parsed?.getHours(), 0)
assert.equal(parsed?.getDate(), 20)
console.log('ok  a parsed date is local midnight')

// Weekday names are deliberately absent: see the note on parseFilterDate.
for (const junk of ['', 'lunch', 'friday', 'someday', '2026', 'xyz12']) {
  assert.equal(parseFilterDate(junk, now), undefined, junk)
}
console.log('ok  what it cannot read it refuses rather than guesses')

// An unreadable date leaves the whole token as free text, so the query still
// narrows something instead of silently matching everything.
assert.deepEqual(parseQuery('before:lunch', now).text, ['before:lunch'])
assert.equal(parseQuery('before:lunch', now).before, undefined)
console.log('ok  an unreadable date falls back to free text')

// ---------------------------------------------------------------------------
// Completion, which is a different date from the due date.
// ---------------------------------------------------------------------------

const finished = entry({
  date: at('2026-06-01T09:00:00'),
  completedAt: at('2026-09-14T18:30:00'),
  status: 'done',
})

assert.ok(matches(finished, parseQuery('done:yesterday', now)))
assert.ok(!matches(finished, parseQuery('done:today', now)))
console.log('ok  done: lands on the calendar day, whatever the time of day')

assert.ok(matches(finished, parseQuery('doneafter:-7d', now)))
assert.ok(!matches(finished, parseQuery('doneafter:today', now)))
assert.ok(matches(finished, parseQuery('donebefore:today', now)))
console.log('ok  a completion range reads independently of the due date')

// Due in June, finished in September. Filtering on one must not quietly
// answer with the other.
assert.ok(matches(finished, parseQuery('before:2026-07-01', now)))
assert.ok(!matches(finished, parseQuery('donebefore:2026-07-01', now)))
console.log('ok  due and done do not stand in for each other')

// Something never finished cannot satisfy a completion filter.
const open = entry({ completedAt: null })
for (const query of ['done:today', 'doneafter:-7d', 'donebefore:today']) {
  assert.ok(!matches(open, parseQuery(query, now)), query)
}
console.log('ok  unfinished work never matches a completion filter')

// ---------------------------------------------------------------------------
// Minutes.
// ---------------------------------------------------------------------------

assert.deepEqual(parseMinutes('30'), { op: '=', minutes: 30 })
assert.deepEqual(parseMinutes('>30'), { op: '>', minutes: 30 })
assert.deepEqual(parseMinutes('<30'), { op: '<', minutes: 30 })
for (const junk of ['', 'abc', '>', '3.5', '-5']) {
  assert.equal(parseMinutes(junk), undefined, junk)
}
console.log('ok  minutes read with or without a comparison')

const timed = entry({ actualMinutes: 90, estimatedMinutes: 20 })
assert.ok(matches(timed, parseQuery('took:>60', now)))
assert.ok(!matches(timed, parseQuery('took:<60', now)))
assert.ok(matches(timed, parseQuery('took:90', now)))
assert.ok(matches(timed, parseQuery('est:<30', now)))
console.log('ok  time taken and time estimated filter separately')

// Blank is not zero: an unrecorded field satisfies no comparison at all.
const untimed = entry({ actualMinutes: null })
for (const query of ['took:>0', 'took:<9999', 'took:0']) {
  assert.ok(!matches(untimed, parseQuery(query, now)), query)
}
console.log('ok  an unrecorded time is not treated as zero')

// ---------------------------------------------------------------------------
// Everything else the pages put on screen.
// ---------------------------------------------------------------------------

const located = entry({ location: 'Library West' })
assert.ok(matches(located, parseQuery('at:library', now)))
assert.ok(matches(located, parseQuery('location:west', now)))
assert.ok(!matches(located, parseQuery('at:home', now)))
console.log('ok  location filters')

// Free text reaches the course code and the location, so finding something
// does not require knowing which key it lives behind.
assert.ok(matches(located, parseQuery('library', now)))
assert.ok(matches(entry({ courseCode: 'MATH 220' }), parseQuery('math', now)))
console.log('ok  free text reaches the course code and the location')

// A journal day carries none of the new fields, and must still search.
const journal = entry({
  kind: 'journal',
  title: 'Tuesday',
  body: 'wrote the essay',
  location: undefined,
  completedAt: undefined,
  actualMinutes: undefined,
})
assert.ok(matches(journal, parseQuery('essay', now)))
assert.ok(!matches(journal, parseQuery('took:>1', now)))
assert.ok(!matches(journal, parseQuery('at:library', now)))
console.log('ok  an entry missing the new fields still searches')

// The history page's own kind of question, end to end.
const history = [
  entry({
    title: 'Essay',
    courseCode: 'ENGL 150',
    completedAt: at('2026-09-14T10:00:00'),
    actualMinutes: 120,
  }),
  entry({
    title: 'Essay',
    courseCode: 'ENGL 150',
    completedAt: at('2026-09-14T10:00:00'),
    actualMinutes: 15,
  }),
  entry({
    title: 'Essay',
    courseCode: 'ENGL 150',
    completedAt: at('2026-01-02T10:00:00'),
    actualMinutes: 120,
  }),
]
assert.equal(
  search(history, 'essay in:engl150 doneafter:-7d took:>60', now).length,
  1,
)
console.log('ok  the history filters stack')

console.log('\nsearch checks passed')
