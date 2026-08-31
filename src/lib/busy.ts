/**
 * Turns Google's events into the periods the planner treats as taken.
 *
 * Pure and dependency free so scripts/check-plan.ts can exercise it, and
 * separate from google.server.ts because deciding what counts as busy is a
 * judgement worth testing, not plumbing.
 */

export interface BusyPeriod {
  start: Date
  end: Date
  label: string
}

export interface GoogleEvent {
  summary?: string
  status?: string
  transparency?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: { self?: boolean; responseStatus?: string }[]
}

/**
 * Events that genuinely occupy a stretch of the day.
 *
 * All-day events are left out. Birthdays, holidays and "on leave" markers are
 * nearly all of them, and treating one as a commitment would blank out the
 * whole day. Anything marked free in Google, and anything you declined, is
 * skipped for the same reason: it sits on the calendar without costing time.
 */
export function toBusyPeriods(events: GoogleEvent[]): BusyPeriod[] {
  const busy: BusyPeriod[] = []

  for (const event of events) {
    if (event.status === 'cancelled') continue
    if (event.transparency === 'transparent') continue
    if (!event.start?.dateTime || !event.end?.dateTime) continue

    const declined = event.attendees?.some(
      (guest) => guest.self && guest.responseStatus === 'declined',
    )
    if (declined) continue

    const start = new Date(event.start.dateTime)
    const end = new Date(event.end.dateTime)
    // A zero length event is a marker, not time spent.
    if (end <= start) continue

    busy.push({
      start,
      end,
      // Private events on a shared calendar come back without a title.
      label: event.summary ?? 'Busy',
    })
  }

  return busy.sort((a, b) => +a.start - +b.start)
}
