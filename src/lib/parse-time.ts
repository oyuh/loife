/**
 * Reads a typed time.
 *
 * People write a time half a dozen ways and mean the same thing, so `9:30`,
 * `930`, `9`, `9:30 pm` and `21:30` all land somewhere sensible rather than
 * being rejected for punctuation. Pure and dependency free, so
 * scripts/check-time.ts can exercise it.
 */

/** The wire format everywhere in this app, and what a time input reads. */
export const WIRE_TIME = 'HH:mm'

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * A typed time as `HH:mm`, or null when it makes no sense.
 *
 * Bare digits are read as 24 hour, since `1430` has no other reading, but a
 * trailing am or pm wins over that. `12am` is midnight and `12pm` is noon,
 * which is the one case where adding twelve gives the wrong answer both ways.
 */
export function parseTime(input: string): string | null {
  const text = input.trim().toLowerCase().replace(/[\s.]/g, '')
  if (!text) return null

  let meridiem: 'am' | 'pm' | null = null
  let digits = text

  if (text.endsWith('am') || text.endsWith('pm')) {
    meridiem = text.endsWith('am') ? 'am' : 'pm'
    digits = text.slice(0, -2)
  } else if (text.endsWith('a') || text.endsWith('p')) {
    meridiem = text.endsWith('a') ? 'am' : 'pm'
    digits = text.slice(0, -1)
  }

  // `930` backtracks to 9:30 rather than hour 93, because the minutes group
  // needs two digits and there is only one left over after a greedy hour.
  const match = /^(\d{1,2}):?(\d{2})?$/.exec(digits)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0

  if (minutes > 59) return null

  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    if (meridiem === 'pm' && hours !== 12) hours += 12
    if (meridiem === 'am' && hours === 12) hours = 0
  } else if (hours > 23) {
    return null
  }

  return `${pad(hours)}:${pad(minutes)}`
}

/** `14:30` as `2:30 PM`, for anywhere a time is read rather than edited. */
export function formatTime(value: string): string {
  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value

  const suffix = hours < 12 ? 'AM' : 'PM'
  const twelve = hours % 12 === 0 ? 12 : hours % 12
  return `${twelve}:${pad(minutes)} ${suffix}`
}

/** Every quarter hour, which is what nearly every class and meeting lands on. */
export function timeOptions(stepMinutes = 15): string[] {
  const options: string[] = []
  for (let minute = 0; minute < 24 * 60; minute += stepMinutes) {
    options.push(`${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`)
  }
  return options
}
