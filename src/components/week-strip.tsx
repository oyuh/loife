import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DayTooltip } from '#/components/day-tooltip'
import { DayDetail } from '#/components/schedule-calendar'
import { Button } from '#/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '#/components/ui/drawer'
import { meetsOnKey, weekKeys } from '#/lib/course-schedule'
import {
  formatKeyDayLong,
  formatKeyMonthDay,
  formatKeyWeekdayShort,
  shiftDateKey,
  toDateKey,
  todayKey,
} from '#/lib/datetime'
import { useMediaQuery } from '#/lib/use-media-query'
import { cn } from '#/lib/utils'
import type { CourseRow } from '#/server/courses'
import type { ItemRow } from '#/server/items'

/** Past this many the cell is a wall of text, so the rest become a count. */
const MAX_NAMED = 3

/**
 * The week across every course at once, which is the view the courses page was
 * missing: a list of classes tells you what you are taking, and this tells you
 * what Wednesday looks like.
 *
 * Seven columns on a desktop and a scrolling row on a phone, because squeezing
 * seven readable columns into 360px produces seven unreadable ones.
 */
export function WeekStrip({
  courses,
  items,
  /**
   * Name the work rather than counting it. Today has the room and the reason;
   * the courses page is a list of classes and a count reads better there.
   */
  detailed = false,
}: {
  courses: CourseRow[]
  items: ItemRow[]
  detailed?: boolean
}) {
  const today = todayKey()
  const [anchor, setAnchor] = useState(today)
  const keys = useMemo(() => weekKeys(anchor), [anchor])
  const rail = useRef<HTMLDivElement>(null)
  const isDesktop = useMediaQuery('(min-width: 640px)')

  /** The day whose drawer is open, on a phone. Null when nothing is open. */
  const [openKey, setOpenKey] = useState<string | null>(null)
  const list = useRef<HTMLDivElement>(null)

  /** Meetings, due work and finished work for each day of the week on screen. */
  const week = useMemo(() => {
    const dueByKey = new Map<string, ItemRow[]>()
    const doneByKey = new Map<string, ItemRow[]>()
    for (const item of items) {
      if (!item.dueAt) continue
      const key = toDateKey(item.dueAt)
      const into = item.status === 'done' ? doneByKey : dueByKey
      const existing = into.get(key)
      if (existing) existing.push(item)
      else into.set(key, [item])
    }

    return keys.map((key) => ({
      key,
      meetings: courses
        .filter((course) => course.active && meetsOnKey(course, key))
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
      due: dueByKey.get(key) ?? [],
      // Only the drawer has room for what is already finished.
      done: doneByKey.get(key) ?? [],
    }))
  }, [courses, items, keys])

  const label = `${formatKeyMonthDay(keys[0])} – ${formatKeyMonthDay(keys[6])}`
  const isThisWeek = keys.includes(today)

  /*
   * Put today in the middle of the rail rather than leaving it off the right
   * edge. Only below `sm`, where the rail is the scrolling row; above it the
   * whole week is a grid with nothing to scroll.
   *
   * scrollLeft directly rather than scrollIntoView, which walks up the tree
   * and takes the page with it.
   */
  useEffect(() => {
    const element = rail.current
    if (!element) return

    const cell = element.querySelector<HTMLElement>('[data-today]')
    if (!cell || element.scrollWidth <= element.clientWidth) return

    element.scrollLeft =
      cell.offsetLeft - (element.clientWidth - cell.offsetWidth) / 2
  }, [])

  // Open the drawer on the day that was tapped rather than on Sunday. Measured
  // against the container rather than through `scrollIntoView`, for the same
  // reason as the rail above: that one walks up the tree and moves the page.
  useEffect(() => {
    const node = list.current
    if (!node || !openKey) return

    const target = node.querySelector<HTMLElement>('[data-open]')
    if (!target) return

    node.scrollTop +=
      target.getBoundingClientRect().top - node.getBoundingClientRect().top
  }, [openKey])

  return (
    <section>
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {isThisWeek ? 'This week' : 'Week of'}
        </h2>

        <div className="flex items-center gap-1">
          <Button
            aria-label="Previous week"
            className="size-9"
            onClick={() => setAnchor(shiftDateKey(anchor, -7))}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-28 text-center text-muted-foreground text-xs tabular-nums">
            {label}
          </span>
          <Button
            aria-label="Next week"
            className="size-9"
            onClick={() => setAnchor(shiftDateKey(anchor, 7))}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronRight />
          </Button>
          {!isThisWeek && (
            <Button
              className="min-h-9 px-2 text-xs"
              onClick={() => setAnchor(today)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Today
            </Button>
          )}
        </div>
      </header>

      {/*
        A scrolling row below sm and a grid above it. `snap` so a swipe lands
        on a day rather than halfway between two.

        The row scrolls inside the page's own gutters rather than bleeding to
        the screen edge. Full bleed reads as a carousel and looks fine on a
        marketing page, but here it put a card hard against the edge of the
        phone with the page's margin gone, and the strip read as wider than
        everything under it.
      */}
      <div
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-md sm:grid sm:grid-cols-7 sm:gap-1 sm:overflow-visible"
        ref={rail}
      >
        {week.map((day) => {
          const isToday = day.key === today
          const shell = cn(
            'shrink-0 snap-start rounded-md border border-border p-2 sm:w-auto',
            detailed ? 'w-[8.5rem]' : 'w-[6.5rem]',
            isToday ? 'bg-accent/60' : 'bg-card/40',
          )

          const contents = (
            <>
              <p
                className={cn(
                  'text-[10px] uppercase tracking-wide',
                  isToday ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {formatKeyWeekdayShort(day.key)}
              </p>
              <p
                className={cn(
                  'font-semibold text-lg leading-tight tabular-nums',
                  isToday && 'text-primary',
                )}
              >
                {Number(day.key.slice(-2))}
              </p>

              <div className="mt-1.5 space-y-1">
                {day.meetings.map((course) => (
                  <p
                    className="flex items-center gap-1 truncate text-[11px]"
                    key={course.id}
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: course.color ?? 'var(--primary)',
                      }}
                    />
                    <span className="truncate">
                      {course.code ?? course.name}
                    </span>
                  </p>
                ))}

                {detailed
                  ? day.due.slice(0, MAX_NAMED).map((item) => (
                      <p
                        className="flex items-start gap-1 text-[11px] leading-tight"
                        key={item.id}
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1 size-1 shrink-0 rounded-full bg-foreground"
                        />
                        <span className="line-clamp-2">{item.name}</span>
                      </p>
                    ))
                  : day.due.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        {day.due.length} due
                      </p>
                    )}

                {detailed && day.due.length > MAX_NAMED && (
                  <p className="text-[11px] text-muted-foreground">
                    and {day.due.length - MAX_NAMED} more
                  </p>
                )}

                {day.meetings.length === 0 && day.due.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/50">—</p>
                )}
              </div>
            </>
          )

          /*
           * A phone has no hover, so the panel the tooltip carries on a
           * desktop becomes something you tap for instead. The cell turns
           * into a real button rather than a div with a click handler, so it
           * is reachable by keyboard and announced as something to press.
           */
          if (!isDesktop) {
            return (
              <button
                aria-label={`${formatKeyDayLong(day.key)}, see the week`}
                className={cn(shell, 'text-left')}
                data-today={isToday ? '' : undefined}
                key={day.key}
                onClick={() => setOpenKey(day.key)}
                type="button"
              >
                {contents}
              </button>
            )
          }

          return (
            <DayTooltip
              dayKey={day.key}
              done={day.done}
              due={day.due}
              key={day.key}
              meetings={day.meetings}
            >
              <div className={cn(shell, 'cursor-help')}>{contents}</div>
            </DayTooltip>
          )
        })}
      </div>

      {/*
        The whole week in one scroll, opened at the day that was tapped.
        Every day rather than only that one, because the reason to open
        Wednesday is usually to find out whether Thursday is worse.
      */}
      <Drawer
        onOpenChange={(next) => {
          if (!next) setOpenKey(null)
        }}
        open={openKey !== null}
      >
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader>
            <DrawerTitle>{label}</DrawerTitle>
            <DrawerDescription>
              {isThisWeek ? 'This week, day by day.' : 'That week, day by day.'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 overflow-y-auto px-4 pb-6" ref={list}>
            {week.map((day) => (
              <div
                // Marks where the tap landed, so scrolling away and back
                // still shows which day you came in on.
                className={cn(
                  'rounded-md',
                  day.key === openKey && 'ring-2 ring-ring/50',
                )}
                data-open={day.key === openKey ? '' : undefined}
                key={day.key}
              >
                <DayDetail contents={day} dayKey={day.key} />
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  )
}
