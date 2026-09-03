/**
 * Checks the course colour to Google colour mapping.
 *
 * Notion Calendar draws an event in whatever colour Google reports, and Google
 * only has eleven, so every colour a course can carry gets rounded to one of
 * them. This checks the rounding is sane: that the eleven land on themselves,
 * that the presets each claim a different one, and that the handful of hues
 * that are easy to get wrong go where a person would put them.
 *
 *   pnpm check:color
 */
import assert from 'node:assert/strict'
import {
  COURSE_COLORS,
  GOOGLE_EVENT_COLORS,
  nearestGoogleColor,
  parseHex,
} from '../src/lib/google-color.ts'

let failures = 0

const check = (ok: boolean, what: string) => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}`)
}

const nameOf = (hex: string) => nearestGoogleColor(hex)?.name ?? 'nothing'

console.log('Google palette maps to itself')
for (const color of GOOGLE_EVENT_COLORS) {
  check(
    nearestGoogleColor(color.hex)?.id === color.id,
    `${color.hex} is ${color.name}, got ${nameOf(color.hex)}`,
  )
}

console.log('\nEvery preset claims a different Google colour')
// This is the property that makes a preset exact rather than approximate: pick
// one and Notion draws that colour, with no rounding to notice.
const claimed = new Map<string, string>()
for (const hex of COURSE_COLORS) {
  const google = nearestGoogleColor(hex)
  assert.ok(google, `${hex} resolved to no Google colour at all`)

  const taken = claimed.get(google.name)
  check(!taken, `${hex} takes ${google.name}${taken ? `, already ${taken}` : ''}`)
  claimed.set(google.name, hex)
}
check(
  claimed.size === GOOGLE_EVENT_COLORS.length,
  `presets cover all ${GOOGLE_EVENT_COLORS.length} Google colours, covered ${claimed.size}`,
)

console.log('\nHues that are easy to get wrong')
// Pure blue is the reason the comparison uses CIEDE2000 rather than plain
// Lab distance: under CIE76 it comes out nearer Grape than Blueberry.
const expectations: [string, string, string][] = [
  ['#0000ff', 'Blueberry', 'pure blue is a blue, not a purple'],
  ['#000000', 'Graphite', 'black goes to the only grey'],
  ['#1e40af', 'Blueberry', 'a dark blue'],
  ['#22c55e', 'Sage', 'a mid green'],
  ['#a855f7', 'Grape', 'a purple'],
  ['#dc2626', 'Tomato', 'a mid red'],
  // Both of these look wrong for a second and are not. Google's only pure red
  // is Tomato, which is far darker than #ff0000, so a bright red reads closer
  // to Tangerine. Basil is a forest green, so a bright green reads closer to
  // Sage. Lightness is part of the colour, and both calls respect that.
  ['#ff0000', 'Tangerine', 'pure red, brighter than Tomato'],
  ['#00ff00', 'Sage', 'pure green, brighter than Basil'],
]
for (const [hex, expected, describes] of expectations) {
  check(nameOf(hex) === expected, `${describes}: ${hex} is ${nameOf(hex)}`)
}

console.log('\nColours that are not colours')
for (const bad of ['', 'var(--primary)', '#12345', 'rebeccapurple', '#gggggg']) {
  // Undefined is the point: the event body leaves colorId off and Google keeps
  // the calendar's own colour, rather than an arbitrary one being invented.
  check(
    nearestGoogleColor(bad) === null,
    `${bad || '(empty)'} resolves to no colour`,
  )
}
check(parseHex('#abc') !== null, 'a three digit hex still parses')

console.log(failures === 0 ? '\nall good' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
