import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  BookOpen,
  CalendarCheck,
  CalendarPlus,
  ClipboardList,
  History,
  NotebookPen,
  Plus,
  Settings,
} from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '#/components/ui/command'
import { Kbd } from '#/components/ui/kbd'
import { Textarea } from '#/components/ui/textarea'
import {
  formatKeyDayLong,
  formatKeyMonthDay,
  formatKeyRelative,
  formatMonthDay,
  shiftDateKey,
  todayKey,
} from '#/lib/datetime'
import { itemsQuery, journalQuery } from '#/lib/queries'
import { FILTER_HINTS, type Searchable, search } from '#/lib/search'
import { appendToDay } from '#/server/journal'

/*
 * Writing on a day is the journal action worth a command. Everything else
 * about a day is on the page itself, which reads the date off the URL.
 *
 * These do double duty. With the box empty they open the day. With something
 * typed they log it there instead, so the search field is also the quick
 * capture box, and yesterday gets a line without a trip to the page.
 */
const JOURNAL_DAYS = [
  { noun: 'today', offset: 0 },
  { noun: 'yesterday', offset: -1 },
  { noun: 'tomorrow', offset: 1 },
] as const

export function CommandPalette({
  onAddItem,
  onBulkAdd,
  open,
  onOpenChange,
  onOpenItem,
  query,
  onQueryChange,
}: {
  onAddItem: () => void
  onBulkAdd: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenItem: (id: number) => void
  query: string
  onQueryChange: (query: string) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // The day being written into, and whatever was already typed in the
  // search box when the day was picked. Null is the ordinary palette.
  const [composing, setComposing] = useState<{
    date: string
    seed: string
  } | null>(null)

  // The query is left alone rather than cleared, so backing out of the
  // panel puts you back on the search you were in the middle of.
  const openCompose = (date: string) =>
    setComposing({ date, seed: query.trim() })

  const logLine = useMutation({
    mutationFn: (input: { text: string; date: string }) =>
      appendToDay({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalQuery.queryKey })
      toast.success('Logged')
      setComposing(null)
      onQueryChange('')
      onOpenChange(false)
    },
    // The panel stays open and keeps the text, so a failure never eats
    // what was written.
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : 'Could not log that',
      ),
  })

  // Only fetched while the palette is open, so opening it pays for the index
  // rather than every page load.
  const { data: items = [] } = useQuery({ ...itemsQuery, enabled: open })
  const { data: days = [] } = useQuery({ ...journalQuery, enabled: open })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k') return
      if (!event.metaKey && !event.ctrlKey) return
      event.preventDefault()
      onOpenChange(!open)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  const index = useMemo<
    (Searchable & { id: number; label: string; day: string | null })[]
  >(() => {
    const fromItems = items.map((item) => ({
      id: item.id,
      label: item.name,
      day: null,
      kind: 'item' as const,
      title: item.name,
      body: item.notes ?? '',
      date: item.dueAt,
      courseCode: item.course?.code ?? item.course?.name ?? null,
      type: item.type,
      priority: item.priority,
      status: item.status,
      hasAttachment: item.attachmentCount > 0,
      location: item.location,
      completedAt: item.completedAt,
      actualMinutes: item.actualMinutes,
      estimatedMinutes: item.estimatedMinutes,
    }))

    const fromDays = days.map((day) => ({
      id: day.id,
      label: day.title ?? day.date,
      day: day.date,
      kind: 'journal' as const,
      title: day.title ?? '',
      body: day.body ?? '',
      date: new Date(`${day.date}T00:00:00`),
      courseCode: null,
      type: null,
      priority: null,
      status: null,
      hasAttachment: false,
      location: null,
      completedAt: null,
      actualMinutes: null,
      estimatedMinutes: null,
    }))

    return [...fromItems, ...fromDays]
  }, [items, days])

  const results = useMemo(
    () => (query.trim() ? search(index, query).slice(0, 30) : []),
    [index, query],
  )

  const run = (action: () => void) => {
    onOpenChange(false)
    onQueryChange('')
    action()
  }

  const foundItems = results.filter((result) => result.kind === 'item')
  const foundDays = results.filter((result) => result.kind === 'journal')

  return (
    <CommandDialog
      className="sm:max-w-2xl"
      description="Run a command, search everything, or jump somewhere"
      onOpenChange={(next) => {
        if (!next) setComposing(null)
        onOpenChange(next)
      }}
      open={open}
      // Filtering lives in the query language, so cmdk must not also filter.
      commandProps={{ shouldFilter: false }}
      title="Command palette"
    >
      {composing ? (
        <ComposePanel
          date={composing.date}
          key={composing.date}
          onCancel={() => setComposing(null)}
          onSubmit={(text) => logLine.mutate({ text, date: composing.date })}
          pending={logLine.isPending}
          seed={composing.seed}
        />
      ) : (
        <>
          <CommandInput
            onValueChange={onQueryChange}
            placeholder="Search, or try in:cs2340 p:1 has:file before:2026-10-01"
            value={query}
          />

          <CommandList className="max-h-[60dvh]">
            {query.trim() ? (
              <>
                {/*
              Ours rather than CommandEmpty, which counts the rows cmdk has
              mounted. The log rows below are always mounted, so by its
              count nothing is ever empty.
            */}
                {foundItems.length === 0 && foundDays.length === 0 && (
                  <p className="py-6 text-center text-muted-foreground text-sm">
                    Nothing matches that. It can still go in the journal.
                  </p>
                )}

                {foundItems.length > 0 && (
                  <CommandGroup heading="Assignments">
                    {foundItems.map((result) => (
                      <CommandItem
                        key={`item-${result.id}`}
                        onSelect={() => run(() => onOpenItem(result.id))}
                        value={`item-${result.id}`}
                      >
                        <CalendarCheck />
                        <span className="truncate">{result.label}</span>
                        <CommandShortcut>
                          {[
                            result.courseCode,
                            result.date ? formatMonthDay(result.date) : null,
                            result.priority !== 3
                              ? `P${result.priority}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </CommandShortcut>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {foundDays.length > 0 && (
                  <CommandGroup heading="Journal">
                    {foundDays.map((result) => (
                      <CommandItem
                        key={`day-${result.id}`}
                        // Straight to the day it found, rather than the top of a
                        // list the day might be a year down.
                        onSelect={() =>
                          run(() =>
                            navigate({
                              to: '/journal',
                              search: result.day ? { date: result.day } : {},
                            }),
                          )
                        }
                        value={`day-${result.id}`}
                      >
                        <NotebookPen />
                        <span className="truncate">
                          {result.label || 'Untitled day'}
                        </span>
                        <CommandShortcut>
                          {result.date ? formatMonthDay(result.date) : ''}
                        </CommandShortcut>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/*
              Last, deliberately. cmdk highlights the first row, and Enter
              after a search has to open what was found rather than write it
              into the journal.
            */}
                <CommandGroup heading={`Log “${query.trim()}” to`}>
                  {JOURNAL_DAYS.map(({ noun, offset }) => {
                    const key = shiftDateKey(todayKey(), offset)
                    return (
                      <CommandItem
                        key={`log-${noun}`}
                        onSelect={() => openCompose(key)}
                        value={`log-${noun}`}
                      >
                        <CalendarPlus />
                        <span>{noun}'s journal</span>
                        <CommandShortcut>
                          {formatKeyMonthDay(key)}
                        </CommandShortcut>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </>
            ) : (
              <>
                <CommandGroup heading="Actions">
                  <CommandItem onSelect={() => run(onAddItem)} value="add">
                    <Plus />
                    <span>Add assignment</span>
                    <CommandShortcut>
                      <Kbd>A</Kbd>
                    </CommandShortcut>
                  </CommandItem>
                  <CommandItem onSelect={() => run(onBulkAdd)} value="bulk">
                    <ClipboardList />
                    <span>Bulk add from a syllabus</span>
                  </CommandItem>
                </CommandGroup>

                <CommandGroup heading="Journal">
                  {JOURNAL_DAYS.map(({ noun, offset }) => {
                    const key = shiftDateKey(todayKey(), offset)
                    return (
                      <CommandItem
                        key={noun}
                        onSelect={() => openCompose(key)}
                        value={`write ${noun}`}
                      >
                        <CalendarPlus />
                        <span>Write in {noun}'s journal</span>
                        <CommandShortcut>
                          {formatKeyMonthDay(key)}
                        </CommandShortcut>
                      </CommandItem>
                    )
                  })}
                  <CommandItem
                    onSelect={() => onQueryChange('kind:journal ')}
                    value="search journal"
                  >
                    <NotebookPen />
                    <span>Search journal entries</span>
                  </CommandItem>
                </CommandGroup>

                <CommandGroup heading="Go to">
                  <CommandItem
                    onSelect={() => run(() => navigate({ to: '/' }))}
                    value="today"
                  >
                    <CalendarCheck />
                    <span>Today</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => run(() => navigate({ to: '/courses' }))}
                    value="courses"
                  >
                    <BookOpen />
                    <span>Courses</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => run(() => navigate({ to: '/journal' }))}
                    value="journal"
                  >
                    <NotebookPen />
                    <span>Journal</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => run(() => navigate({ to: '/history' }))}
                    value="history"
                  >
                    <History />
                    <span>History</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => run(() => navigate({ to: '/settings' }))}
                    value="settings"
                  >
                    <Settings />
                    <span>Settings</span>
                  </CommandItem>
                </CommandGroup>

                {/* Listed rather than documented, so the syntax is discoverable. */}
                <CommandGroup heading="Filters">
                  {FILTER_HINTS.map((hint) => (
                    <CommandItem
                      key={hint.token}
                      onSelect={() => onQueryChange(`${hint.token} `)}
                      value={hint.token}
                    >
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">
                        {hint.token}
                      </code>
                      <span className="text-muted-foreground">
                        {hint.describes}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </>
      )}
    </CommandDialog>
  )
}

/**
 * Writing a line without leaving the palette.
 *
 * It replaces the search box and the list rather than opening a second dialog
 * over the first, so picking a day and writing on it is one surface and one
 * Escape away from where you started.
 */
function ComposePanel({
  date,
  seed,
  pending,
  onCancel,
  onSubmit,
}: {
  date: string
  /** Whatever was in the search box, which is usually the thought itself. */
  seed: string
  pending: boolean
  onCancel: () => void
  onSubmit: (text: string) => void
}) {
  const [text, setText] = useState(seed)
  const fieldId = useId()

  const submit = () => {
    const line = text.trim()
    if (line && !pending) onSubmit(line)
  }

  return (
    <div className="p-3">
      <div className="mb-2 flex items-baseline gap-2">
        <label className="font-medium text-sm" htmlFor={fieldId}>
          {formatKeyDayLong(date)}
        </label>
        <span className="ml-auto text-muted-foreground text-xs">
          {formatKeyRelative(date)}
        </span>
      </div>

      <Textarea
        autoFocus
        className="min-h-32"
        id={fieldId}
        maxLength={2000}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          /*
           * cmdk's root claims the arrows, Home, End and Enter for its list,
           * and Radix closes the dialog on Escape. Neither belongs inside a
           * textarea, and React's stopPropagation stops the native event too,
           * which is what keeps both of them off it.
           */
          event.stopPropagation()

          if (event.key === 'Escape') onCancel()

          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
        placeholder="What happened. Markdown works."
        value={text}
      />

      <div className="mt-2 flex items-center gap-2">
        <p className="text-muted-foreground text-xs">
          <Kbd>Enter</Kbd> to log, <Kbd>Shift</Kbd> <Kbd>Enter</Kbd> for a new
          line
        </p>
        <Button
          className="ml-auto min-h-11"
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Back
        </Button>
        <Button
          className="min-h-11"
          disabled={!text.trim() || pending}
          onClick={submit}
          size="sm"
          type="button"
        >
          {pending ? 'Logging…' : 'Log it'}
        </Button>
      </div>
    </div>
  )
}
