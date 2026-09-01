import { ChevronLeft, ChevronRight, Circle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '#/components/ui/button'
import { trimSeconds } from '#/lib/course-event'
import { meetsOnKey, monthGridKeys } from '#/lib/course-schedule'
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
 * A month of classes and work: the days something meets, the days something is
 * due, and what those things are.
 *
 * Takes a list of courses rather than one, so the same component draws a
 * single class on the courses page and the whole term on Today. One course
 * gets a single wide bar under the date, several get one narrow bar each in
 * their own colours.
 *
 * Built by hand from `monthGridKeys` rather than through react-day-picker.
 * Every cell carries two independent marks — meets, and has work due — and
 * expressing that through day-picker's modifiers means styling its internals
 * from the outside. A seven column grid of buttons is less code and takes the
 * app's own tokens directly.
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

/** Past this many bars a cell is a smear, so the rest become a count. */
const MAX_BARS = 4

export interface DayContents {
  meetings: CourseRow[]
  due: ItemRow[]
  done: ItemRow[]
}

/** Everything on a given date, keyed by `2026-09-15`. */
function contentsByKey(
  courses: CourseRow[],
  items: ItemRow[],
  keys: string[],
): Map<string, DayContents> {
  const map = new Map<string, DayContents>()

  for (const key of keys) {
    map.set(key, {
      meetings: courses.filter((course) => meetsOnKey(course, key)),
      due: [],
      done: [],
    })
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

/** The month key of the first of whatever month holds `key`. */
function firstOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`
}

export function ScheduleCalendar({
  courses,
  items,
}: {
  courses: CourseRow[]
  items: ItemRow[]
}) {
  const today = todayKey()
  // The month in view, as the key of its first day. Starts on the month
  // holding today rather than the term start, since that is what you came to
  // look at nine times out of ten.
  const [monthAnchor, setMonthAnchor] = useState(() => firstOfMonth(today))
  const [selected, setSelected] = useState<string | null>(today)

  const keys = useMemo(() => monthGridKeys(monthAnchor), [monthAnchor])
  const contents = useMemo(
    () => contentsByKey(courses, items, keys),
    [courses, items, keys],
  )

  const shiftMonth = (by: number) => {
    const [year, month] = monthAnchor.split('-').map(Number)
    const moved = new Date(Date.UTC(year, month - 1 + by, 1))
    setMonthAnchor(
      `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}-01`,
    )
    // The selection is only meaningful inside the month on screen.
    setSelected(null)
  }

  const inMonth = (key: string) => key.slice(0, 7) === monthAnchor.slice(0, 7)
  const selectedContents = selected ? contents.get(selected) : undefined
  const showingToday = inMonth(today)

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

        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">{formatKeyMonth(monthAnchor)}</p>
          {!showingToday && (
            <Button
              className="min-h-8 px-2 text-xs"
              onClick={() => {
                setMonthAnchor(firstOfMonth(today))
                setSelected(today)
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              Today
            </Button>
          )}
        </div>

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
          const meetings = day?.meetings ?? []
          const marks = (day?.due.length ?? 0) + (day?.done.length ?? 0)

          return (
            <button
              aria-current={isToday ? 'date' : undefined}
              aria-label={[
                formatKeyDayLong(key),
                meetings.length === 1
                  ? `${meetings[0].code ?? meetings[0].name} meets`
                  : meetings.length > 1
                    ? `${meetings.length} classes`
                    : null,
                day?.due.length ? `${day.due.length} due` : null,
              ]
                .filter(Boolean)
                .join(', ')}
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
                Two marks, never merged. A bar per class that meets, and a dot
                if work is due, because a day is very often both.
              */}
              <span className="mt-0.5 flex h-1.5 items-center justify-center gap-0.5">
                {meetings.slice(0, MAX_BARS).map((course) => (
                  <span
                    className={cn(
                      'h-1 rounded-full',
                      meetings.length === 1 ? 'w-3' : 'w-1.5',
                    )}
                    key={course.id}
                    style={{
                      backgroundColor: course.color ?? 'var(--primary)',
                    }}
                  />
                ))}
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

      <Legend courses={courses} />

      {selected && <DayDetail contents={selectedContents} dayKey={selected} />}
    </div>
  )
}

/**
 * With one course the bar is that course, so the legend names what a bar
 * means. With several the bars are already colour coded, so it names the
 * courses instead and the colours become readable.
 */
function Legend({ courses }: { courses: CourseRow[] }) {
  const single = courses.length === 1

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {single ? (
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1 w-3 rounded-full"
            style={{ backgroundColor: courses[0].color ?? 'var(--primary)' }}
          />
          Class meets
        </span>
      ) : (
        courses.map((course) => (
          <span className="flex items-center gap-1.5" key={course.id}>
            <span
              aria-hidden="true"
              className="h-1 w-1.5 rounded-full"
              style={{ backgroundColor: course.color ?? 'var(--primary)' }}
            />
            {course.code ?? course.name}
          </span>
        ))
      )}
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
  contents,
}: {
  dayKey: string
  contents: DayContents | undefined
}) {
  const nothing =
    !contents?.meetings.length &&
    !contents?.due.length &&
    !contents?.done.length

  return (
    <div className="space-y-2 rounded-md border border-border bg-card/50 p-3">
      <p className="font-medium text-sm">{formatKeyDayLong(dayKey)}</p>

      {contents?.meetings.map((course) => (
        <p
          className="flex items-baseline gap-2 text-muted-foreground text-xs"
          key={course.id}
        >
          <span
            aria-hidden="true"
            className="h-1 w-3 shrink-0 translate-y-[-3px] rounded-full"
            style={{ backgroundColor: course.color ?? 'var(--primary)' }}
          />
          <span className="min-w-0 truncate">
            {course.code ?? course.name}
            {course.startTime && course.endTime
              ? ` · ${formatTime(trimSeconds(course.startTime))} to ${formatTime(trimSeconds(course.endTime))}`
              : ''}
          </span>
          {course.location && (
            <span className="ml-auto shrink-0">{course.location}</span>
          )}
        </p>
      ))}

      {contents?.due.map((item) => (
        <p className="flex items-baseline gap-2 text-sm" key={item.id}>
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 translate-y-[-2px] rounded-full bg-foreground"
          />
          <span className="min-w-0 truncate">{item.name}</span>
          <span className="ml-auto shrink-0 text-muted-foreground text-xs capitalize">
            {item.course?.code ?? item.type}
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
