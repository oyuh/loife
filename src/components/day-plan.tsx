import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { type Busy, planDay } from '#/lib/plan-day'
import { coursesQuery } from '#/lib/queries'
import { busyPeriods, calendarStatus } from '#/server/calendar'
import type { CourseRow } from '#/server/courses'
import type { ItemRow } from '#/server/items'
import { studiedByItem } from '#/server/study'

const clock = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

function minutesLabel(value: number) {
  if (value < 60) return `${Math.round(value)}m`
  const hours = Math.floor(value / 60)
  const rest = Math.round(value % 60)
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

/**
 * A class meeting today, if it meets today at all.
 *
 * Read from the courses already loaded rather than fetched from Google, so a
 * plan costs nothing extra and works even when the calendar is not connected.
 */
function meetingToday(course: CourseRow, day: Date): Busy | null {
  if (!course.active || !course.startTime || !course.endTime) return null
  if (!course.days?.includes(day.getDay())) return null

  const at = (hhmm: string) => {
    const [hours, minutes] = hhmm.split(':').map(Number)
    const result = new Date(day)
    result.setHours(hours ?? 0, minutes ?? 0, 0, 0)
    return result
  }

  return {
    start: at(course.startTime),
    end: at(course.endTime),
    label: course.code ?? course.name,
  }
}

/**
 * Suggests an order and a time for today's work.
 *
 * Nothing here writes anything. It reads your free hours, subtracts classes,
 * and lays the most urgent work into what is left, which is a suggestion you
 * can ignore rather than a schedule that moves your due dates.
 */
export function DayPlan({ items }: { items: ItemRow[] }) {
  const [open, setOpen] = useState(false)
  const { data: courses = [] } = useQuery(coursesQuery)
  const { data: prefs } = useQuery({
    queryKey: ['calendar-status'],
    queryFn: () => calendarStatus(),
  })
  const { data: studied = {} } = useQuery({
    queryKey: ['studied-by-item'],
    queryFn: () => studiedByItem(),
  })

  // The day being planned, worked out once so the query key stays stable
  // across renders instead of refetching on every tick.
  const range = useMemo(() => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setDate(to.getDate() + 1)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [])

  const { data: events = [] } = useQuery({
    queryKey: ['busy', range.from],
    queryFn: () => busyPeriods({ data: range }),
    enabled: Boolean(prefs?.connected),
    // A dentist appointment booked five minutes ago can wait five minutes.
    staleTime: 5 * 60_000,
  })

  const busy = useMemo(() => {
    const now = new Date()
    return [
      ...courses
        .map((course) => meetingToday(course, now))
        .filter((slot): slot is Busy => slot !== null),
      ...events,
    ].sort((a, b) => +a.start - +b.start)
  }, [courses, events])

  const plan = useMemo(() => {
    const now = new Date()

    return planDay({
      day: now,
      dayStart: (prefs?.dayStart ?? '09:00').slice(0, 5),
      dayEnd: (prefs?.dayEnd ?? '22:00').slice(0, 5),
      breakMinutes: prefs?.breakMinutes ?? 10,
      busy,
      // Preparation already done comes off what today asks for.
      items: items.map((item) => ({
        ...item,
        studiedMinutes: studied[item.id] ?? 0,
      })),
      now,
    })
  }, [busy, items, prefs, studied])

  const needEstimates = plan.unplaced.filter((u) => u.reason === 'no estimate')
  const noRoom = plan.unplaced.filter((u) => u.reason === 'no room')

  return (
    <Collapsible
      className="mb-8 rounded-lg border border-border"
      onOpenChange={setOpen}
      open={open}
    >
      <CollapsibleTrigger className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
        <Sparkles aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-sm">Plan my day</span>
          <span className="block text-muted-foreground text-xs">
            {minutesLabel(plan.freeMinutes)} free · {plan.blocks.length} to
            schedule
          </span>
        </span>
        <span className="shrink-0 text-muted-foreground text-xs">
          {open ? 'Hide' : 'Show'}
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 border-border border-t px-4 py-4">
        {plan.blocks.length > 0 ? (
          <ol className="space-y-2">
            {plan.blocks.map((block) => (
              <li
                className="flex items-baseline gap-3 text-sm"
                key={`${block.item.id}-${+block.start}`}
              >
                <span className="w-28 shrink-0 text-muted-foreground tabular-nums">
                  {clock.format(block.start)} – {clock.format(block.end)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {block.kind === 'study' && (
                    <span className="text-primary">Study · </span>
                  )}
                  {block.item.name}
                </span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {minutesLabel(block.item.estimatedMinutes ?? 0)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground text-sm">
            Nothing to schedule. Give some work a time estimate and it will
            appear here.
          </p>
        )}

        {needEstimates.length > 0 && (
          <p className="text-muted-foreground text-xs">
            {needEstimates.length} without an estimate, so nothing could be set
            aside for them:{' '}
            {needEstimates
              .slice(0, 4)
              .map((u) => u.item.name)
              .join(', ')}
            {needEstimates.length > 4 ? '…' : ''}
          </p>
        )}

        {noRoom.length > 0 && (
          <p className="flex items-start gap-2 text-muted-foreground text-xs">
            <CalendarClock
              aria-hidden="true"
              className="mt-0.5 size-3 shrink-0"
            />
            <span>
              {noRoom.length} would not fit in the hours left today. Widen your
              day in Settings, or move them.
            </span>
          </p>
        )}

        {busy.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Working around{' '}
            {busy
              .map(
                (slot) =>
                  `${slot.label} ${clock.format(slot.start)}–${clock.format(slot.end)}`,
              )
              .join(', ')}
            .
          </p>
        )}

        <p className="text-muted-foreground text-xs">
          Suggestions only. Nothing here changes a due date or touches your
          calendar.
          {prefs?.connected === false &&
            ' Connect Google Calendar in Settings and it will plan around what is already booked.'}
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}
