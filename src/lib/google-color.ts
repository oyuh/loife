/**
 * Maps a course colour onto a Google Calendar event colour.
 *
 * Notion Calendar draws an event in whatever colour Google reports for it, so
 * this is the only lever that reaches Notion. Google does not take a hex. It
 * takes one of eleven fixed `colorId` values, which is the whole reason a
 * nearest match exists at all: any hex you pick here lands on the closest of
 * the eleven, and that is as close as the API allows.
 *
 * Pure and dependency free so scripts/check-color.ts can run it.
 */

export interface GoogleEventColor {
  /** What Google calls it in the event body. */
  id: string
  /** What Google Calendar's own UI names it. */
  name: string
  hex: string
}

/**
 * Google's event palette, as returned by `GET /colors` under `event`.
 *
 * Hardcoded rather than fetched. It has not changed in the life of the v3 API,
 * a request per sync to learn eleven constants is a poor trade, and a pure
 * table is what lets the nearest match be tested without a network or a token.
 */
export const GOOGLE_EVENT_COLORS: GoogleEventColor[] = [
  { id: '1', name: 'Lavender', hex: '#7986cb' },
  { id: '2', name: 'Sage', hex: '#33b679' },
  { id: '3', name: 'Grape', hex: '#8e24aa' },
  { id: '4', name: 'Flamingo', hex: '#e67c73' },
  { id: '5', name: 'Banana', hex: '#f6bf26' },
  { id: '6', name: 'Tangerine', hex: '#f4511e' },
  { id: '7', name: 'Peacock', hex: '#039be5' },
  { id: '8', name: 'Graphite', hex: '#616161' },
  { id: '9', name: 'Blueberry', hex: '#3f51b5' },
  { id: '10', name: 'Basil', hex: '#0b8043' },
  { id: '11', name: 'Tomato', hex: '#d50000' },
]

/**
 * The colours a course is offered as a one-tap choice.
 *
 * Eleven of them, each landing on a different one of Google's eleven. That is
 * the whole design: pick a preset and Notion Calendar draws exactly that
 * colour, with no rounding to notice. A custom colour still works, it just
 * gets rounded to whichever of the eleven sits nearest.
 *
 * scripts/check-color.ts fails if two of these ever collide on one Google
 * colour, which is what keeps the property true as the list is edited.
 */
export const COURSE_COLORS = [
  '#4f46e5',
  '#818cf8',
  '#0ea5e9',
  '#22c55e',
  '#15803d',
  '#eab308',
  '#f97316',
  '#dc2626',
  '#ec4899',
  '#a855f7',
  '#78716c',
]

/** `#abc` and `#aabbcc`, with or without the hash. */
export function parseHex(value: string): [number, number, number] | null {
  const raw = value.trim().replace(/^#/, '')

  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null

  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ]
}

/**
 * sRGB to CIE Lab, through XYZ under a D65 white point.
 *
 * The comparison happens in Lab rather than RGB because RGB distance does not
 * track what an eye calls similar: pure blue and pure green sit the same
 * distance apart as two blues you could not tell apart. Lab is built so that
 * distance means perceived difference, which is exactly the question being
 * asked when picking the closest of eleven.
 */
function toLab(rgb: [number, number, number]): [number, number, number] {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })

  // D65 reference white, scaled to the same range as the matrix output.
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 1.0
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883

  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29

  const [fx, fy, fz] = [f(x), f(y), f(z)]

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

const rad = (degrees: number) => (degrees * Math.PI) / 180

/** atan2 in degrees, wrapped to 0-360 the way the formula expects. */
function hueAngle(a: number, b: number): number {
  if (a === 0 && b === 0) return 0
  const angle = (Math.atan2(b, a) * 180) / Math.PI
  return angle < 0 ? angle + 360 : angle
}

/**
 * CIEDE2000 difference.
 *
 * Straight Euclidean distance in Lab is the obvious thing and it gets blue
 * wrong: `#0000ff` comes out nearer Grape than Blueberry, because Lab's hue
 * spacing is not uniform in the blues. CIEDE2000 carries a rotation term for
 * exactly that region, which is why the extra arithmetic earns its place here
 * rather than being a flourish.
 */
function difference(
  [l1, a1, b1]: [number, number, number],
  [l2, a2, b2]: [number, number, number],
): number {
  const c1 = Math.hypot(a1, b1)
  const c2 = Math.hypot(a2, b2)
  const cBar = (c1 + c2) / 2

  // Pulls the a axis out where chroma is low, so near-greys compare sanely.
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)))
  const a1p = (1 + g) * a1
  const a2p = (1 + g) * a2

  const c1p = Math.hypot(a1p, b1)
  const c2p = Math.hypot(a2p, b2)
  const h1p = hueAngle(a1p, b1)
  const h2p = hueAngle(a2p, b2)

  const dLp = l2 - l1
  const dCp = c2p - c1p

  let dhp = 0
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(rad(dhp) / 2)

  const lBar = (l1 + l2) / 2
  const cBarP = (c1p + c2p) / 2

  let hBar = h1p + h2p
  if (c1p * c2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hBar = (h1p + h2p) / 2
    else if (h1p + h2p < 360) hBar = (h1p + h2p + 360) / 2
    else hBar = (h1p + h2p - 360) / 2
  }

  const t =
    1 -
    0.17 * Math.cos(rad(hBar - 30)) +
    0.24 * Math.cos(rad(2 * hBar)) +
    0.32 * Math.cos(rad(3 * hBar + 6)) -
    0.2 * Math.cos(rad(4 * hBar - 63))

  const sL = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2)
  const sC = 1 + 0.045 * cBarP
  const sH = 1 + 0.015 * cBarP * t

  // The blue correction. Only meaningful around 275 degrees, zero elsewhere.
  const dTheta = 30 * Math.exp(-(((hBar - 275) / 25) ** 2))
  const rC = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7))
  const rT = -Math.sin(rad(2 * dTheta)) * rC

  const kL = dLp / sL
  const kC = dCp / sC
  const kH = dHp / sH

  return Math.sqrt(kL ** 2 + kC ** 2 + kH ** 2 + rT * kC * kH)
}

/**
 * The Google colour a hex should be drawn as.
 *
 * Returns undefined for a missing or unparseable colour, which is the shape
 * the event body wants: leaving `colorId` off means "use the calendar's own
 * colour", the behaviour every event had before any of this existed.
 */
export function nearestGoogleColorId(
  hex: string | null | undefined,
): string | undefined {
  if (!hex) return undefined

  const rgb = parseHex(hex)
  if (!rgb) return undefined

  const target = toLab(rgb)

  let best = GOOGLE_EVENT_COLORS[0]
  let bestDistance = Number.POSITIVE_INFINITY

  for (const candidate of GOOGLE_EVENT_COLORS) {
    // Every entry in the table is a valid six digit hex, so the parse holds.
    const distance = difference(
      target,
      toLab(parseHex(candidate.hex) as [number, number, number]),
    )
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }

  return best.id
}

/** The palette entry a hex resolves to, for showing the name in the UI. */
export function nearestGoogleColor(
  hex: string | null | undefined,
): GoogleEventColor | null {
  const id = nearestGoogleColorId(hex)
  return GOOGLE_EVENT_COLORS.find((color) => color.id === id) ?? null
}
