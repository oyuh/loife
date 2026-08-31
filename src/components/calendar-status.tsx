import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, CalendarX, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { itemsQuery } from '#/lib/queries'
import { calendarStatus, reconcileCalendar } from '#/server/calendar'

/**
 * Whether the calendar is actually connected, and a way to push anything it
 * has not caught up on.
 *
 * Sync failures are logged rather than thrown, so that a Google outage cannot
 * fail a save. The cost is that they are invisible, which is what this is for.
 */
export function CalendarStatus() {
  const queryClient = useQueryClient()

  const { data: status } = useQuery({
    queryKey: ['calendar-status'],
    queryFn: () => calendarStatus(),
  })

  const push = useMutation({
    mutationFn: () => reconcileCalendar(),
    onSuccess: ({ pushed }) => {
      queryClient.invalidateQueries({ queryKey: itemsQuery.queryKey })
      toast.success(
        pushed === 0
          ? 'Calendar already up to date'
          : `Pushed ${pushed} to your calendar`,
      )
    },
    onError: () => toast.error('Could not reach Google Calendar'),
  })

  if (!status) return null

  if (!status.connected) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border border-dashed p-4">
        <CalendarX
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
        <p className="min-w-0 flex-1 text-muted-foreground text-sm">
          Google Calendar is not connected, so nothing reaches Notion Calendar
          yet.
        </p>
        <Button asChild className="min-h-11" size="sm">
          <a href="/api/google/connect">Connect</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
      <CalendarCheck aria-hidden="true" className="size-4 text-primary" />
      <p className="min-w-0 flex-1 text-muted-foreground text-sm">
        Syncing to the <span className="text-foreground">loife</span> calendar.
        Class meetings remind 10 minutes ahead, assignments the morning before,
        exams a day earlier again.
      </p>
      <Button
        className="min-h-11"
        disabled={push.isPending}
        onClick={() => push.mutate()}
        size="sm"
        variant="secondary"
      >
        <RefreshCw />
        {push.isPending ? 'Pushing…' : 'Push now'}
      </Button>
    </div>
  )
}
