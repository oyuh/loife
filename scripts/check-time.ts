/**
 * Checks the typed time parser.
 *
 *   pnpm check:time
 */
import assert from 'node:assert/strict'
import { formatTime, parseTime, timeOptions } from '../src/lib/parse-time.ts'

// The same time, written the six ways people actually write it.
for (const written of ['9:30', '930', '09:30', '9:30am', '9:30 AM', '9.30a']) {
  assert.equal(parseTime(written), '09:30', written)
}
console.log('ok  one time written six ways reads the same')

assert.equal(parseTime('9'), '09:00')
assert.equal(parseTime('14'), '14:00')
console.log('ok  an hour on its own means the top of it')

// Bare digits are 24 hour, since 1430 has no other reading.
assert.equal(parseTime('1430'), '14:30')
assert.equal(parseTime('2359'), '23:59')
console.log('ok  bare digits read as 24 hour')

// Adding twelve gives the wrong answer at both ends of noon.
assert.equal(parseTime('12am'), '00:00')
assert.equal(parseTime('12pm'), '12:00')
assert.equal(parseTime('12:30am'), '00:30')
assert.equal(parseTime('1pm'), '13:00')
assert.equal(parseTime('11:59pm'), '23:59')
console.log('ok  midnight and noon survive the meridiem')

// A suffix wins over the 24 hour reading, so 9pm is not hour 9.
assert.equal(parseTime('9pm'), '21:00')
console.log('ok  a suffix beats the bare reading')

for (const junk of ['', '  ', 'lunch', '25:00', '9:75', '13pm', '0am', '99']) {
  assert.equal(parseTime(junk), null, junk)
}
console.log('ok  nonsense is rejected rather than guessed at')

assert.equal(formatTime('14:30'), '2:30 PM')
assert.equal(formatTime('00:00'), '12:00 AM')
assert.equal(formatTime('12:00'), '12:00 PM')
assert.equal(formatTime('09:05'), '9:05 AM')
console.log('ok  a stored time reads back in twelve hour')

// Anything the parser accepts has to survive the round trip.
for (const written of ['7:45am', '1615', '12pm', '23:59']) {
  const wire = parseTime(written)
  assert.ok(wire && parseTime(wire) === wire, written)
}
console.log('ok  parsing what was parsed changes nothing')

const options = timeOptions()
assert.equal(options.length, 96)
assert.equal(options[0], '00:00')
assert.equal(options.at(-1), '23:45')
assert.ok(options.every((option) => parseTime(option) === option))
console.log('ok  every quarter hour is offered and parses back')

console.log('\ntime parser checks passed')
