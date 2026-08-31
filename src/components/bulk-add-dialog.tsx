import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
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
import { Textarea } from '#/components/ui/textarea'
import { toDueFields, toDueValue } from '#/lib/due-date'
import { parseSyllabus } from '#/lib/parse-syllabus'
import { coursesQuery, itemsQuery } from '#/lib/queries'
import { useMediaQuery } from '#/lib/use-media-query'
import { createItems } from '#/server/items'

const PLACEHOLDER = `HW1 - Sep 5
Problem set 6 — 9/12
Midterm 2, October 14
Essay draft 10/3 5pm`

interface DraftRow {
  key: string
  name: string
  date: string
  time: string
}

export function BulkAddDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [text, setText] = useState('')
  const [edited, setEdited] = useState<Record<string, Partial<DraftRow>>>({})
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [courseId, setCourseId] = useState('')
  const [type, setType] = useState('assignment')
  const [priority, setPriority] = useState('normal')

  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery('(min-width: 640px)')
  const pasteId = useId()
  const { data: courses = [] } = useQuery({ ...coursesQuery, enabled: open })

  // Reparsing on every keystroke is fine here. Even a long syllabus is a few
  // dozen lines of regex, and it keeps the preview honest about what will
  // actually be created.
  const rows = useMemo<DraftRow[]>(() => {
    return parseSyllabus(text).map((parsed, index) => {
      const key = `${index}-${parsed.raw}`
      const fields = toDueFields({ dueAt: parsed.dueAt, allDay: parsed.allDay })
      return {
        key,
        name: parsed.name,
        date: fields.date,
        time: fields.time,
        ...edited[key],
      }
    })
  }, [text, edited])

  const kept = rows.filter((row) => !removed.has(row.key) && row.name.trim())

  const reset = () => {
    setText('')
    setEdited({})
    setRemoved(new Set())
  }

  const save = useMutation({
    mutationFn: () =>
      createItems({
        data: {
          items: kept.map((row) => {
            const { dueAt, allDay } = toDueValue({
              date: row.date,
              time: row.time,
            })
            return {
              name: row.name,
              courseId:
                courseId && courseId !== 'none' ? Number(courseId) : null,
              type: type as 'assignment' | 'exam' | 'task' | 'reading',
              dueAt,
              allDay,
              priority: priority as 'low' | 'normal' | 'high',
              location: null,
              notes: null,
            }
          }),
        },
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: itemsQuery.queryKey })
      toast.success(`Added ${result.count} items`)
      reset()
      onOpenChange(false)
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : 'Could not save those',
      ),
  })

  const undated = kept.filter((row) => !row.date).length

  const body = (
    <div className="space-y-4 pb-2">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={pasteId}>Paste your syllabus</FieldLabel>
          <Textarea
            className="min-h-32 font-mono text-sm"
            id={pasteId}
            onChange={(event) => {
              setText(event.target.value)
              setEdited({})
              setRemoved(new Set())
            }}
            placeholder={PLACEHOLDER}
            value={text}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field>
            <FieldLabel>Course</FieldLabel>
            <Select onValueChange={setCourseId} value={courseId || 'none'}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No course</SelectItem>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={String(course.id)}>
                    {course.code ?? course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select onValueChange={setType} value={type}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assignment">Assignment</SelectItem>
                <SelectItem value="exam">Exam</SelectItem>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="reading">Reading</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Priority</FieldLabel>
            <Select onValueChange={setPriority} value={priority}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </FieldGroup>

      {rows.length > 0 && (
        <section className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {kept.length} to add
            {undated > 0 && `, ${undated} without a date`}. Correct anything the
            parser read wrong.
          </p>

          <ul className="divide-y divide-border border-border border-y">
            {rows.map((row) => {
              const gone = removed.has(row.key)

              return (
                <li
                  className="flex flex-wrap items-end gap-2 py-2 data-[gone=true]:opacity-40"
                  data-gone={gone}
                  key={row.key}
                >
                  <Input
                    aria-label={`Name for ${row.name}`}
                    className="h-10 min-w-40 flex-1"
                    disabled={gone}
                    onChange={(event) =>
                      setEdited((prev) => ({
                        ...prev,
                        [row.key]: {
                          ...prev[row.key],
                          name: event.target.value,
                        },
                      }))
                    }
                    value={row.name}
                  />
                  <Input
                    aria-label={`Due date for ${row.name}`}
                    className="h-10 w-36"
                    disabled={gone}
                    onChange={(event) =>
                      setEdited((prev) => ({
                        ...prev,
                        [row.key]: {
                          ...prev[row.key],
                          date: event.target.value,
                        },
                      }))
                    }
                    type="date"
                    value={row.date}
                  />
                  <Input
                    aria-label={`Due time for ${row.name}`}
                    className="h-10 w-28"
                    disabled={gone}
                    onChange={(event) =>
                      setEdited((prev) => ({
                        ...prev,
                        [row.key]: {
                          ...prev[row.key],
                          time: event.target.value,
                        },
                      }))
                    }
                    type="time"
                    value={row.time}
                  />
                  <Button
                    aria-label={
                      gone ? `Restore ${row.name}` : `Skip ${row.name}`
                    }
                    className="min-h-10"
                    onClick={() =>
                      setRemoved((prev) => {
                        const next = new Set(prev)
                        if (next.has(row.key)) next.delete(row.key)
                        else next.add(row.key)
                        return next
                      })
                    }
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 />
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )

  const submit = (
    <Button
      className="min-h-11 w-full sm:w-auto"
      disabled={save.isPending || kept.length === 0}
      onClick={() => save.mutate()}
      type="button"
    >
      {save.isPending ? 'Adding…' : `Add ${kept.length || ''}`.trim()}
    </Button>
  )

  const close = (next: boolean) => {
    if (!save.isPending) onOpenChange(next)
  }

  const title = 'Bulk add'
  const description =
    'One deadline per line. Dates are read from the text and can be corrected below.'

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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
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
