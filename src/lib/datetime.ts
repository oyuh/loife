/**
 * One place that decides how a date or a time is written, everywhere.
 *
 * Before this, nine components each built their own `Intl.DateTimeFormat` with
 * `undefined` as the locale and no timezone, so the same instant read as
 * "Sep 15" in one list, "September 15" in another, and shifted by an hour or a
 * day depending on where the browser thought it was. All of it now comes from
 * here.
 *
 * The zone is pinned rather than taken from the browser. This is a single
 * person's school calendar, that person is on central time, and a due date
 * that reads 11pm on the laptop must not read 9pm on a phone that has been
 * carried to another state. `TZ` in the environment does the same for the
 * server; this is its client-side half, and the two have to name the same zone
 * or a server-rendered page would flip on hydration.
 *
 * Pure and dependency free, so scripts/check-datetime.ts can exercise it.
 */

/** Central time. Handles the CST/CDT switch itself, which a fixed offset cannot. */
export const DISPLAY_TIME_ZONE = 'America/Chicago'

/**
 * Fixed rather than `undefined`, which would follow the browser and turn
 * "Sep 15, 5:00 PM" into "15 Sept, 17:00" on a machine set to en-GB. The
 * copy around these strings is written in American English, so the dates are
 * too.
 */
const LOCALE = 'en-US'

const zoned = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: DISPLAY_TIME_ZONE })

/*
 * Built once at module load. Constructing an Intl formatter is the expensive
 * part, and a list of two hundred rows would otherwise build one per cell.
 */
const dayFormat = zoned({ weekday: 'short', month: 'short', day: 'numeric' })
const dayLongFormat = zoned({ weekday: 'long', month: 'long', day: 'numeric' })
const dayWithYearFormat = zoned({
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})
const monthDayFormat = zoned({ month: 'short', day: 'numeric' })
const clockFormat = zoned({ hour: 'numeric', minute: '2-digit' })
const clockSecondsFormat = zoned({
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})
const clockZoneFormat = zoned({
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
})
const partsFormat = zoned({
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export interface ZonedParts {
  year: number
  /** 1 through 12, not the 0 based month a Date carries. */
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/**
 * The wall clock reading in the display zone.
 *
 * `getHours()` and friends answer for wherever the machine happens to be, so
 * anything that needs to know which calendar day an instant falls on has to go
 * through the formatter instead.
 */
export function zonedParts(date: Date): ZonedParts {
  const found: Record<string, number> = {}
  for (const part of partsFormat.formatToParts(date)) {
    if (part.type !== 'literal') found[part.type] = Number(part.value)
  }
  return {
    year: found.year,
    month: found.month,
    day: found.day,
    // A 24 hour formatter writes midnight as hour 24 in some engines.
    hour: found.hour % 24,
    minute: found.minute,
    second: found.second,
  }
}

const MS_PER_DAY = 86_400_000

/** The civil date in the display zone, as an epoch, for subtracting days. */
function civilDayEpoch(date: Date): number {
  const { year, month, day } = zonedParts(date)
  return Date.UTC(year, month - 1, day)
}

/**
 * Whole calendar days from `from` to `to` in the display zone, ignoring the
 * clock. 11pm to 1am is one day apart, not zero, which is what makes
 * "tomorrow" mean tomorrow rather than "in 2 hours".
 */
export function calendarDaysApart(from: Date, to: Date): number {
  return Math.round((civilDayEpoch(to) - civilDayEpoch(from)) / MS_PER_DAY)
}

/** Both instants land on the same date in the display zone. */
export function isSameZonedDay(a: Date, b: Date): boolean {
  return civilDayEpoch(a) === civilDayEpoch(b)
}

/** `2026-09-15` in the display zone, which is the shape every date column uses. */
export function toDateKey(date: Date): string {
  const { year, month, day } = zonedParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** "Mon, Sep 15". The default for a row, a chip, or anywhere space is short. */
export function formatDay(date: Date): string {
  return dayFormat.format(date)
}

/** "Monday, September 15". For a page heading, where it can be read aloud. */
export function formatDayLong(date: Date): string {
  return dayLongFormat.format(date)
}

/** "Sep 15", when the weekday is already obvious from context. */
export function formatMonthDay(date: Date): string {
  return monthDayFormat.format(date)
}

/** "5:00 PM". */
export function formatClock(date: Date): string {
  return clockFormat.format(date)
}

/** "5:00:32 PM", for the tooltip that wants the seconds. */
export function formatClockWithSeconds(date: Date): string {
  return clockSecondsFormat.format(date)
}

/** "5:00:32 PM CDT", naming the zone so the pinning is visible rather than assumed. */
export function formatClockWithZone(date: Date): string {
  return clockZoneFormat.format(date)
}

/** "Monday, September 15, 2026 at 5:00:32 PM CDT". The whole truth, for a tooltip. */
export function formatFull(date: Date): string {
  return `${dayWithYearFormat.format(date)} at ${formatClockWithZone(date)}`
}

/**
 * "Mon, Sep 15" for an all-day item, "Mon, Sep 15 at 5:00 PM" for a timed one.
 *
 * An all-day item is stored as 23:59 so it sorts last within its day, and
 * printing that back as "at 11:59 PM" would be a time nobody typed.
 */
export function formatDayAndTime(date: Date, allDay: boolean): string {
  return allDay ? formatDay(date) : `${formatDay(date)} at ${formatClock(date)}`
}

const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, {
  // Turns -1 day into "yesterday" rather than "1 day ago", for the handful of
  // offsets English has a word for.
  numeric: 'auto',
})

const MINUTE = 60_000
const HOUR = 3_600_000

/**
 * "in 3 days", "2 hours ago", "just now".
 *
 * Under an hour it counts real elapsed time, because that is how a gap that
 * small is felt. Past that it switches to calendar days, so something due at
 * 9am tomorrow reads "tomorrow" at 8pm tonight instead of "in 13 hours".
 */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const ms = date.getTime() - now.getTime()
  const absolute = Math.abs(ms)

  if (absolute < 45 * 1000) return 'just now'

  if (absolute < HOUR) {
    return relativeFormat.format(Math.round(ms / MINUTE), 'minute')
  }

  const days = calendarDaysApart(now, date)

  // Same calendar day and more than an hour out, so hours is the honest unit.
  // "today" would be true and useless on something due in six hours.
  if (days === 0) return relativeFormat.format(Math.round(ms / HOUR), 'hour')

  if (Math.abs(days) < 7) return relativeFormat.format(days, 'day')
  if (Math.abs(days) < 28) {
    return relativeFormat.format(Math.trunc(days / 7), 'week')
  }
  if (Math.abs(days) < 365) {
    return relativeFormat.format(Math.trunc(days / 30), 'month')
  }
  return relativeFormat.format(Math.trunc(days / 365), 'year')
}

/**
 * The same thing with no direction: "3 days", "2 hours". For a label that
 * already says which way it is going, such as an overdue count.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/**
 * Everything known about one instant, which is what a tooltip shows: the full
 * date, the time down to the second, the zone, and how far off it is.
 */
export function formatPrecise(date: Date, now: Date = new Date()): string {
  return `${formatFull(date)} · ${formatRelative(date, now)}`
}

/*
 * Date-only values, which are a different thing to an instant.
 *
 * A `date` column holds a civil date with no time and no zone: the journal
 * entry for the 15th is the 15th everywhere. Turning one into a Date and
 * running it through a zoned formatter is how it becomes the 14th — local
 * midnight in London is 6pm the previous day in Chicago. So these parse to UTC
 * midnight and format in UTC, which leaves the digits exactly as written.
 */

const utc = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: 'UTC' })

const keyDayFormat = utc({ weekday: 'short', month: 'short', day: 'numeric' })
const keyDayLongFormat = utc({ weekday: 'long', month: 'long', day: 'numeric' })
const keyWeekdayFormat = utc({ weekday: 'long' })
const keyWeekdayShortFormat = utc({ weekday: 'short' })
const keyDayNumberFormat = utc({ day: 'numeric' })
const keyMonthFormat = utc({ month: 'long', year: 'numeric' })
const keyMonthDayFormat = utc({ month: 'short', day: 'numeric' })
const keyMonthDayYearFormat = utc({
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** `2026-09-15` as a Date at UTC midnight, the only safe anchor for a civil date. */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/** The inverse, reading the UTC parts back out. */
export function dateKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

/** Today's date in the display zone, as `2026-09-15`. */
export function todayKey(now: Date = new Date()): string {
  return toDateKey(now)
}

/** Whole days between two `2026-09-15` keys. */
export function dateKeysApart(from: string, to: string): number {
  return Math.round(
    (parseDateKey(to).getTime() - parseDateKey(from).getTime()) / MS_PER_DAY,
  )
}

/** `2026-09-15` shifted by whole days, staying a key. */
export function shiftDateKey(key: string, days: number): string {
  const shifted = parseDateKey(key)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return dateKeyOf(shifted)
}

/** 0 is Sunday through 6 is Saturday, matching `Date.getDay()`. */
export function weekdayOfKey(key: string): number {
  return parseDateKey(key).getUTCDay()
}

/** The Sunday on or before `key`, which is where a week grid starts. */
export function startOfWeekKey(key: string): string {
  return shiftDateKey(key, -weekdayOfKey(key))
}

/** "Tue, Sep 15" from `2026-09-15`. */
export function formatKeyDay(key: string): string {
  return keyDayFormat.format(parseDateKey(key))
}

/** "Tuesday, September 15" from `2026-09-15`. */
export function formatKeyDayLong(key: string): string {
  return keyDayLongFormat.format(parseDateKey(key))
}

/** "Sep 15" from `2026-09-15`. */
export function formatKeyMonthDay(key: string): string {
  return keyMonthDayFormat.format(parseDateKey(key))
}

/** "Sep 15, 2026". The year matters on a term start that is months away. */
export function formatKeyMonthDayYear(key: string): string {
  return keyMonthDayYearFormat.format(parseDateKey(key))
}

/** "Tuesday", for a date rail that prints the weekday under the number. */
export function formatKeyWeekday(key: string): string {
  return keyWeekdayFormat.format(parseDateKey(key))
}

/** "Tue", for a column heading in a week grid. */
export function formatKeyWeekdayShort(key: string): string {
  return keyWeekdayShortFormat.format(parseDateKey(key))
}

/** "15", the number on its own. */
export function formatKeyDayNumber(key: string): string {
  return keyDayNumberFormat.format(parseDateKey(key))
}

/** "September 2026", for a month heading. */
export function formatKeyMonth(key: string): string {
  return keyMonthFormat.format(parseDateKey(key))
}

/** "tomorrow", "in 3 days", counted in whole days between two civil dates. */
export function formatKeyRelative(key: string, now: Date = new Date()): string {
  const days = dateKeysApart(todayKey(now), key)
  if (days === 0) return 'today'
  if (Math.abs(days) < 7) return relativeFormat.format(days, 'day')
  if (Math.abs(days) < 28)
    return relativeFormat.format(Math.trunc(days / 7), 'week')
  if (Math.abs(days) < 365)
    return relativeFormat.format(Math.trunc(days / 30), 'month')
  return relativeFormat.format(Math.trunc(days / 365), 'year')
}
