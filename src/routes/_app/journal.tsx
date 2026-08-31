import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Check, PencilLine } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AttachmentsList } from '#/components/attachments-list'
import { AttachmentsPanel } from '#/components/attachments-panel'
import { Pill } from '#/components/kibo-ui/pill'
import { Markdown } from '#/components/markdown'
import { Button } from '#/components/ui/button'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { localDateString } from '#/lib/calendar-event'
import { journalQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import { saveDay } from '#/server/journal'

export const Route = createFileRoute('/_app/journal')({
  component: Journal,
  loader: ({ context }) => context.queryClient.ensureQueryData(journalQuery),
})

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const dayNumberFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric' })
const monthFormat = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
})

type Day = ReturnType<typeof useJournal>['days'][number]

function asDate(date: string) {
  // Built from the string with a local midnight, since a bare date parses UTC.
  return new Date(`${date}T00:00:00`)
}

function useJournal() {
  const { data } = useSuspenseQuery(journalQuery)
  const today = localDateString(new Date())

  // Today always has a place to write, even before a row exists for it.
  const hasToday = data.some(
    (entry) => entry.date === today && entry.kind === 'journal',
  )
  const days = hasToday
    ? data
    : [
        {
          id: -1,
          date: today,
          kind: 'journal' as const,
          title: null,
          body: null,
          courseId: null,
          location: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        ...data,
      ]

  return { days, today }
}

function Journal() {
  const { days, today } = useJournal()
  const [extraDate, setExtraDate] = useState('')

  // A day picked here is prepended so it can be written into before it exists,
  // which is what makes planning ahead possible rather than only looking back.
  const shown = useMemo(() => {
    if (!extraDate || days.some((day) => day.date === extraDate)) return days
    const placeholder = {
      id: -2,
      date: extraDate,
      kind: 'journal' as const,
      title: null,
      body: null,
      courseId: null,
      location: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    return [...days, placeholder].sort((a, b) => b.date.localeCompare(a.date))
  }, [days, extraDate])

  let lastMonth = ''

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <header className="mb-8">
        <h1 className="font-semibold text-2xl tracking-tight">Journal</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          A page per day. Today is always ready to write in, and you can pick
          any other date, ahead or behind.
        </p>
      </header>

      <div className="mb-8 flex flex-wrap items-end gap-2">
        <Field className="min-w-0 flex-1">
          <FieldLabel htmlFor="journal-jump">Write on another day</FieldLabel>
          <Input
            className="h-11"
            id="journal-jump"
            onChange={(event) => setExtraDate(event.target.value)}
            type="date"
            value={extraDate}
          />
        </Field>
        {extraDate && (
          <Button
            className="min-h-11"
            onClick={() => setExtraDate('')}
            variant="ghost"
          >
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-10">
        {shown.map((day) => {
          const month = monthFormat.format(asDate(day.date))
          const showMonth = month !== lastMonth
          lastMonth = month

          return (
            <div key={`${day.date}-${day.id}`}>
              {showMonth && (
                <p className="mb-4 border-border border-b pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  {month}
                </p>
              )}
              <DayEntry
                day={day}
                isToday={day.date === today}
                todayIso={today}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DayEntry({
  day,
  isToday,
  todayIso,
}: {
  day: Day
  isToday: boolean
  todayIso: string
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(
    (isToday || day.id === -2) && !day.body,
  )
  const [title, setTitle] = useState(day.title ?? '')
  const [body, setBody] = useState(day.body ?? '')

  const save = useMutation({
    mutationFn: () => saveDay({ data: { date: day.date, title, body } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalQuery.queryKey })
      setEditing(false)
    },
  })

  const date = asDate(day.date)

  return (
    <article className="flex gap-4">
      {/* A date rail down the left, the way a paper journal reads. */}
      <div
        className={cn(
          'w-12 shrink-0 pt-0.5 text-right',
          isToday ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        <p className="font-semibold text-2xl leading-none tabular-nums">
          {dayNumberFormat.format(date)}
        </p>
        <p className="mt-1 text-xs">{weekdayFormat.format(date)}</p>
      </div>

      <div className="min-w-0 flex-1 space-y-2 border-border border-l pl-4">
        <div className="flex min-h-8 items-center gap-2">
          {editing ? (
            <Input
              className="h-9"
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="A name for the day, optional"
              value={title}
            />
          ) : (
            <>
              <h2 className="font-medium">
                {day.title ??
                  (isToday ? 'Today' : day.date > todayIso ? 'Planned' : '')}
              </h2>
              {day.kind === 'event' && <Pill>Event</Pill>}
              <Button
                aria-label={`Edit ${day.date}`}
                className="ml-auto h-8"
                onClick={() => setEditing(true)}
                size="sm"
                variant="ghost"
              >
                <PencilLine />
              </Button>
            </>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea
              // biome-ignore lint/a11y/noAutofocus: the button exists to type here
              autoFocus={!isToday}
              className="min-h-40"
              onChange={(event) => setBody(event.target.value)}
              placeholder="What happened. Markdown works."
              value={body}
            />
            <div className="flex gap-2">
              <Button
                className="min-h-10"
                disabled={save.isPending}
                onClick={() => save.mutate()}
                size="sm"
              >
                <Check />
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
              {!isToday && (
                <Button
                  className="min-h-10"
                  onClick={() => {
                    setTitle(day.title ?? '')
                    setBody(day.body ?? '')
                    setEditing(false)
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : day.body ? (
          <Markdown>{day.body}</Markdown>
        ) : (
          <button
            className="text-left text-muted-foreground text-sm italic"
            onClick={() => setEditing(true)}
            type="button"
          >
            Nothing written yet.
          </button>
        )}

        {day.id > 0 &&
          (editing ? (
            <AttachmentsPanel logEntryId={day.id} />
          ) : (
            <AttachmentsList owner={{ logEntryId: day.id }} />
          ))}
      </div>
    </article>
  )
}
