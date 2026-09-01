import { type ReactNode, useState } from 'react'
import {
  KiboTooltip,
  KiboTooltipContent,
  KiboTooltipRow,
  KiboTooltipTitle,
  KiboTooltipTrigger,
} from '#/components/kibo-ui/tooltip'
import { COARSE_PRECISION, SECOND_PRECISION, useClock } from '#/lib/clock'
import {
  DISPLAY_TIME_ZONE,
  formatClock,
  formatClockWithSeconds,
  formatDay,
  formatDayAndTime,
  formatDayLong,
  formatFull,
  formatRelative,
} from '#/lib/datetime'
import { cn } from '#/lib/utils'

/**
 * Every date and time on the site goes through here.
 *
 * The visible text is the short reading — "Tue, Sep 15 at 5:00 PM" — and the
 * tooltip carries what does not fit: the year, the seconds, the zone, and how
 * far away it is. That split is deliberate. Hover is not available on a phone
 * and is invisible to a screen reader, so nothing that matters may live only
 * in the tooltip; it holds precision, never meaning.
 */

function PreciseTooltip({
  value,
  children,
  className,
}: {
  value: Date
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // Seconds only matter while the panel is on screen, and the shared clock
  // stops entirely once the last tooltip closes.
  const now = useClock(open ? SECOND_PRECISION : COARSE_PRECISION)

  return (
    <KiboTooltip onOpenChange={setOpen} open={open}>
      <KiboTooltipTrigger asChild>
        {/*
          A plain span: not focusable, no click handler, nothing to tap.

          Two reasons. Most of these sit inside a row that is already one big
          button, and neither a button nor a tab stop nests inside a button
          without breaking it. And a list of forty rows would otherwise add
          forty tab stops between the user and the thing they were reaching
          for.

          That makes the tooltip a pointer affordance only, which is why
          nothing lives in it that is not also somewhere else: the date and time
          are already written on the row, and the detail sheet behind it spells
          them out in full. The tooltip adds precision, not information.
        */}
        <span className={cn('cursor-help underline-offset-4', className)}>
          {children}
        </span>
      </KiboTooltipTrigger>

      <KiboTooltipContent className="space-y-1">
        <KiboTooltipTitle>{formatDayLong(value)}</KiboTooltipTitle>
        <KiboTooltipRow label="Time">
          {formatClockWithSeconds(value)}
        </KiboTooltipRow>
        <KiboTooltipRow label="Zone">{ZONE_LABEL}</KiboTooltipRow>
        <KiboTooltipRow label={value > (now ?? value) ? 'Due' : 'Was'}>
          {now ? formatRelative(value, now) : '—'}
        </KiboTooltipRow>
      </KiboTooltipContent>
    </KiboTooltip>
  )
}

/** "Central" reads better in a tooltip than "America/Chicago" does. */
const ZONE_LABEL = `Central · ${DISPLAY_TIME_ZONE.split('/')[1].replace('_', ' ')}`

export interface DateTimeProps {
  value: Date
  className?: string
}

/**
 * "Tue, Sep 15 at 5:00 PM", or just the day when the item is all-day, since an
 * all-day due date is stored at 23:59 and printing that back is a time nobody
 * chose.
 */
export function DateTimeText({
  value,
  allDay = false,
  className,
}: DateTimeProps & { allDay?: boolean }) {
  return (
    <PreciseTooltip className={className} value={value}>
      {formatDayAndTime(value, allDay)}
    </PreciseTooltip>
  )
}

/** "Tue, Sep 15". */
export function DayText({ value, className }: DateTimeProps) {
  return (
    <PreciseTooltip className={className} value={value}>
      {formatDay(value)}
    </PreciseTooltip>
  )
}

/** "5:00 PM". */
export function ClockText({ value, className }: DateTimeProps) {
  return (
    <PreciseTooltip className={className} value={value}>
      {formatClock(value)}
    </PreciseTooltip>
  )
}

/**
 * "Tue, Sep 15 · in 3 days".
 *
 * The relative half appears on the client only, so the two renders cannot
 * disagree about what time it is. It lands on hydration, a frame after paint.
 */
export function DayWithRelative({
  value,
  allDay = false,
  className,
}: DateTimeProps & { allDay?: boolean }) {
  const now = useClock(COARSE_PRECISION)

  return (
    <PreciseTooltip className={className} value={value}>
      {formatDayAndTime(value, allDay)}
      {now && (
        <span className="ml-1.5 text-muted-foreground">
          {formatRelative(value, now)}
        </span>
      )}
    </PreciseTooltip>
  )
}

/**
 * "in 3 days" on its own, for a column that has already said which date it is
 * talking about. Falls back to the date until the clock is available, so the
 * space is never empty.
 */
export function RelativeText({ value, className }: DateTimeProps) {
  const now = useClock(COARSE_PRECISION)

  return (
    <PreciseTooltip className={className} value={value}>
      {now ? formatRelative(value, now) : formatDay(value)}
    </PreciseTooltip>
  )
}

/** The full sentence, with no tooltip, for a place that has room for it. */
export function preciseLabel(value: Date): string {
  return formatFull(value)
}
