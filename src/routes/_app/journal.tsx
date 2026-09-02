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
import { DateField } from '#/components/date-field'
import { Pill } from '#/components/kibo-ui/pill'
import { Markdown } from '#/components/markdown'
import { RevealMore, useReveal } from '#/components/reveal'
import { Button } from '#/components/ui/button'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import {
  formatKeyDayNumber,
  formatKeyMonth,
  formatKeyWeekday,
  todayKey,
} from '#/lib/datetime'
import { journalQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import { saveDay } from '#/server/journal'

export const Route = createFileRoute('/_app/journal')({
  component: Journal,
  // The focused day lives in the URL rather than in component state, so the
  // command palette can send you straight to a day and the back button takes
  // you back to the whole list.
  //
  // A plain function rather than a zod schema. One optional date is not worth
  // dragging zod into the chunk this route shares with the rest of the app,
  // which measured 78kB of client JavaScript for this one field.
  validateSearch: (search: Record<string, unknown>): { date?: string } =>
    typeof search.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.date)
      ? { date: search.date }
      : {},
  loader: ({ context }) => context.queryClient.ensureQueryData(journalQuery),
})

type Day = ReturnType<typeof useJournal>['days'][number]

function useJournal() {
  const { data } = useSuspenseQuery(journalQuery)
  const today = todayKey()

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
          attachmentCount: 0,
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
  const { date: extraDate = '' } = Route.useSearch()
  const navigate = Route.useNavigate()

  const setExtraDate = (date: string) =>
    navigate({ search: date ? { date } : {}, replace: true })

  // Picking a date focuses that one day rather than slotting it into the list.
  // Sorted in, a past date landed hundreds of pixels down with no feedback,
  // which read as the picker doing nothing at all.
  const shown = useMemo(() => {
    if (!extraDate) return days

    const existing = days.find((day) => day.date === extraDate)
    if (existing) return [existing]

    return [
      {
        id: -2,
        date: extraDate,
        attachmentCount: 0,
        kind: 'journal' as const,
        title: null,
        body: null,
        courseId: null,
        location: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
  }, [days, extraDate])

  /*
   * Small slices, because a day is a whole markdown body and not a line. The
   * chosen date resets the count: focusing one day and coming back should
   * start at the top of the list rather than wherever you had scrolled to.
   */
  const reveal = useReveal(shown, 12, extraDate)

  let lastMonth = ''

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <header className="mb-8">
        <h1 className="font-semibold text-2xl tracking-tight">Journal</h1>
      </header>

      <div className="mb-8 flex flex-wrap items-end gap-2">
        {/* Capped, because a date needs about 200px and stretching one
            across a whole phone screen looks like a mistake. */}
        <Field className="min-w-0 max-w-52 flex-1">
          <FieldLabel htmlFor="journal-jump">
            {extraDate ? 'Showing one day' : 'Write on another day'}
          </FieldLabel>
          <DateField
            id="journal-jump"
            label="Write on another day"
            onChange={setExtraDate}
            value={extraDate}
          />
        </Field>
        {extraDate && (
          <Button
            className="min-h-11"
            onClick={() => setExtraDate('')}
            variant="secondary"
          >
            Back to all days
          </Button>
        )}
      </div>

      <div className="space-y-10">
        {reveal.shown.map((day) => {
          const month = formatKeyMonth(day.date)
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

      <RevealMore noun="earlier" reveal={reveal} />
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

  /*
   * Seeded here rather than only at mount. A line logged from Today lands in
   * this same row, and the refetch that brings it back does not change the id,
   * so the row never remounts and state held from the first render is still
   * the body as it was before that line. Editing from that and saving wrote
   * the old body straight back over the new one.
   */
  const startEditing = () => {
    setTitle(day.title ?? '')
    setBody(day.body ?? '')
    setEditing(true)
  }

  const save = useMutation({
    mutationFn: () => saveDay({ data: { date: day.date, title, body } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalQuery.queryKey })
      setEditing(false)
    },
  })

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
          {formatKeyDayNumber(day.date)}
        </p>
        <p className="mt-1 text-xs">{formatKeyWeekday(day.date)}</p>
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
                onClick={startEditing}
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
            onClick={startEditing}
            type="button"
          >
            Nothing written yet.
          </button>
        )}

        {/* The list fetches, so days with nothing attached never mount one.
            The count comes down with the entry, which is what makes that
            answerable without asking. */}
        {day.id > 0 &&
          (editing ? (
            <AttachmentsPanel logEntryId={day.id} />
          ) : (
            day.attachmentCount > 0 && (
              <AttachmentsList owner={{ logEntryId: day.id }} />
            )
          ))}
      </div>
    </article>
  )
}
