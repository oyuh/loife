/**
 * Checks the line a journal log writes.
 *
 * The bug this exists to catch is invisible in the string and only shows up
 * once markdown renders it, so the separator is asserted rather than eyeballed.
 *
 *   pnpm check:journal
 */
import assert from 'node:assert/strict'
import { LOG_SEPARATOR, logLine } from '../src/lib/journal-line.ts'

// 4:07:12 PM in Chicago, which is the zone every readout is pinned to.
const at = new Date('2026-09-01T21:07:12Z')
const today = '2026-09-01'

const line = logLine('rewrote the intro', at, { date: today, today })
assert.equal(line, '**4:07:12 PM** · rewrote the intro')
console.log('ok  today gets the clock, down to the second')

const backfilled = logLine('went to office hours', at, {
  date: '2026-08-31',
  today,
})
assert.equal(backfilled, '**Sep 1, 4:07:12 PM** · went to office hours')
console.log('ok  another day carries the date it was actually written')

// A single newline is the whole bug: markdown folds it into the paragraph
// above and the day comes back as one run-on sentence.
assert.equal(LOG_SEPARATOR, '\n\n')
const body = [line, backfilled].join(LOG_SEPARATOR)
assert.equal(body.split('\n\n').length, 2)
assert.ok(!/[^\n]\n[^\n]/.test(body), 'no lone newline between entries')
console.log('ok  two entries stay two paragraphs')

// Markdown a person typed survives, since the stamp only leads the line.
assert.equal(
  logLine('**done** with `parse.ts`', at, { date: today, today }),
  '**4:07:12 PM** · **done** with `parse.ts`',
)
console.log('ok  the text keeps its own formatting')

console.log('\njournal checks passed')
