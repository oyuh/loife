import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  NotebookPen,
  Plus,
} from 'lucide-react'
import { useEffect, useMemo } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '#/components/ui/command'
import { Kbd } from '#/components/ui/kbd'
import { itemsQuery, journalQuery } from '#/lib/queries'
import { FILTER_HINTS, type Searchable, search } from '#/lib/search'

const dayFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
})

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

  const index = useMemo<(Searchable & { id: number; label: string })[]>(() => {
    const fromItems = items.map((item) => ({
      id: item.id,
      label: item.name,
      kind: 'item' as const,
      title: item.name,
      body: item.notes ?? '',
      date: item.dueAt,
      courseCode: item.course?.code ?? item.course?.name ?? null,
      type: item.type,
      priority: item.priority,
      status: item.status,
      // The list query carries no attachment count, so has:file would lie if
      // this guessed. It stays false until the query provides one.
      hasAttachment: false,
    }))

    const fromDays = days.map((day) => ({
      id: day.id,
      label: day.title ?? day.date,
      kind: 'journal' as const,
      title: day.title ?? '',
      body: day.body ?? '',
      date: new Date(`${day.date}T00:00:00`),
      courseCode: null,
      type: null,
      priority: null,
      status: null,
      hasAttachment: false,
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
      description="Search everything, or jump somewhere"
      onOpenChange={onOpenChange}
      open={open}
      // Filtering lives in the query language, so cmdk must not also filter.
      commandProps={{ shouldFilter: false }}
      title="Search"
    >
      <CommandInput
        onValueChange={onQueryChange}
        placeholder="Search, or try in:cs2340 p:1 has:file before:2026-10-01"
        value={query}
      />

      <CommandList className="max-h-[60dvh]">
        {query.trim() ? (
          <>
            <CommandEmpty>Nothing matches that.</CommandEmpty>

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
                        result.date ? dayFormat.format(result.date) : null,
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
                    onSelect={() => run(() => navigate({ to: '/journal' }))}
                    value={`day-${result.id}`}
                  >
                    <NotebookPen />
                    <span className="truncate">
                      {result.label || 'Untitled day'}
                    </span>
                    <CommandShortcut>
                      {result.date ? dayFormat.format(result.date) : ''}
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
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
