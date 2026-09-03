import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Mail,
  MapPin,
  Pencil,
  Plus,
  UserRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { CalendarStatus } from '#/components/calendar-status'
import { CourseDialog } from '#/components/course-dialog'
import { CourseIcon } from '#/components/course-icon'
import { DateTimeText, DayWithRelative } from '#/components/date-time'
import { DayTooltip } from '#/components/day-tooltip'
import { Pill } from '#/components/kibo-ui/pill'
import { ScheduleCalendar } from '#/components/schedule-calendar'
import { Button } from '#/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { WeekStrip } from '#/components/week-strip'
import { trimSeconds, WEEKDAYS } from '#/lib/course-event'
import { nextMeetingKey } from '#/lib/course-schedule'
import { formatKeyDay, todayKey } from '#/lib/datetime'
import { formatTime } from '#/lib/parse-time'
import { coursesQuery, itemsQuery } from '#/lib/queries'
import { compareUrgency } from '#/lib/urgency'
import { cn } from '#/lib/utils'
import type { CourseRow } from '#/server/courses'
import type { ItemRow } from '#/server/items'

export const Route = createFileRoute('/_app/courses')({
  component: Courses,
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(coursesQuery),
      context.queryClient.ensureQueryData(itemsQuery),
    ]),
})

/** `[1,3,5]` reads as `Mon Wed Fri`, in timetable order rather than click order. */
function meetingDays(course: CourseRow): string | null {
  if (!course.days?.length) return null
  return WEEKDAYS.filter((day) => course.days?.includes(day.value))
    .map((day) => day.label)
    .join(' ')
}

/** "10:00 AM to 11:15 AM", or nothing when the times are not filled in. */
function meetingTime(course: CourseRow): string | null {
  if (!course.startTime || !course.endTime) return null
  return `${formatTime(trimSeconds(course.startTime))} to ${formatTime(trimSeconds(course.endTime))}`
}

function Courses() {
  const { data: courses } = useSuspenseQuery(coursesQuery)
  const { data: items } = useSuspenseQuery(itemsQuery)
  const [editing, setEditing] = useState<CourseRow | null>(null)
  const [open, setOpen] = useState(false)

  const openFor = (course: CourseRow | null) => {
    setEditing(course)
    setOpen(true)
  }

  /** One pass over every item, so each card is not filtering the whole list. */
  const byCourse = useMemo(() => {
    const map = new Map<number, ItemRow[]>()
    for (const item of items) {
      if (!item.course) continue
      const existing = map.get(item.course.id)
      if (existing) existing.push(item)
      else map.set(item.course.id, [item])
    }
    return map
  }, [items])

  const active = courses.filter((course) => course.active)
  const archived = courses.filter((course) => !course.active)

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Courses</h1>
          {active.length > 0 && (
            <p className="mt-1 text-muted-foreground text-sm">
              {active.length} active
              {archived.length > 0 && ` · ${archived.length} archived`}
            </p>
          )}
        </div>
        <Button className="min-h-11 shrink-0" onClick={() => openFor(null)}>
          <Plus />
          Add class
        </Button>
      </header>

      <div className="mb-6">
        <CalendarStatus />
      </div>

      {courses.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>No courses yet</EmptyTitle>
            <EmptyDescription>
              Add a class and its meeting pattern lands on your calendar for the
              whole term.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && <WeekStrip courses={active} items={items} />}

          <section className="space-y-3">
            {active.map((course) => (
              <CourseCard
                course={course}
                items={byCourse.get(course.id) ?? []}
                key={course.id}
                onEdit={() => openFor(course)}
              />
            ))}
          </section>

          {archived.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Archived
              </h2>
              {archived.map((course) => (
                <CourseCard
                  course={course}
                  items={byCourse.get(course.id) ?? []}
                  key={course.id}
                  onEdit={() => openFor(course)}
                />
              ))}
            </section>
          )}
        </div>
      )}

      <CourseDialog course={editing} onOpenChange={setOpen} open={open} />
    </div>
  )
}

/**
 * One class, closed. The header carries what you look up at a glance — when it
 * meets, where, and who teaches it — and the calendar with everything due
 * waits behind a disclosure, since three open months at once is a wall.
 */
function CourseCard({
  course,
  items,
  onEdit,
}: {
  course: CourseRow
  items: ItemRow[]
  onEdit: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const days = meetingDays(course)
  const time = meetingTime(course)
  const color = course.color ?? 'var(--primary)'
  // Eight digit hex for the icon's backing tint. Only a real hex takes the
  // alpha suffix, so a colourless course falls back to the muted surface.
  const tint = course.color ? `${course.color}1f` : 'var(--muted)'

  const outstanding = items.filter((item) => item.status !== 'done')
  const finished = items.filter((item) => item.status === 'done')
  const next = nextMeetingKey(course, todayKey())

  return (
    <Collapsible
      className={cn(
        'rounded-lg border border-border bg-card/40',
        !course.active && 'opacity-60',
      )}
      onOpenChange={setExpanded}
      open={expanded}
    >
      <div className="flex items-start gap-3 p-3">
        {/* The icon replaces the colour bar when there is one, since two
            marks of the same colour side by side say nothing extra. */}
        {course.icon ? (
          <span
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: tint }}
          >
            <CourseIcon
              className="size-5"
              color={course.color}
              name={course.icon}
            />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="mt-1.5 h-8 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            {course.code && (
              <span className="font-medium text-sm tabular-nums">
                {course.code}
              </span>
            )}
            <span className="min-w-0 truncate font-medium text-sm">
              {course.name}
            </span>
            {course.term && (
              <Pill className="px-2 py-0.5 text-[11px]">{course.term}</Pill>
            )}
          </div>

          <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
            {days || time ? (
              <span>{[days, time].filter(Boolean).join(' · ')}</span>
            ) : (
              <span>No meeting pattern</span>
            )}
            {course.location && (
              <span className="flex items-center gap-1">
                <MapPin aria-hidden="true" className="size-3" />
                {course.location}
              </span>
            )}
          </p>

          {course.instructor && (
            <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
              <span className="flex items-center gap-1">
                <UserRound aria-hidden="true" className="size-3" />
                {course.instructor}
              </span>
              {course.instructorEmail && (
                <a
                  className="flex min-h-6 items-center gap-1 text-foreground underline-offset-4 hover:underline"
                  href={`mailto:${course.instructorEmail}`}
                >
                  <Mail aria-hidden="true" className="size-3" />
                  {course.instructorEmail}
                </a>
              )}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs">
            {outstanding.length > 0 && (
              <span>
                <span className="font-medium tabular-nums">
                  {outstanding.length}
                </span>{' '}
                <span className="text-muted-foreground">outstanding</span>
              </span>
            )}
            {finished.length > 0 && (
              <span className="text-muted-foreground tabular-nums">
                {finished.length} done
              </span>
            )}
            {next && (
              <DayTooltip dayKey={next} meetings={[course]}>
                <span className="cursor-help text-muted-foreground">
                  next {formatKeyDay(next)}
                </span>
              </DayTooltip>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            aria-label={`Edit ${course.name}`}
            className="size-9"
            onClick={onEdit}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Pencil />
          </Button>
          <CollapsibleTrigger asChild>
            <Button
              aria-label={`${expanded ? 'Hide' : 'Show'} the calendar for ${course.name}`}
              className="size-9"
              size="icon"
              type="button"
              variant="ghost"
            >
              {expanded ? <ChevronDown /> : <CalendarDays />}
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent>
        <div className="space-y-4 border-border border-t p-3">
          <ScheduleCalendar courses={[course]} items={items} />

          <ItemColumn
            emptyText="Nothing outstanding."
            items={outstanding}
            title="Still to do"
          />

          {finished.length > 0 && (
            <ItemColumn done items={finished} title="Finished" />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** How many finished items to list before the rest are only a count. */
const DONE_SHOWN = 5

function ItemColumn({
  title,
  items,
  done = false,
  emptyText,
}: {
  title: string
  items: ItemRow[]
  done?: boolean
  emptyText?: string
}) {
  // Outstanding work sorts by urgency, the way the Today list does. Finished
  // work sorts by when it was ticked, newest first, since that is its story.
  const sorted = useMemo(() => {
    const copy = [...items]
    if (done) {
      return copy.sort(
        (a, b) =>
          (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
      )
    }
    return copy.sort((a, b) => compareUrgency(a, b))
  }, [items, done])

  const shown = done ? sorted.slice(0, DONE_SHOWN) : sorted
  const hidden = sorted.length - shown.length

  return (
    <section className="space-y-1.5">
      <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {title}
        <span className="ml-1.5 tabular-nums">{items.length}</span>
      </h3>

      {shown.length === 0 && emptyText && (
        <p className="text-muted-foreground text-xs">{emptyText}</p>
      )}

      {shown.map((item) => (
        <div
          className="flex items-baseline gap-2 border-border border-b py-1.5 text-sm last:border-b-0"
          key={item.id}
        >
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              done && 'text-muted-foreground line-through',
            )}
          >
            {item.name}
          </span>
          <span className="shrink-0 text-muted-foreground text-xs capitalize">
            {item.type}
          </span>
          {done && item.completedAt ? (
            <DateTimeText
              className="shrink-0 text-muted-foreground text-xs"
              value={item.completedAt}
            />
          ) : item.dueAt ? (
            // Relative on outstanding work, since "in 3 days" is the thing you
            // are actually reading for. Finished work gets the plain stamp.
            <DayWithRelative
              allDay={item.allDay}
              className="shrink-0 text-xs"
              value={item.dueAt}
            />
          ) : (
            <span className="shrink-0 text-muted-foreground text-xs">
              no date
            </span>
          )}
        </div>
      ))}

      {hidden > 0 && (
        <p className="text-muted-foreground text-xs">and {hidden} more</p>
      )}
    </section>
  )
}
