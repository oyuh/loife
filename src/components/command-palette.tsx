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
import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '#/components/ui/command'
import { Kbd } from '#/components/ui/kbd'
import {
  formatKeyMonthDay,
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

  const logLine = useMutation({
    mutationFn: (input: { text: string; date: string }) =>
      appendToDay({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalQuery.queryKey })
      toast.success('Logged')
    },
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
      onOpenChange={onOpenChange}
      open={open}
      // Filtering lives in the query language, so cmdk must not also filter.
      commandProps={{ shouldFilter: false }}
      title="Command palette"
    >
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
                        result.priority !== 3 ? `P${result.priority}` : null,
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
                    onSelect={() =>
                      run(() =>
                        logLine.mutate({ text: query.trim(), date: key }),
                      )
                    }
                    value={`log-${noun}`}
                  >
                    <CalendarPlus />
                    <span>{noun}'s journal</span>
                    <CommandShortcut>{formatKeyMonthDay(key)}</CommandShortcut>
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
                    onSelect={() =>
                      run(() =>
                        navigate({ to: '/journal', search: { date: key } }),
                      )
                    }
                    value={`write ${noun}`}
                  >
                    <CalendarPlus />
                    <span>Write in {noun}'s journal</span>
                    <CommandShortcut>{formatKeyMonthDay(key)}</CommandShortcut>
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
    </CommandDialog>
  )
}
