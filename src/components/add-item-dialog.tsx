import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  CalendarIcon,
  ChevronDown,
  FileText,
  GraduationCap,
  ListTodo,
} from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { AttachmentsList, attachmentsKey } from '#/components/attachments-list'
import { MarkdownField } from '#/components/markdown-field'
import { StagedFiles } from '#/components/staged-files'
import { TimeField } from '#/components/time-field'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { formatKeyDay } from '#/lib/datetime'
import { toDueFields, toDueValue } from '#/lib/due-date'
import { coursesQuery, itemsQuery } from '#/lib/queries'
import {
  DEFAULT_PRIORITY,
  PRIORITY_LABELS,
  PRIORITY_LEVELS,
} from '#/lib/urgency'
import { useMediaQuery } from '#/lib/use-media-query'
import { cn } from '#/lib/utils'
import { recordUpload, requestUpload } from '#/server/attachments'
import { createItem, type ItemRow, updateItem } from '#/server/items'

const TYPES = [
  { value: 'task', label: 'To do', icon: ListTodo },
  { value: 'assignment', label: 'Assignment', icon: FileText },
  { value: 'reading', label: 'Reading', icon: BookOpen },
  { value: 'exam', label: 'Exam', icon: GraduationCap },
] as const

/**
 * The kinds that belong to a class. Picking one of these pulls the course
 * picker up into the body of the form, because an assignment without a course
 * is nearly always a slip, while a to do without one is the normal case.
 */
const COURSE_WORK: readonly string[] = ['assignment', 'reading', 'exam']

/**
 * Round numbers people actually think in, rather than a free minutes box.
 *
 * A dropdown rather than six buttons in a row. Six equal-weight targets read as
 * a decision to be made, and this one has an obvious default of "no idea"; a
 * closed select says the same thing in one line.
 */
const ESTIMATES = [
  { value: 'none', label: 'Not sure' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '240', label: '4 hours' },
] as const

/** Totals for preparation, which the planner spreads over the days left. */
const STUDY_TOTALS = [
  { value: 'none', label: 'None' },
  { value: '60', label: '1 hour' },
  { value: '180', label: '3 hours' },
  { value: '360', label: '6 hours' },
  { value: '600', label: '10 hours' },
  { value: '1200', label: '20 hours' },
] as const

/** Radix Select reserves the empty string, so "not set" is spelled out. */
const UNSET = 'none'

const EMPTY = {
  name: '',
  estimatedMinutes: UNSET,
  studyMinutes: UNSET,
  courseId: UNSET,
  type: 'task',
  date: '',
  time: '',
  priority: String(DEFAULT_PRIORITY),
  location: '',
  notes: '',
}

export function AddItemDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing, absent when adding. */
  item?: ItemRow | null
}) {
  const [form, setForm] = useState(EMPTY)
  const [staged, setStaged] = useState<File[]>([])
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery('(min-width: 640px)')

  useEffect(() => {
    if (!open) return
    setStaged([])
    if (!item) {
      setForm(EMPTY)
      return
    }
    const due = toDueFields({ dueAt: item.dueAt, allDay: item.allDay })
    setForm({
      name: item.name,
      courseId: item.course ? String(item.course.id) : UNSET,
      type: item.type,
      date: due.date,
      time: due.time,
      priority: String(item.priority),
      estimatedMinutes: item.estimatedMinutes
        ? String(item.estimatedMinutes)
        : UNSET,
      studyMinutes: item.studyMinutes ? String(item.studyMinutes) : UNSET,
      location: item.location ?? '',
      notes: item.notes ?? '',
    })
  }, [open, item])

  const save = useMutation({
    mutationFn: async () => {
      const { dueAt, allDay } = toDueValue({ date: form.date, time: form.time })
      const payload = {
        name: form.name,
        courseId: form.courseId !== UNSET ? Number(form.courseId) : null,
        type: form.type as (typeof TYPES)[number]['value'],
        dueAt,
        allDay,
        priority: Number(form.priority),
        estimatedMinutes:
          form.estimatedMinutes === UNSET
            ? null
            : Number(form.estimatedMinutes),
        studyMinutes:
          form.studyMinutes === UNSET ? null : Number(form.studyMinutes),
        location: form.location,
        notes: form.notes,
      }

      const saved = item
        ? await updateItem({ data: { ...payload, id: item.id } })
        : await createItem({ data: payload })

      // Staged files wait for an id, which only exists once the row is saved.
      for (const file of staged) {
        const contentType = file.type || 'application/octet-stream'
        const { key, url } = await requestUpload({
          data: { filename: file.name, contentType, size: file.size },
        })
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: file,
        })
        if (!response.ok)
          throw new Error(`Upload failed with ${response.status}`)
        await recordUpload({
          data: {
            itemId: saved.id,
            logEntryId: null,
            key,
            filename: file.name,
            contentType,
            size: file.size,
          },
        })
      }

      return saved
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: itemsQuery.queryKey })
      queryClient.invalidateQueries({
        queryKey: attachmentsKey({ itemId: saved.id }),
      })
      toast.success(item ? 'Saved' : `Added ${form.name.trim()}`)
      setForm(EMPTY)
      setStaged([])
      onOpenChange(false)
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : 'Could not save that',
      ),
  })

  const close = (next: boolean) => {
    if (!save.isPending) onOpenChange(next)
  }

  const title = item ? 'Edit' : 'Add anything'
  const description = item
    ? 'Changes reach your calendar straight away.'
    : 'A to do, an assignment, a reading, an exam. Only the name is required.'

  const body = (
    <ItemForm
      form={form}
      item={item ?? null}
      onChange={setForm}
      onStagedChange={setStaged}
      onSubmit={save.mutate}
      staged={staged}
    />
  )

  const submit = (
    <Button
      className="min-h-11 w-full sm:w-auto"
      disabled={save.isPending || !form.name.trim()}
      form="item-form"
      type="submit"
    >
      {save.isPending ? 'Saving…' : item ? 'Save' : 'Add'}
    </Button>
  )

  if (!isDesktop) {
    return (
      <Drawer onOpenChange={close} open={open}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
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

/**
 * Name, kind, when, and — for anything that belongs to a class — which class.
 *
 * The old version put nine controls at the same volume: four rows of toggle
 * buttons stacked down the dialog, with the course picker hidden underneath a
 * disclosure. Toggle rows are for a choice you make every time, and only the
 * kind is that. An estimate, a revision total and a priority all have a
 * sensible default you usually accept, so they are dropdowns that say what
 * they currently are in one line instead of six targets competing for a tap.
 */
function ItemForm({
  form,
  item,
  staged,
  onChange,
  onStagedChange,
  onSubmit,
}: {
  form: typeof EMPTY
  item: ItemRow | null
  staged: File[]
  onChange: (next: typeof EMPTY) => void
  onStagedChange: (files: File[]) => void
  onSubmit: () => void
}) {
  const nameId = useId()
  const locationId = useId()
  const notesId = useId()
  const [showMore, setShowMore] = useState(false)
  const { data: courses = [] } = useQuery(coursesQuery)

  const set = <K extends keyof typeof EMPTY>(key: K, value: string) =>
    onChange({ ...form, [key]: value })

  const due = form.date ? new Date(`${form.date}T00:00:00`) : undefined

  const isCourseWork = COURSE_WORK.includes(form.type)
  /*
   * Course work always shows the picker up here. A to do only shows it when one
   * is already chosen, so switching an assignment to a to do does not make the
   * course silently vanish from the form while still being saved.
   */
  const showCourse = isCourseWork || form.courseId !== UNSET
  const courseMissing = isCourseWork && form.courseId === UNSET

  const courseField = (
    <Field>
      <FieldLabel>
        Course
        {!isCourseWork && (
          <span className="ml-1 font-normal text-muted-foreground">
            optional
          </span>
        )}
      </FieldLabel>
      <Select
        onValueChange={(value) => set('courseId', value)}
        value={form.courseId}
      >
        <SelectTrigger
          aria-label="Course"
          className={cn('h-11 w-full', courseMissing && 'border-primary/50')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>No course</SelectItem>
          {courses
            .filter((course) => course.active)
            .map((course) => (
              <SelectItem key={course.id} value={String(course.id)}>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: course.color ?? 'var(--primary)',
                    }}
                  />
                  {course.code
                    ? `${course.code} · ${course.name}`
                    : course.name}
                </span>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {courseMissing && (
        <FieldDescription>
          Pick one so this shows up under the class as well as on Today.
        </FieldDescription>
      )}
    </Field>
  )

  return (
    <form
      className="pb-2"
      id="item-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={nameId}>What is it</FieldLabel>
          <Input
            className="h-12 text-base"
            id={nameId}
            maxLength={200}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Renew parking permit"
            required
            value={form.name}
          />
        </Field>

        {/*
          The one control that stays a row of buttons. It changes what the rest
          of the form asks for, so it has to be readable without opening
          anything.
        */}
        <Field>
          <FieldLabel>Kind</FieldLabel>
          <ToggleGroup
            className="w-full"
            onValueChange={(value: string) => value && set('type', value)}
            type="single"
            value={form.type}
            variant="outline"
          >
            {TYPES.map((option) => (
              <ToggleGroupItem
                className="min-h-11 flex-1 flex-col gap-0.5 px-1 py-1.5 sm:flex-row sm:gap-1.5 sm:py-2"
                key={option.value}
                value={option.value}
              >
                <option.icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="text-[11px] sm:text-sm">{option.label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        {showCourse && courseField}

        <Field>
          <FieldLabel>Due</FieldLabel>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  className={cn(
                    'h-11 min-w-0 flex-1 justify-start font-normal',
                    !form.date && 'text-muted-foreground',
                  )}
                  type="button"
                  variant="outline"
                >
                  <CalendarIcon className="mr-2 size-4 shrink-0" />
                  <span className="truncate">
                    {form.date ? formatKeyDay(form.date) : 'No due date'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  onSelect={(next) =>
                    set(
                      'date',
                      next
                        ? toDueFields({ dueAt: next, allDay: true }).date
                        : '',
                    )
                  }
                  selected={due}
                />
              </PopoverContent>
            </Popover>

            <div className="w-28 shrink-0">
              <TimeField
                label="Time, optional"
                onChange={(value) => set('time', value)}
                value={form.time}
              />
            </div>
          </div>
          <FieldDescription>
            Leave the time blank and it is due by the end of the day.
          </FieldDescription>
        </Field>

        <FieldSeparator />

        {/*
          Three settings that each have a default worth accepting, side by side
          rather than stacked, so they read as one group of adjustments instead
          of three more decisions.
        */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="min-w-0">
            <FieldLabel>Priority</FieldLabel>
            <Select
              onValueChange={(value) => set('priority', value)}
              value={form.priority}
            >
              <SelectTrigger aria-label="Priority" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_LEVELS.map((level) => (
                  <SelectItem key={level} value={String(level)}>
                    P{level} · {PRIORITY_LABELS[level]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field className="min-w-0">
            <FieldLabel>How long will it take</FieldLabel>
            <Select
              onValueChange={(value) => set('estimatedMinutes', value)}
              value={form.estimatedMinutes}
            >
              <SelectTrigger aria-label="Estimate" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTIMATES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Needed to schedule it into a day.
            </FieldDescription>
          </Field>
        </div>

        <Field>
          <FieldLabel>Preparation before it</FieldLabel>
          <Select
            onValueChange={(value) => set('studyMinutes', value)}
            value={form.studyMinutes}
          >
            <SelectTrigger aria-label="Preparation" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STUDY_TOTALS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Total revision, spread over the days before it rather than booked in
            one lump. Study you log comes off the remainder.
          </FieldDescription>
        </Field>

        <Collapsible onOpenChange={setShowMore} open={showMore}>
          <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 text-muted-foreground text-sm">
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-4 transition-transform',
                showMore && 'rotate-180',
              )}
            />
            {showCourse ? 'Place, notes, files' : 'Course, place, notes, files'}
          </CollapsibleTrigger>

          <CollapsibleContent>
            <FieldGroup className="pt-4">
              {/* Only down here when the kind does not call for it above. */}
              {!showCourse && courseField}

              <Field>
                <FieldLabel htmlFor={locationId}>Place</FieldLabel>
                <Input
                  className="h-11"
                  id={locationId}
                  maxLength={200}
                  onChange={(event) => set('location', event.target.value)}
                  placeholder="ECSS 2.410"
                  value={form.location}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor={notesId}>Notes</FieldLabel>
                <MarkdownField
                  id={notesId}
                  onChange={(value) => set('notes', value)}
                  rows={4}
                  value={form.notes}
                />
              </Field>

              <Field>
                <FieldLabel>Files</FieldLabel>
                {item && <AttachmentsList owner={{ itemId: item.id }} />}
                <StagedFiles files={staged} onChange={onStagedChange} />
              </Field>
            </FieldGroup>
          </CollapsibleContent>
        </Collapsible>
      </FieldGroup>
    </form>
  )
}
