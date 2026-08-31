import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarIcon, ChevronDown } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { AttachmentsList, attachmentsKey } from '#/components/attachments-list'
import { MarkdownField } from '#/components/markdown-field'
import { StagedFiles } from '#/components/staged-files'
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
import { Field, FieldLabel } from '#/components/ui/field'
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
  { value: 'task', label: 'To do' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'reading', label: 'Reading' },
  { value: 'exam', label: 'Exam' },
] as const

const EMPTY = {
  name: '',
  courseId: 'none',
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
      courseId: item.course ? String(item.course.id) : 'none',
      type: item.type,
      date: due.date,
      time: due.time,
      priority: String(item.priority),
      location: item.location ?? '',
      notes: item.notes ?? '',
    })
  }, [open, item])

  const save = useMutation({
    mutationFn: async () => {
      const { dueAt, allDay } = toDueValue({ date: form.date, time: form.time })
      const payload = {
        name: form.name,
        courseId: form.courseId !== 'none' ? Number(form.courseId) : null,
        type: form.type as (typeof TYPES)[number]['value'],
        dueAt,
        allDay,
        priority: Number(form.priority),
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
 * Name, then when, then what kind. Everything optional is folded away, so the
 * common case is three controls rather than nine.
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

  return (
    <form
      className="space-y-5 pb-2"
      id="item-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
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
              className="min-h-11 flex-1"
              key={option.value}
              value={option.value}
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field>
        <FieldLabel>When</FieldLabel>
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
                  {due ? format(due, 'EEE d MMM') : 'No due date'}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                onSelect={(next) =>
                  set(
                    'date',
                    next ? toDueFields({ dueAt: next, allDay: true }).date : '',
                  )
                }
                selected={due}
              />
            </PopoverContent>
          </Popover>

          <Input
            aria-label="Time, optional"
            className="h-11 w-28 shrink-0"
            onChange={(event) => set('time', event.target.value)}
            type="time"
            value={form.time}
          />
        </div>
      </Field>

      <Field>
        <FieldLabel>Priority</FieldLabel>
        <ToggleGroup
          className="w-full"
          onValueChange={(value: string) => value && set('priority', value)}
          type="single"
          value={form.priority}
          variant="outline"
        >
          {PRIORITY_LEVELS.map((level) => (
            <ToggleGroupItem
              className="min-h-11 flex-1"
              key={level}
              title={PRIORITY_LABELS[level]}
              value={String(level)}
            >
              P{level}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-muted-foreground text-xs">
          {PRIORITY_LABELS[Number(form.priority)]}
        </p>
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
          Course, place, notes, files
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-5 pt-4">
          <Field>
            <FieldLabel>Course</FieldLabel>
            <Select
              onValueChange={(value) => set('courseId', value)}
              value={form.courseId}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No course</SelectItem>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={String(course.id)}>
                    {course.code
                      ? `${course.code} · ${course.name}`
                      : course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

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
        </CollapsibleContent>
      </Collapsible>
    </form>
  )
}
