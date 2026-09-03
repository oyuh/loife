import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { DateField } from '#/components/date-field'
import { InstructorField } from '#/components/instructor-field'
import { MarkdownField } from '#/components/markdown-field'
import { TimeField } from '#/components/time-field'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '#/components/ui/drawer'
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { trimSeconds, WEEKDAYS } from '#/lib/course-event'
import { coursesQuery, itemsQuery } from '#/lib/queries'
import { useMediaQuery } from '#/lib/use-media-query'
import { type CourseRow, createCourse, updateCourse } from '#/server/courses'

/** A small fixed set beats a full colour picker for tagging a handful of classes. */
const COLORS = [
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
]

const EMPTY = {
  name: '',
  code: '',
  color: COLORS[0],
  term: '',
  termStart: '',
  termEnd: '',
  days: [] as number[],
  startTime: '',
  endTime: '',
  meetingInterval: '1',
  // Each row carries an id, since two blank dates would otherwise share a key.
  meetingDates: [] as { id: string; value: string }[],
  location: '',
  instructor: '',
  instructorEmail: '',
  notes: '',
  active: true,
}

type Form = typeof EMPTY

function fromCourse(course: CourseRow): Form {
  return {
    name: course.name,
    code: course.code ?? '',
    color: course.color ?? COLORS[0],
    term: course.term ?? '',
    termStart: course.termStart ?? '',
    termEnd: course.termEnd ?? '',
    days: course.days ?? [],
    startTime: trimSeconds(course.startTime),
    endTime: trimSeconds(course.endTime),
    meetingInterval: String(course.meetingInterval ?? 1),
    meetingDates: (course.meetingDates ?? []).map((value) => ({
      id: crypto.randomUUID(),
      value,
    })),
    location: course.location ?? '',
    instructor: course.instructor ?? '',
    instructorEmail: course.instructorEmail ?? '',
    notes: course.notes ?? '',
    active: course.active,
  }
}

export function CourseDialog({
  open,
  onOpenChange,
  course,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing, absent when adding. */
  course?: CourseRow | null
}) {
  const [form, setForm] = useState<Form>(EMPTY)
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery('(min-width: 640px)')

  // Reopening on a different course has to reload the fields.
  useEffect(() => {
    if (open) setForm(course ? fromCourse(course) : EMPTY)
  }, [open, course])

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        code: form.code,
        color: form.color,
        term: form.term,
        termStart: form.termStart || null,
        termEnd: form.termEnd || null,
        days: form.days,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        meetingInterval: Number(form.meetingInterval),
        meetingDates: form.meetingDates.map((d) => d.value).filter(Boolean),
        location: form.location,
        instructor: form.instructor,
        instructorEmail: form.instructorEmail,
        notes: form.notes,
        active: form.active,
      }
      return course
        ? updateCourse({ data: { ...payload, id: course.id } })
        : createCourse({ data: payload })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coursesQuery.queryKey })
      queryClient.invalidateQueries({ queryKey: itemsQuery.queryKey })
      toast.success(course ? 'Course updated' : `Added ${form.name.trim()}`)
      onOpenChange(false)
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : 'Could not save that',
      ),
  })

  const title = course ? 'Edit class' : 'Add class'
  const description =
    'Meeting days and times become one recurring event on your calendar.'
  const body = (
    <CourseForm
      courseId={course?.id}
      form={form}
      onChange={setForm}
      onSubmit={save.mutate}
    />
  )
  const submit = (
    <Button
      className="min-h-11 w-full sm:w-auto"
      disabled={save.isPending || !form.name.trim()}
      form="course-form"
      type="submit"
    >
      {save.isPending ? 'Saving…' : course ? 'Save' : 'Add'}
    </Button>
  )

  const close = (next: boolean) => {
    if (!save.isPending) onOpenChange(next)
  }

  if (!isDesktop) {
    return (
      <Drawer onOpenChange={close} open={open}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4">{body}</div>
          <DrawerFooter>{submit}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog onOpenChange={close} open={open}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>{submit}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CourseForm({
  form,
  courseId,
  onChange,
  onSubmit,
}: {
  form: Form
  courseId?: number
  onChange: (next: Form) => void
  onSubmit: () => void
}) {
  const nameId = useId()
  const codeId = useId()
  const termId = useId()
  const startDateId = useId()
  const endDateId = useId()
  const startTimeId = useId()
  const endTimeId = useId()
  const locationId = useId()
  const notesId = useId()

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    onChange({ ...form, [key]: value })

  return (
    <form
      className="pb-2"
      id="course-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <FieldGroup>
        <div className="grid grid-cols-3 gap-3">
          <Field className="col-span-2 min-w-0">
            <FieldLabel htmlFor={nameId}>Name</FieldLabel>
            <Input
              className="h-11"
              id={nameId}
              maxLength={200}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Computer Systems"
              required
              value={form.name}
            />
          </Field>
          <Field className="min-w-0">
            <FieldLabel htmlFor={codeId}>Code</FieldLabel>
            <Input
              className="h-11"
              id={codeId}
              maxLength={40}
              onChange={(e) => set('code', e.target.value)}
              placeholder="CS 210"
              value={form.code}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel>Colour</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <button
                aria-label={color}
                aria-pressed={form.color === color}
                className="size-9 rounded-full border-2 transition-colors"
                key={color}
                onClick={() => set('color', color)}
                style={{
                  backgroundColor: color,
                  borderColor:
                    form.color === color ? 'var(--foreground)' : 'transparent',
                }}
                type="button"
              />
            ))}
          </div>
        </Field>

        <Field>
          <FieldLabel>Meets on</FieldLabel>
          <ToggleGroup
            className="w-full justify-start"
            onValueChange={(values: string[]) =>
              set(
                'days',
                values.map(Number).sort((a, b) => a - b),
              )
            }
            type="multiple"
            value={form.days.map(String)}
            variant="outline"
          >
            {WEEKDAYS.map((day) => (
              <ToggleGroupItem
                className="min-h-11 flex-1"
                key={day.value}
                value={String(day.value)}
              >
                {day.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        <Field>
          <FieldLabel>Repeats</FieldLabel>
          <Select
            onValueChange={(value) => set('meetingInterval', value)}
            value={form.meetingInterval}
          >
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Every week</SelectItem>
              <SelectItem value="2">Every 2 weeks</SelectItem>
              <SelectItem value="3">Every 3 weeks</SelectItem>
              <SelectItem value="4">Every 4 weeks</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>
            One-off dates
            <span className="ml-1 font-normal text-muted-foreground">
              for labs that follow no pattern
            </span>
          </FieldLabel>
          <div className="space-y-2">
            {form.meetingDates.map((row, index) => (
              <div className="flex gap-2" key={row.id}>
                <div className="min-w-0 flex-1">
                  <DateField
                    label={`One-off date ${index + 1}`}
                    onChange={(value) =>
                      set(
                        'meetingDates',
                        form.meetingDates.map((existing) =>
                          existing.id === row.id
                            ? { ...existing, value }
                            : existing,
                        ),
                      )
                    }
                    value={row.value}
                  />
                </div>
                <Button
                  aria-label={`Remove one-off date ${index + 1}`}
                  className="min-h-11"
                  onClick={() =>
                    set(
                      'meetingDates',
                      form.meetingDates.filter(
                        (existing) => existing.id !== row.id,
                      ),
                    )
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              className="min-h-11"
              onClick={() =>
                set('meetingDates', [
                  ...form.meetingDates,
                  { id: crypto.randomUUID(), value: '' },
                ])
              }
              size="sm"
              type="button"
              variant="secondary"
            >
              <Plus />
              Add a date
            </Button>
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field className="min-w-0">
            <FieldLabel htmlFor={startTimeId}>Starts</FieldLabel>
            <TimeField
              id={startTimeId}
              label="Starts"
              onChange={(value) => set('startTime', value)}
              value={form.startTime}
            />
          </Field>
          <Field className="min-w-0">
            <FieldLabel htmlFor={endTimeId}>Ends</FieldLabel>
            <TimeField
              id={endTimeId}
              label="Ends"
              onChange={(value) => set('endTime', value)}
              value={form.endTime}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor={termId}>Term</FieldLabel>
          <Input
            className="h-11"
            id={termId}
            maxLength={80}
            onChange={(e) => set('term', e.target.value)}
            placeholder="Fall 2026"
            value={form.term}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field className="min-w-0">
            <FieldLabel htmlFor={startDateId}>Term starts</FieldLabel>
            <DateField
              id={startDateId}
              label="Term starts"
              onChange={(value) => set('termStart', value)}
              value={form.termStart}
            />
          </Field>
          <Field className="min-w-0">
            <FieldLabel htmlFor={endDateId}>Term ends</FieldLabel>
            <DateField
              id={endDateId}
              label="Term ends"
              onChange={(value) => set('termEnd', value)}
              value={form.termEnd}
            />
          </Field>
        </div>

        <InstructorField
          email={form.instructorEmail}
          excludeCourseId={courseId}
          name={form.instructor}
          onEmailChange={(value) => set('instructorEmail', value)}
          onNameChange={(value) => set('instructor', value)}
        />

        <Field className="min-w-0">
          <FieldLabel htmlFor={locationId}>
            Location
            <span className="ml-1 font-normal text-muted-foreground">
              optional
            </span>
          </FieldLabel>
          <Input
            className="h-11"
            id={locationId}
            maxLength={200}
            onChange={(e) => set('location', e.target.value)}
            placeholder="ECSS 2.410"
            value={form.location}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={notesId}>
            Notes
            <span className="ml-1 font-normal text-muted-foreground">
              optional
            </span>
          </FieldLabel>
          <MarkdownField
            id={notesId}
            onChange={(value) => set('notes', value)}
            rows={3}
            value={form.notes}
          />
        </Field>
      </FieldGroup>
    </form>
  )
}
