import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
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
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { toDueValue } from '#/lib/due-date'
import { coursesQuery, itemsQuery } from '#/lib/queries'
import { createItem } from '#/server/items'

// Native selects on purpose. On a phone they open the OS picker, which beats
// any styled dropdown, the same reason the date and time inputs stay native.
const FIELD =
  'flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-base ' +
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [form, setForm] = useState(EMPTY)
  const queryClient = useQueryClient()
  const { data: courses = [] } = useQuery({ ...coursesQuery, enabled: open })

  const set = <K extends keyof typeof EMPTY>(key: K, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const save = useMutation({
    mutationFn: () => {
      const { dueAt, allDay } = toDueValue({ date: form.date, time: form.time })
      return createItem({
        data: {
          name: form.name,
          courseId: form.courseId ? Number(form.courseId) : null,
          type: form.type as 'assignment' | 'exam' | 'task' | 'reading',
          dueAt,
          allDay,
          priority: form.priority as 'low' | 'normal' | 'high',
          location: form.location,
          notes: form.notes,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsQuery.queryKey })
      toast.success(`Added ${form.name.trim()}`)
      setForm(EMPTY)
      onOpenChange(false)
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : 'Could not save that',
      ),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!save.isPending) onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add assignment</DialogTitle>
          <DialogDescription>
            Leave the time empty for anything due by the end of the day.
          </DialogDescription>
        </DialogHeader>

        <form
          id="add-item"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <Field label="Name">
            {(id) => (
              <Input
                id={id}
                required
                maxLength={200}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="h-11"
                placeholder="Problem set 7"
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Course">
              {(id) => (
                <select
                  id={id}
                  className={FIELD}
                  value={form.courseId}
                  onChange={(e) => set('courseId', e.target.value)}
                >
                  <option value="">No course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code ?? course.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Type">
              {(id) => (
                <select
                  id={id}
                  className={FIELD}
                  value={form.type}
                  onChange={(e) => set('type', e.target.value)}
                >
                  <option value="assignment">Assignment</option>
                  <option value="exam">Exam</option>
                  <option value="task">Task</option>
                  <option value="reading">Reading</option>
                </select>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Due">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                  className="h-11"
                />
              )}
            </Field>

            <Field label="Time" hint="optional">
              {(id) => (
                <Input
                  id={id}
                  type="time"
                  value={form.time}
                  onChange={(e) => set('time', e.target.value)}
                  className="h-11"
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              {(id) => (
                <select
                  id={id}
                  className={FIELD}
                  value={form.priority}
                  onChange={(e) => set('priority', e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              )}
            </Field>

            <Field label="Location" hint="optional">
              {(id) => (
                <Input
                  id={id}
                  maxLength={200}
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  className="h-11"
                  placeholder="ECSS 2.410"
                />
              )}
            </Field>
          </div>

          <Field label="Notes" hint="optional">
            {(id) => (
              <Textarea
                id={id}
                maxLength={2000}
                rows={3}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            )}
          </Field>
        </form>

        <DialogFooter>
          <Button
            type="submit"
            form="add-item"
            disabled={save.isPending || !form.name.trim()}
            className="min-h-11 w-full sm:w-auto"
          >
            {save.isPending ? 'Saving…' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Owns the generated id and hands it to the control, so the association is
 * explicit rather than relying on the label wrapping its input.
 */
function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: (id: string) => React.ReactNode
}) {
  const id = useId()

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {hint && (
          <span className="ml-1 font-normal text-muted-foreground">{hint}</span>
        )}
      </label>
      {children(id)}
    </div>
  )
}
