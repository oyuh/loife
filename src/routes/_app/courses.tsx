import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { BookOpen, Plus } from 'lucide-react'
import { useState } from 'react'
import { CalendarStatus } from '#/components/calendar-status'
import { CourseDialog } from '#/components/course-dialog'
import { Pill } from '#/components/kibo-ui/pill'
import { Button } from '#/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item'
import { trimSeconds, WEEKDAYS } from '#/lib/course-event'
import { coursesQuery } from '#/lib/queries'
import type { CourseRow } from '#/server/courses'

export const Route = createFileRoute('/_app/courses')({
  component: Courses,
  loader: ({ context }) => context.queryClient.ensureQueryData(coursesQuery),
})

/** `[1,3,5]` reads as `Mon Wed Fri`, in timetable order rather than click order. */
function meetingSummary(course: CourseRow): string | null {
  if (!course.days?.length) return null

  const labels = WEEKDAYS.filter((day) => course.days?.includes(day.value)).map(
    (day) => day.label,
  )
  const times =
    course.startTime && course.endTime
      ? ` · ${trimSeconds(course.startTime)} to ${trimSeconds(course.endTime)}`
      : ''

  return `${labels.join(' ')}${times}`
}

function Courses() {
  const { data: courses } = useSuspenseQuery(coursesQuery)
  const [editing, setEditing] = useState<CourseRow | null>(null)
  const [open, setOpen] = useState(false)

  const openFor = (course: CourseRow | null) => {
    setEditing(course)
    setOpen(true)
  }

  const active = courses.filter((course) => course.active)
  const archived = courses.filter((course) => !course.active)

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Courses</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Meeting times sync to your calendar as recurring events.
          </p>
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
          <CourseList courses={active} onEdit={openFor} />

          {archived.length > 0 && (
            <section>
              <h2 className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Archived
              </h2>
              <CourseList courses={archived} onEdit={openFor} />
            </section>
          )}
        </div>
      )}

      <CourseDialog course={editing} onOpenChange={setOpen} open={open} />
    </div>
  )
}

function CourseList({
  courses,
  onEdit,
}: {
  courses: CourseRow[]
  onEdit: (course: CourseRow) => void
}) {
  return (
    <ItemGroup>
      {courses.map((course) => {
        const meets = meetingSummary(course)

        return (
          <Item
            className="gap-3 rounded-none border-b-border px-0 py-3 last:border-b-transparent"
            key={course.id}
            size="sm"
          >
            <ItemMedia>
              <span
                aria-hidden="true"
                className="size-3 rounded-full"
                style={{ backgroundColor: course.color ?? 'var(--primary)' }}
              />
            </ItemMedia>

            <button
              className="flex min-w-0 flex-1 text-left"
              onClick={() => onEdit(course)}
              type="button"
            >
              <ItemContent className="gap-0.5">
                <ItemTitle className="w-full truncate">
                  {course.code ? `${course.code} ` : ''}
                  {course.name}
                </ItemTitle>
                <ItemDescription className="flex flex-wrap items-center gap-x-2">
                  {meets ?? 'No meeting pattern'}
                  {course.location && <span>{course.location}</span>}
                </ItemDescription>
              </ItemContent>
            </button>

            {course.term && (
              <ItemActions>
                <Pill>{course.term}</Pill>
              </ItemActions>
            )}
          </Item>
        )
      })}
    </ItemGroup>
  )
}
