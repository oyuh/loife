/**
 * Turns pasted syllabus lines into draft items.
 *
 * Syllabi arrive as text, one deadline per line, in whatever shape the
 * lecturer felt like. This reads the common ones and hands back a draft that
 * the preview table lets you correct, so a wrong guess costs an edit rather
 * than a bad row.
 *
 * Pure and dependency free, which is what lets scripts/check-syllabus.ts run it.
 */

export interface ParsedLine {
  /** The original line, so the preview can show what it came from. */
  raw: string
  name: string
  dueAt: Date | null
  allDay: boolean
}

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length)

const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/
const MONTH_DAY = new RegExp(
  `\\b(${MONTH_NAMES.join('|')})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`,
  'i',
)
// Requires the slash so a bare "6" in "Problem set 6" is never read as a date.
const NUMERIC = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/

const TWELVE_HOUR = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/i
const TWENTY_FOUR_HOUR = /\b(\d{1,2}):(\d{2})\b/

/** Six months back, so an August syllabus listing January means next January. */
const BACKDATE_TOLERANCE_DAYS = 180

function inferYear(month: number, day: number, now: Date): number {
  const candidate = new Date(now.getFullYear(), month, day)
  const daysBehind = (now.getTime() - candidate.getTime()) / 86_400_000
  return daysBehind > BACKDATE_TOLERANCE_DAYS
    ? now.getFullYear() + 1
    : now.getFullYear()
}

interface DateMatch {
  year: number
  month: number
  day: number
  matched: string
}

function findDate(line: string, now: Date): DateMatch | null {
  const iso = ISO.exec(line)
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]) - 1,
      day: Number(iso[3]),
      matched: iso[0],
    }
  }

  const named = MONTH_DAY.exec(line)
  if (named) {
    const month = MONTHS[named[1].toLowerCase()]
    const day = Number(named[2])
    return {
      year: named[3] ? Number(named[3]) : inferYear(month, day, now),
      month,
      day,
      matched: named[0],
    }
  }

  const numeric = NUMERIC.exec(line)
  if (numeric) {
    const month = Number(numeric[1]) - 1
    const day = Number(numeric[2])
    if (month < 0 || month > 11 || day < 1 || day > 31) return null

    let year = numeric[3] ? Number(numeric[3]) : inferYear(month, day, now)
    if (year < 100) year += 2000

    return { year, month, day, matched: numeric[0] }
  }

  return null
}

interface TimeMatch {
  hours: number
  minutes: number
  matched: string
}

function findTime(line: string): TimeMatch | null {
  const twelve = TWELVE_HOUR.exec(line)
  if (twelve) {
    let hours = Number(twelve[1]) % 12
    if (twelve[3].toLowerCase() === 'p') hours += 12
    return { hours, minutes: Number(twelve[2] ?? 0), matched: twelve[0] }
  }

  const twentyFour = TWENTY_FOUR_HOUR.exec(line)
  if (twentyFour) {
    const hours = Number(twentyFour[1])
    const minutes = Number(twentyFour[2])
    if (hours > 23 || minutes > 59) return null
    return { hours, minutes, matched: twentyFour[0] }
  }

  return null
}

/** Strips the separators left behind once the date is removed. */
function cleanName(value: string): string {
  return value
    .replace(/\b(due|by|on|at)\b/gi, ' ')
    .replace(/[\s\-–—,:;|]+$/g, '')
    .replace(/^[\s\-–—,:;|]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function parseSyllabusLine(raw: string, now: Date): ParsedLine | null {
  const line = raw.trim()
  if (!line) return null

  const date = findDate(line, now)
  if (!date) {
    // Keep it. A line with no date is still something to do, and the preview
    // lets a date be filled in by hand.
    return { raw, name: cleanName(line), dueAt: null, allDay: true }
  }

  // The time is searched in what is left, so the date's own digits cannot be
  // mistaken for a clock.
  const withoutDate = line.replace(date.matched, ' ')
  const time = findTime(withoutDate)

  const dueAt = new Date(
    date.year,
    date.month,
    date.day,
    time?.hours ?? 23,
    time?.minutes ?? 59,
    0,
    0,
  )

  const name = cleanName(
    time ? withoutDate.replace(time.matched, ' ') : withoutDate,
  )

  return { raw, name, dueAt, allDay: !time }
}

export function parseSyllabus(
  text: string,
  now: Date = new Date(),
): ParsedLine[] {
  return text
    .split('\n')
    .map((line) => parseSyllabusLine(line, now))
    .filter(
      (parsed): parsed is ParsedLine => parsed !== null && parsed.name !== '',
    )
}
