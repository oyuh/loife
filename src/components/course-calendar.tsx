import { ChevronLeft, ChevronRight, Circle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '#/components/ui/button'
import { trimSeconds } from '#/lib/course-event'
import { hasSchedule, meetsOnKey, monthGridKeys } from '#/lib/course-schedule'
import {
  formatKeyDayLong,
  formatKeyMonth,
  toDateKey,
  todayKey,
} from '#/lib/datetime'
import { formatTime } from '#/lib/parse-time'
import { cn } from '#/lib/utils'
import type { CourseRow } from '#/server/courses'
import type { ItemRow } from '#/server/items'

/**
 * A month of one course: the days it meets, the days something is due, and
 * what those things are.
 *
 * Built by hand from `monthGridKeys` rather than through react-day-picker.
 * Every cell here carries two independent marks — meets, and has work due —
 * and expressing that through day-picker's modifiers means styling its
 * internals from the outside. A seven column grid of buttons is less code and
 * takes the app's own tokens directly.
 */

/** Sunday first, matching the grid. Paired with a stable id, since S and T repeat. */
const WEEKDAY_INITIALS = [
  { id: 'sun', letter: 'S' },
  { id: 'mon', letter: 'M' },
  { id: 'tue', letter: 'T' },
  { id: 'wed', letter: 'W' },
  { id: 'thu', letter: 'T' },
  { id: 'fri', letter: 'F' },
  { id: 'sat', letter: 'S' },
] as const

export interface DayContents {
  meets: boolean
  due: ItemRow[]
  done: ItemRow[]
}

/** Everything on a given date, keyed by `2026-09-15`. */
function contentsByKey(
  course: CourseRow,
  items: ItemRow[],
  keys: string[],
): Map<string, DayContents> {
  const map = new Map<string, DayContents>()
  for (const key of keys) {
    map.set(key, { meets: meetsOnKey(course, key), due: [], done: [] })
  }

  for (const item of items) {
    if (!item.dueAt) continue
    const entry = map.get(toDateKey(item.dueAt))
    if (!entry) continue
    if (item.status === 'done') entry.done.push(item)
    else entry.due.push(item)
  }

  return map
}

export function CourseCalendar({
  course,
  items,
}: {
  course: CourseRow
  items: ItemRow[]
}) {
  const today = todayKey()
  // The month in view, as the key of its first day. Starts on the month
  // holding today rather than the term start, since that is what you came to
  // look at nine times out of ten.
  const [monthAnchor, setMonthAnchor] = useState(today)
  const [selected, setSelected] = useState<string | null>(today)

  const keys = useMemo(() => monthGridKeys(monthAnchor), [monthAnchor])
  const contents = useMemo(
    () => contentsByKey(course, items, keys),
    [course, items, keys],
  )

  const shiftMonth = (by: number) => {
    const [year, month] = monthAnchor.split('-').map(Number)
    const moved = new Date(Date.UTC(year, month - 1 + by, 1))
    const next = `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}-01`
    setMonthAnchor(next)
    // The selection is only meaningful inside the month on screen.
    setSelected(null)
  }

  const inMonth = (key: string) => key.slice(0, 7) === monthAnchor.slice(0, 7)
  const color = course.color ?? 'var(--primary)'
  const selectedContents = selected ? contents.get(selected) : undefined

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          aria-label="Previous month"
          className="size-9"
          onClick={() => shiftMonth(-1)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronLeft />
        </Button>
        <p className="font-medium text-sm">{formatKeyMonth(monthAnchor)}</p>
        <Button
          aria-label="Next month"
          className="size-9"
          onClick={() => shiftMonth(1)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_INITIALS.map((weekday) => (
          <div
            className="pb-1 text-center font-medium text-[10px] text-muted-foreground uppercase"
            key={weekday.id}
          >
            {weekday.letter}
          </div>
        ))}

        {keys.map((key) => {
          const day = contents.get(key)
          const isToday = key === today
          const isSelected = key === selected
          const outside = !inMonth(key)
          const marks = (day?.due.length ?? 0) + (day?.done.length ?? 0)

          return (
            <button
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${formatKeyDayLong(key)}${day?.meets ? ', class meets' : ''}${
                day?.due.length ? `, ${day.due.length} due` : ''
              }`}
              aria-pressed={isSelected}
              className={cn(
                'relative flex min-h-11 flex-col items-center justify-center rounded-md text-sm tabular-nums transition-colors',
                'hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1',
                outside && 'text-muted-foreground/40',
                isToday && 'font-semibold text-primary',
                isSelected && 'bg-accent',
              )}
              key={key}
              onClick={() => setSelected(isSelected ? null : key)}
              type="button"
            >
              <span>{Number(key.slice(-2))}</span>

              {/*
                Two marks, never merged. The bar says the class meets, the dots
                say work is due, and a day can easily be both.
              */}
              <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                {day?.meets && (
                  <span
                    className="h-1 w-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                )}
                {marks > 0 && (
                  <span
                    className={cn(
                      'size-1 rounded-full',
                      day?.due.length
                        ? 'bg-foreground'
                        : 'bg-muted-foreground/50',
                    )}
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>

      <Legend color={color} />

      {selected && (
        <DayDetail
          contents={selectedContents}
          course={course}
          dayKey={selected}
        />
      )}

      {!hasSchedule(course) && (
        <p className="text-muted-foreground text-xs">
          No meeting pattern set, so only due dates are marked. Add days and
          term dates in Edit to fill the calendar in.
        </p>
      )}
    </div>
  )
}

function Legend({ color }: { color: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-1 w-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        Class meets
      </span>
      <span className="flex items-center gap-1.5">
        <Circle aria-hidden="true" className="size-1.5 fill-foreground" />
        Work due
      </span>
      <span className="flex items-center gap-1.5">
        <Circle
          aria-hidden="true"
          className="size-1.5 fill-muted-foreground/50"
        />
        Finished
      </span>
    </div>
  )
}

/** What is actually on the chosen day, which is the point of picking one. */
function DayDetail({
  dayKey,
  course,
  contents,
}: {
  dayKey: string
  course: CourseRow
  contents: DayContents | undefined
}) {
  const meetingTime =
    contents?.meets && course.startTime && course.endTime
      ? `${formatTime(trimSeconds(course.startTime))} to ${formatTime(trimSeconds(course.endTime))}`
      : null

  const nothing =
    !contents?.meets && !contents?.due.length && !contents?.done.length

  return (
    <div className="space-y-2 rounded-md border border-border bg-card/50 p-3">
      <p className="font-medium text-sm">{formatKeyDayLong(dayKey)}</p>

      {meetingTime && (
        <p className="text-muted-foreground text-xs">
          Class {meetingTime}
          {course.location ? ` · ${course.location}` : ''}
        </p>
      )}

      {contents?.due.map((item) => (
        <p className="flex items-baseline gap-2 text-sm" key={item.id}>
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 translate-y-[-2px] rounded-full bg-foreground"
          />
          <span className="min-w-0 truncate">{item.name}</span>
          <span className="ml-auto shrink-0 text-muted-foreground text-xs capitalize">
            {item.type}
          </span>
        </p>
      ))}

      {contents?.done.map((item) => (
        <p
          className="flex items-baseline gap-2 text-muted-foreground text-sm"
          key={item.id}
        >
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 translate-y-[-2px] rounded-full bg-muted-foreground/50"
          />
          <span className="min-w-0 truncate line-through">{item.name}</span>
          <span className="ml-auto shrink-0 text-xs">done</span>
        </p>
      ))}

      {nothing && (
        <p className="text-muted-foreground text-xs">
          No class and nothing due.
        </p>
      )}
    </div>
  )
}
