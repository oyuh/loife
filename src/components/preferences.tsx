import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { calendarStatus, savePreferences } from '#/server/calendar'

/** Null uses the per-priority defaults, a number fixes the delay. */
const CHOICES = [
  { value: 'auto', label: 'Work it out from priority' },
  { value: '0', label: 'Hide straight away' },
  { value: '5', label: 'After 5 minutes' },
  { value: '30', label: 'After 30 minutes' },
  { value: '120', label: 'After 2 hours' },
  { value: '480', label: 'After 8 hours' },
  { value: '1440', label: 'After a day' },
] as const

export function Preferences() {
  const queryClient = useQueryClient()

  const { data: status } = useQuery({
    queryKey: ['calendar-status'],
    queryFn: () => calendarStatus(),
  })

  const save = useMutation({
    mutationFn: (value: string) =>
      savePreferences({
        data: {
          hideCompletedAfterMinutes: value === 'auto' ? null : Number(value),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-status'] })
      toast.success('Saved')
    },
    onError: () => toast.error('Could not save that'),
  })

  if (!status) return null

  const current =
    status.hideCompletedAfterMinutes === null
      ? 'auto'
      : String(status.hideCompletedAfterMinutes)

  return (
    <div className="space-y-1.5 rounded-lg border border-border p-4">
      <p className="font-medium text-sm">Hide finished work</p>
      <p className="text-muted-foreground text-sm">
        Ticking is one tap and easy to do by accident, so nothing disappears
        immediately. Left to itself a P1 lingers two hours and a P5 ten minutes.
      </p>
      <Select onValueChange={(value) => save.mutate(value)} value={current}>
        <SelectTrigger
          aria-label="Hide finished work"
          className="mt-2 h-11 w-full sm:w-72"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CHOICES.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** The hours the planner is allowed to fill. */
export function DayWindow() {
  const queryClient = useQueryClient()

  const { data: status } = useQuery({
    queryKey: ['calendar-status'],
    queryFn: () => calendarStatus(),
  })

  const save = useMutation({
    mutationFn: (patch: { dayStart?: string; dayEnd?: string }) =>
      savePreferences({
        data: {
          hideCompletedAfterMinutes: status?.hideCompletedAfterMinutes ?? null,
          ...patch,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-status'] })
      toast.success('Saved')
    },
    onError: () => toast.error('Could not save that'),
  })

  if (!status) return null

  return (
    <div className="space-y-1.5 rounded-lg border border-border p-4">
      <p className="font-medium text-sm">Hours to plan into</p>
      <p className="text-muted-foreground text-sm">
        Plan my day only suggests times inside this window, and never over a
        class.
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs" htmlFor="day-start">
            From
          </label>
          <Input
            className="h-11 w-32"
            defaultValue={status.dayStart.slice(0, 5)}
            id="day-start"
            onBlur={(event) => save.mutate({ dayStart: event.target.value })}
            type="time"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs" htmlFor="day-end">
            Until
          </label>
          <Input
            className="h-11 w-32"
            defaultValue={status.dayEnd.slice(0, 5)}
            id="day-end"
            onBlur={(event) => save.mutate({ dayEnd: event.target.value })}
            type="time"
          />
        </div>
      </div>
    </div>
  )
}
