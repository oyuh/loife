import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { AttachmentsPanel } from '#/components/attachments-panel'
import {
  Choicebox,
  ChoiceboxIndicator,
  ChoiceboxItem,
  ChoiceboxItemHeader,
  ChoiceboxItemTitle,
} from '#/components/kibo-ui/choicebox'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '#/components/kibo-ui/combobox'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { Textarea } from '#/components/ui/textarea'
import { toDueFields, toDueValue } from '#/lib/due-date'
import { coursesQuery, itemsQuery } from '#/lib/queries'
import { useMediaQuery } from '#/lib/use-media-query'
import { cn } from '#/lib/utils'
import {
  createItem,
  deleteItem,
  type ItemRow,
  updateItem,
} from '#/server/items'

const TYPES = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'exam', label: 'Exam' },
  { value: 'task', label: 'Task' },
  { value: 'reading', label: 'Reading' },
] as const

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
] as const

const EMPTY = {
  name: '',
  courseId: '',
  type: 'assignment',
  date: '',
  time: '',
  priority: 'normal',
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
  /** Present when editing an existing assignment, absent when adding. */
  item?: ItemRow | null
}) {
  const [form, setForm] = useState(EMPTY)

  // Reopening on a different assignment has to reload the fields.
  useEffect(() => {
    if (!open) return
    if (!item) {
      setForm(EMPTY)
      return
    }
    const due = toDueFields({ dueAt: item.dueAt, allDay: item.allDay })
    setForm({
      name: item.name,
      courseId: item.course ? String(item.course.id) : '',
      type: item.type,
      date: due.date,
      time: due.time,
      priority: item.priority,
      location: item.location ?? '',
      notes: item.notes ?? '',
    })
  }, [open, item])
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery('(min-width: 640px)')

  const save = useMutation({
    mutationFn: () => {
      const { dueAt, allDay } = toDueValue({ date: form.date, time: form.time })
      const payload = {
        name: form.name,
        courseId: form.courseId ? Number(form.courseId) : null,
        type: form.type as (typeof TYPES)[number]['value'],
        dueAt,
        allDay,
        priority: form.priority as (typeof PRIORITIES)[number]['value'],
        location: form.location,
        notes: form.notes,
      }
      return item
        ? updateItem({ data: { ...payload, id: item.id } })
        : createItem({ data: payload })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsQuery.queryKey })
      toast.success(item ? 'Saved' : `Added ${form.name.trim()}`)
      setForm(EMPTY)
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

  const remove = useMutation({
    mutationFn: () => deleteItem({ data: { id: item?.id as number } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsQuery.queryKey })
      toast.success('Deleted')
      onOpenChange(false)
    },
    onError: () => toast.error('Could not delete that'),
  })

  const title = item ? 'Edit assignment' : 'Add assignment'
  const description = 'Leave the time empty for anything due by end of day.'
  const body = (
    <>
      <AddItemForm form={form} onChange={setForm} onSubmit={save.mutate} />
      {item && (
        <div className="space-y-2 pt-2">
          <p className="font-medium text-sm">Attachments</p>
          <AttachmentsPanel itemId={item.id} />
        </div>
      )}
    </>
  )
  const submit = (
    <>
      {item && (
        <Button
          className="min-h-11 mr-auto"
          disabled={remove.isPending || save.isPending}
          onClick={() => remove.mutate()}
          type="button"
          variant="ghost"
        >
          Delete
        </Button>
      )}
      <Button
        className="min-h-11 w-full sm:w-auto"
        disabled={save.isPending || !form.name.trim()}
        form="add-item"
        type="submit"
      >
        {save.isPending ? 'Saving…' : item ? 'Save' : 'Add'}
      </Button>
    </>
  )

  // A bottom sheet beats a centred dialog once the mobile keyboard is up.
  if (!isDesktop) {
    return (
      <Drawer open={open} onOpenChange={close}>
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
    <Dialog open={open} onOpenChange={close}>
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

function AddItemForm({
  form,
  onChange,
  onSubmit,
}: {
  form: typeof EMPTY
  onChange: (next: typeof EMPTY) => void
  onSubmit: () => void
}) {
  const nameId = useId()
  const locationId = useId()
  const notesId = useId()
  const { data: courses = [] } = useQuery(coursesQuery)

  const set = <K extends keyof typeof EMPTY>(key: K, value: string) =>
    onChange({ ...form, [key]: value })

  const courseData = [
    { value: '', label: 'No course' },
    ...courses.map((course) => ({
      value: String(course.id),
      label: course.code ?? course.name,
    })),
  ]

  const due = form.date ? new Date(`${form.date}T00:00:00`) : undefined

  return (
    <form
      className="pb-2"
      id="add-item"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={nameId}>Name</FieldLabel>
          <Input
            className="h-11"
            id={nameId}
            maxLength={200}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Problem set 7"
            required
            value={form.name}
          />
        </Field>

        <Field>
          <FieldLabel>Course</FieldLabel>
          <Combobox
            data={courseData}
            onValueChange={(value) => set('courseId', value)}
            type="course"
            value={form.courseId}
          >
            <ComboboxTrigger className="h-11 w-full" />
            <ComboboxContent>
              <ComboboxInput placeholder="Search courses…" />
              <ComboboxList>
                <ComboboxEmpty>No course matches that.</ComboboxEmpty>
                <ComboboxGroup>
                  {courseData.map((course) => (
                    <ComboboxItem key={course.value} value={course.value}>
                      {course.label}
                    </ComboboxItem>
                  ))}
                </ComboboxGroup>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>

        <Field>
          <FieldLabel>Type</FieldLabel>
          <Choicebox
            className="grid grid-cols-2 gap-2"
            onValueChange={(value) => set('type', value)}
            value={form.type}
          >
            {TYPES.map((option) => (
              <ChoiceboxItem
                id={`type-${option.value}`}
                key={option.value}
                value={option.value}
              >
                <ChoiceboxItemHeader>
                  <ChoiceboxItemTitle>{option.label}</ChoiceboxItemTitle>
                </ChoiceboxItemHeader>
                <ChoiceboxIndicator />
              </ChoiceboxItem>
            ))}
          </Choicebox>
        </Field>

        <Field>
          <FieldLabel>Due</FieldLabel>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                className={cn(
                  'h-11 w-full justify-start text-left font-normal',
                  !form.date && 'text-muted-foreground',
                )}
                type="button"
                variant="outline"
              >
                <CalendarIcon className="mr-2 size-4" />
                {due
                  ? `${format(due, 'PPP')}${form.time ? ` at ${form.time}` : ''}`
                  : 'No due date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <div className="divide-y overflow-hidden bg-background">
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
                <div className="space-y-2 p-4">
                  <FieldLabel htmlFor="due-time">
                    Time
                    <span className="ml-1 font-normal text-muted-foreground">
                      optional
                    </span>
                  </FieldLabel>
                  <Input
                    className="h-11 w-full"
                    id="due-time"
                    onChange={(e) => set('time', e.target.value)}
                    type="time"
                    value={form.time}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </Field>

        <Field>
          <FieldLabel>Priority</FieldLabel>
          <Choicebox
            className="grid grid-cols-3 gap-2"
            onValueChange={(value) => set('priority', value)}
            value={form.priority}
          >
            {PRIORITIES.map((option) => (
              <ChoiceboxItem
                id={`priority-${option.value}`}
                key={option.value}
                value={option.value}
              >
                <ChoiceboxItemHeader>
                  <ChoiceboxItemTitle>{option.label}</ChoiceboxItemTitle>
                </ChoiceboxItemHeader>
                <ChoiceboxIndicator />
              </ChoiceboxItem>
            ))}
          </Choicebox>
        </Field>

        <Field>
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
          <Textarea
            id={notesId}
            maxLength={2000}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            value={form.notes}
          />
        </Field>
      </FieldGroup>
    </form>
  )
}
