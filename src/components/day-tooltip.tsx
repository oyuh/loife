import type { ReactNode } from 'react'
import {
  KiboTooltip,
  KiboTooltipContent,
  KiboTooltipDescription,
  KiboTooltipRow,
  KiboTooltipTitle,
  KiboTooltipTrigger,
} from '#/components/kibo-ui/tooltip'
import { COARSE_PRECISION, useClock } from '#/lib/clock'
import { trimSeconds } from '#/lib/course-event'
import { formatKeyDayLong, formatKeyRelative } from '#/lib/datetime'
import { formatTime } from '#/lib/parse-time'
import type { CourseRow } from '#/server/courses'
import type { ItemRow } from '#/server/items'

/**
 * What a day holds, for a cell that only had room for a number and a dot.
 *
 * The sibling of `PreciseTooltip` in `date-time.tsx`: that one takes an
 * instant and adds precision, this one takes a civil date and adds contents.
 * Both follow the same rule — hover is not available on a phone and is
 * invisible to a screen reader, so nothing lives in here that is not also
 * reachable another way. Every calendar cell already opens a day panel, and
 * the week strip already names what it has room for.
 */

/** Past this many the panel becomes a list of its own, so the rest count. */
const MAX_ROWS = 4

/** "9:00 AM – 9:50 AM", or just that it meets when no times are set. */
function meetingTime(course: CourseRow): string {
  const start = trimSeconds(course.startTime)
  if (!start) return 'Meets'
  const end = trimSeconds(course.endTime)
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start)
}

export function DayTooltip({
  dayKey,
  meetings = [],
  due = [],
  done = [],
  children,
}: {
  /** A civil date, `2026-09-06`. */
  dayKey: string
  meetings?: CourseRow[]
  due?: ItemRow[]
  done?: ItemRow[]
  children: ReactNode
}) {
  // Day granularity, but still off the shared clock rather than off a bare
  // `new Date()`, so a page left open across midnight stops saying "today".
  const now = useClock(COARSE_PRECISION)

  return (
    <KiboTooltip>
      <KiboTooltipTrigger asChild>{children}</KiboTooltipTrigger>

      <KiboTooltipContent className="space-y-1">
        <KiboTooltipTitle>{formatKeyDayLong(dayKey)}</KiboTooltipTitle>
        <KiboTooltipRow label="When">
          {now ? formatKeyRelative(dayKey, now) : '—'}
        </KiboTooltipRow>

        {/* A class is a name and a time, which is what a labelled row is. */}
        {meetings.slice(0, MAX_ROWS).map((course) => (
          <KiboTooltipRow key={course.id} label={course.code ?? course.name}>
            {meetingTime(course)}
          </KiboTooltipRow>
        ))}
        {meetings.length > MAX_ROWS && (
          <KiboTooltipDescription>
            and {meetings.length - MAX_ROWS} more classes
          </KiboTooltipDescription>
        )}

        {/* Work is a list of names, so it reads as one under a count. */}
        {due.length > 0 && (
          <>
            <KiboTooltipRow label="Due">{due.length}</KiboTooltipRow>
            {due.slice(0, MAX_ROWS).map((item) => (
              <KiboTooltipDescription className="truncate" key={item.id}>
                {item.name}
              </KiboTooltipDescription>
            ))}
            {due.length > MAX_ROWS && (
              <KiboTooltipDescription>
                and {due.length - MAX_ROWS} more
              </KiboTooltipDescription>
            )}
          </>
        )}

        {done.length > 0 && (
          <KiboTooltipRow label="Finished">{done.length}</KiboTooltipRow>
        )}
      </KiboTooltipContent>
    </KiboTooltip>
  )
}
