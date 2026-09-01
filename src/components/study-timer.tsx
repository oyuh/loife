import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Play, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ClockText } from '#/components/date-time'
import { Button } from '#/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { itemsQuery } from '#/lib/queries'
import { currentSession, startSession, stopSession } from '#/server/study'

const LENGTHS = [15, 25, 45, 60, 90]

function elapsedLabel(from: Date, now: number) {
  const seconds = Math.max(0, Math.floor((now - +from) / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * A study session, folded away until you want it.
 *
 * Collapsed it is one row, the same height as the plan above it, because a
 * timer used a few times a day should not own the top of the page. The running
 * clock and the stop button stay on that row, so a session in progress never
 * needs opening.
 *
 * Time is measured from the recorded start rather than counted up in the
 * browser, so closing the tab or locking the phone does not lose the session.
 * The tick here only redraws the number.
 */
export function StudyTimer() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [itemId, setItemId] = useState('none')
  const [planned, setPlanned] = useState('25')
  const [tick, setTick] = useState(() => Date.now())

  const { data: running } = useQuery({
    queryKey: ['study-session'],
    queryFn: () => currentSession(),
    // A session started on another device should show up here before long.
    refetchInterval: 60_000,
  })

  const { data: items = [] } = useQuery(itemsQuery)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['study-session'] })
    queryClient.invalidateQueries({ queryKey: ['studied-by-item'] })
    queryClient.invalidateQueries({ queryKey: itemsQuery.queryKey })
  }

  const start = useMutation({
    mutationFn: () =>
      startSession({
        data: {
          itemId: itemId !== 'none' ? Number(itemId) : null,
          subject: subject.trim() || null,
          plannedMinutes: planned ? Number(planned) : null,
        },
      }),
    onSuccess: () => {
      refresh()
      // Nothing left to fill in, so fold it back down.
      setOpen(false)
    },
    onError: () => toast.error('Could not start that'),
  })

  const stop = useMutation({
    mutationFn: () => stopSession(),
    onSuccess: ({ minutes }) => {
      refresh()
      toast.success(`Logged ${minutes} minutes`)
      setSubject('')
    },
    onError: () => toast.error('Could not stop that'),
  })

  const overrun =
    running?.plannedMinutes != null &&
    (tick - +running.startedAt) / 60_000 > running.plannedMinutes

  const runningLabel = running
    ? (running.itemName ?? running.subject ?? 'Studying')
    : 'Study session'

  let subLabel = 'Log time towards something'
  if (running) {
    subLabel = running.plannedMinutes
      ? `${running.plannedMinutes} minute session${overrun ? ' · over' : ''}`
      : 'Open ended'
  }

  return (
    <Collapsible
      className="rounded-lg border border-border"
      onOpenChange={setOpen}
      open={open}
    >
      <div className="flex items-center gap-3 pr-3">
        <CollapsibleTrigger className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 text-left">
          <BookOpen
            aria-hidden="true"
            className={`size-4 shrink-0 ${running ? 'text-primary' : 'text-muted-foreground'}`}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-sm">
              {runningLabel}
            </span>
            <span className="block text-muted-foreground text-xs">
              {subLabel}
            </span>
          </span>
          {running ? (
            <span
              className={`shrink-0 font-semibold text-sm tabular-nums ${overrun ? 'text-destructive' : ''}`}
            >
              {elapsedLabel(running.startedAt, tick)}
            </span>
          ) : (
            <span className="shrink-0 text-muted-foreground text-xs">
              {open ? 'Hide' : 'Show'}
            </span>
          )}
        </CollapsibleTrigger>

        {/* Stopping is the one thing worth reaching without opening anything. */}
        {running && (
          <Button
            className="min-h-11 shrink-0"
            disabled={stop.isPending}
            onClick={() => stop.mutate()}
            size="sm"
          >
            <Square />
            Stop
          </Button>
        )}
      </div>

      <CollapsibleContent className="space-y-3 border-border border-t px-4 py-4">
        {running ? (
          <p className="text-muted-foreground text-sm">
            Started at <ClockText value={running.startedAt} />. Stop it to log
            the time, which comes off what this needs before it is due.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Select onValueChange={setItemId} value={itemId}>
                <SelectTrigger
                  aria-label="What for"
                  className="h-11 min-w-0 flex-1"
                >
                  <SelectValue placeholder="What for" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Something else</SelectItem>
                  {items
                    .filter((item) => item.status !== 'done')
                    .map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.course?.code ? `${item.course.code} · ` : ''}
                        {item.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select onValueChange={setPlanned} value={planned}>
                <SelectTrigger
                  aria-label="How long"
                  className="h-11 w-28 shrink-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LENGTHS.map((length) => (
                    <SelectItem key={length} value={String(length)}>
                      {length} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {itemId === 'none' && (
              <Input
                aria-label="What are you studying"
                className="h-11"
                maxLength={200}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="What are you studying?"
                value={subject}
              />
            )}

            <Button
              className="min-h-11 w-full"
              disabled={
                start.isPending || (itemId === 'none' && !subject.trim())
              }
              onClick={() => start.mutate()}
            >
              <Play />
              Start
            </Button>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
