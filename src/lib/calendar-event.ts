/**
 * Maps an item onto a Google Calendar event body.
 *
 * Pure and dependency free so scripts/check-calendar.ts can run it, and so the
 * two rules that are easy to get wrong stay in one testable place.
 */

export interface SyncableItem {
  name: string
  type: string
  /** 1 is most urgent through 5 is least. */
  priority: number
  dueAt: Date | null
  allDay: boolean
  location: string | null
  notes: string | null
}

export interface CalendarEventBody {
  summary: string
  description?: string
  location?: string
  start: { date?: string; dateTime?: string; timeZone?: string }
  end: { date?: string; dateTime?: string; timeZone?: string }
}

/** A deadline has no duration, and Google rejects an end at or before start. */
const TIMED_DURATION_MINUTES = 30

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date, not the UTC one, which differs after 6pm in Texas. */
export function localDateString(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

export function toCalendarEvent(
  item: SyncableItem,
  options: { courseLabel?: string | null; timeZone: string },
): CalendarEventBody | null {
  // Nothing without a due date belongs on a calendar.
  if (!item.dueAt) return null

  const details = [
    options.courseLabel,
    item.type,
    item.priority === 3 ? null : `priority ${item.priority}`,
    item.notes,
  ].filter(Boolean)

  const base = {
    summary: options.courseLabel
      ? `${options.courseLabel}: ${item.name}`
      : item.name,
    description: details.length ? details.join('\n') : undefined,
    location: item.location ?? undefined,
  }

  if (item.allDay) {
    // Google treats an all-day end.date as exclusive, so a one-day event ends
    // on the following day. Using the same date produces a zero-length event
    // that most clients simply do not draw.
    const next = new Date(item.dueAt)
    next.setDate(next.getDate() + 1)

    return {
      ...base,
      start: { date: localDateString(item.dueAt) },
      end: { date: localDateString(next) },
    }
  }

  const end = new Date(item.dueAt.getTime() + TIMED_DURATION_MINUTES * 60_000)

  return {
    ...base,
    start: { dateTime: item.dueAt.toISOString(), timeZone: options.timeZone },
    end: { dateTime: end.toISOString(), timeZone: options.timeZone },
  }
}
