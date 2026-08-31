/**
 * Checks the command palette filter language.
 *
 *   pnpm check:search
 */
import assert from 'node:assert/strict'
import {
  matches,
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
  courseCode: 'MATH 2414',
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
assert.ok(matches(entry(), parseQuery('in:math2414', now)))
assert.ok(matches(entry(), parseQuery('course:MATH2414', now)))
assert.ok(!matches(entry(), parseQuery('in:cs2340', now)))
console.log('ok  course codes ignore spacing and case')

assert.ok(matches(entry({ type: 'exam' }), parseQuery('type:exam', now)))
assert.ok(!matches(entry(), parseQuery('type:exam', now)))
assert.ok(matches(entry({ priority: 1 }), parseQuery('p:1', now)))
assert.ok(!matches(entry(), parseQuery('p:1', now)))
assert.ok(matches(entry({ status: 'done' }), parseQuery('is:done', now)))
console.log('ok  type, priority, and status filter')

assert.ok(matches(entry({ hasAttachment: true }), parseQuery('has:file', now)))
assert.ok(!matches(entry(), parseQuery('has:file', now)))
assert.ok(matches(entry({ hasAttachment: true }), parseQuery('is:attached', now)))
console.log('ok  attachments filter')

// Dates take an ISO day or a relative word.
assert.ok(matches(entry(), parseQuery('before:2026-10-01', now)))
assert.ok(!matches(entry(), parseQuery('before:2026-09-01', now)))
assert.ok(matches(entry(), parseQuery('after:today', now)))
assert.ok(!matches(entry({ date: at('2026-09-14T09:00:00') }), parseQuery('after:today', now)))
console.log('ok  before and after take a date or a word')

// A dateless entry must not slip through a date filter.
assert.ok(!matches(entry({ date: null }), parseQuery('before:2026-10-01', now)))
assert.ok(!matches(entry({ date: null }), parseQuery('after:today', now)))
assert.ok(matches(entry({ date: null }), parseQuery('problem', now)))
console.log('ok  dateless entries drop out of date filters, not through them')

// Journal entries come back too, and can be isolated.
const mixed = [
  entry({ title: 'Problem set 6' }),
  entry({ kind: 'journal', title: 'Rough one', body: 'missed calc', date: at('2026-09-12T00:00:00'), courseCode: null, type: null, priority: null, status: null }),
]
assert.equal(search(mixed, 'kind:journal', now).length, 1)
assert.equal(search(mixed, 'kind:item', now).length, 1)
assert.equal(search(mixed, 'calc', now).length, 1, 'journal bodies are searched')
console.log('ok  journal entries are searchable and separable')

// Filters combine, which is the point of having them.
const many = [
  entry({ title: 'Essay', courseCode: 'RHET 1302', type: 'assignment', priority: 1, hasAttachment: true }),
  entry({ title: 'Essay', courseCode: 'RHET 1302', type: 'assignment', priority: 3, hasAttachment: false }),
  entry({ title: 'Essay', courseCode: 'CS 2340', type: 'assignment', priority: 1, hasAttachment: true }),
]
assert.equal(search(many, 'essay in:rhet1302 p:1 has:file', now).length, 1)
console.log('ok  filters stack')

console.log('\nsearch checks passed')
