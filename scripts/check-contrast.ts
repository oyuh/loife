/**
 * Checks the theme tokens clear their contrast floors.
 *
 * The palette is hand-picked from a VS Code theme, so nothing about it
 * guarantees legibility on its own. This reads the real tokens out of
 * styles.css rather than restating them, so editing a colour there and
 * breaking a pair fails here.
 *
 *   pnpm check:contrast
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const css = readFileSync(
  fileURLToPath(new URL('../src/styles.css', import.meta.url)),
  'utf8',
)

/** Every `--token: #rrggbb` in the file. Non-hex tokens are not checked. */
const tokens = new Map<string, string>()
for (const [, name, hex] of css.matchAll(
  /--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g,
)) {
  tokens.set(name, hex)
}

const token = (name: string) => {
  const hex = tokens.get(name)
  assert.ok(hex, `--${name} is missing from styles.css or is no longer a hex`)
  return hex
}

const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((at) => {
    const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** WCAG AA for body text. */
const TEXT = 4.5
/** WCAG AA for a control that carries meaning by colour alone. */
const NON_TEXT = 3

let failures = 0
const check = (floor: number, fg: string, bg: string, what: string) => {
  const ratio = contrast(token(fg), token(bg))
  const ok = ratio >= floor
  if (!ok) failures++
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${ratio.toFixed(2)}:1 (needs ${floor})  ${what}`,
  )
}

for (const ground of ['background', 'card', 'popover', 'secondary', 'muted']) {
  check(TEXT, 'foreground', ground, `body text on --${ground}`)
}
check(TEXT, 'accent-foreground', 'accent', 'accent text on --accent')
check(
  TEXT,
  'secondary-foreground',
  'secondary',
  'secondary text on --secondary',
)

// Descriptions and helper copy are real content, not decoration.
for (const ground of ['background', 'card']) {
  check(TEXT, 'muted-foreground', ground, `muted text on --${ground}`)
}

/*
 * Emphasis buttons paint a gradient that runs from --primary mixed towards
 * white down to flat --primary. Mixing towards white only ever lightens, and
 * the label is near-black, so the flat token is the darkest point of the
 * button and bounds the whole gradient. Checking it covers the gradient, the
 * hover state and the inset highlight without reimplementing oklch mixing.
 */
check(TEXT, 'primary-foreground', 'primary', 'button label on --primary')
check(
  TEXT,
  'primary-foreground',
  'destructive',
  'button label on --destructive',
)

// Both tokens are also used as bare text.
check(TEXT, 'primary', 'background', 'link text on --background')
for (const ground of ['background', 'card']) {
  check(TEXT, 'destructive', ground, `destructive text on --${ground}`)
}

/*
 * A switch says which state it is in by track colour alone, so the two tracks
 * have to be told apart at the non-text floor.
 */
check(NON_TEXT, 'primary', 'secondary', 'switch track, on against off')

assert.equal(failures, 0, `${failures} contrast pair(s) below the floor`)
console.log('\ncontrast checks passed')
