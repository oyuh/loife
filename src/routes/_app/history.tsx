import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { History as HistoryIcon } from 'lucide-react'
import { useState } from 'react'
import { CourseMark } from '#/components/course-icon'
import { DateTimeText } from '#/components/date-time'
import { Pill } from '#/components/kibo-ui/pill'
import { RevealMore, useReveal } from '#/components/reveal'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Input } from '#/components/ui/input'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '#/components/ui/item'
import { itemsQuery } from '#/lib/queries'
import { FILTER_HINTS, search } from '#/lib/search'
import { listRecentActivity } from '#/server/items'

export const Route = createFileRoute('/_app/history')({
  component: History,
  loader: ({ context }) => context.queryClient.ensureQueryData(itemsQuery),
})

const EVENT_WORDS: Record<string, string> = {
  created: 'Added',
  completed: 'Marked done',
  reopened: 'Reopened',
  moved: 'Moved',
  edited: 'Edited',
}

function minutesLabel(value: number) {
  if (value < 60) return `${value}m`
  const hours = Math.floor(value / 60)
  const rest = value % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

function History() {
  const { data: items } = useSuspenseQuery(itemsQuery)
  const { data: activity = [] } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => listRecentActivity(),
  })
  const [query, setQuery] = useState('')

  // Everything ever, newest finished first, then the rest.
  const index = items.map((item) => ({
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
    item,
  }))

  const matched = (query.trim() ? search(index, query) : index)
    .map((row) => row.item)
    .sort((a, b) => {
      const at = a.completedAt ? +a.completedAt : 0
      const bt = b.completedAt ? +b.completedAt : 0
      return bt - at || b.id - a.id
    })

  // A row is one line, so they come in big slices. The query resets the count,
  // because a filter is a different list rather than the same one shortened.
  const reveal = useReveal(matched, 40, query)

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <header className="mb-6">
        <h1 className="font-semibold text-2xl tracking-tight">History</h1>
      </header>

      <Input
        aria-label="Filter history"
        className="mb-2 h-11"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="essay in:cs210 took:>60 doneafter:-7d"
        value={query}
      />

      {/*
        The command palette lists these as selectable rows. There is no list to
        put them in here, so they are chips that append themselves to whatever
        is already typed.
      */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {FILTER_HINTS.map((hint) => (
          <button
            className="rounded-md bg-muted px-2 py-1 font-mono text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
            key={hint.token}
            onClick={() =>
              setQuery((current) =>
                current.trim()
                  ? `${current.trim()} ${hint.token} `
                  : `${hint.token} `,
              )
            }
            title={hint.describes}
            type="button"
          >
            {hint.token}
          </button>
        ))}
      </div>

      {matched.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon />
            </EmptyMedia>
            <EmptyTitle>Nothing here</EmptyTitle>
            <EmptyDescription>
              Finished work collects here once you start ticking things off.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup>
          {reveal.shown.map((item) => (
            <Item
              className="gap-3 rounded-none border-b-border px-0 py-3 last:border-b-transparent"
              key={item.id}
              size="sm"
            >
              <ItemContent className="gap-0.5">
                <ItemTitle className="w-full truncate">{item.name}</ItemTitle>
                <ItemDescription className="flex flex-wrap items-center gap-x-2">
                  {item.course && (
                    <span className="flex items-center gap-1">
                      <CourseMark
                        className="size-3.5"
                        color={item.course.color}
                        dotClassName="size-1.5 bg-muted-foreground"
                        icon={item.course.icon}
                      />
                      {item.course.code ?? item.course.name}
                    </span>
                  )}
                  <span className="capitalize">{item.type}</span>
                  {item.completedAt ? (
                    <span className="text-primary">
                      done <DateTimeText value={item.completedAt} />
                    </span>
                  ) : item.dueAt ? (
                    <span>
                      due{' '}
                      <DateTimeText allDay={item.allDay} value={item.dueAt} />
                    </span>
                  ) : null}
                  {item.estimatedMinutes && (
                    <span>est {minutesLabel(item.estimatedMinutes)}</span>
                  )}
                  {item.actualMinutes && (
                    <span className="text-foreground">
                      took {minutesLabel(item.actualMinutes)}
                    </span>
                  )}
                </ItemDescription>
              </ItemContent>

              {item.status === 'done' && (
                <ItemActions>
                  <Pill>Done</Pill>
                </ItemActions>
              )}
            </Item>
          ))}
        </ItemGroup>
      )}

      <RevealMore noun="older" reveal={reveal} />

      {activity.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Recent activity
          </h2>
          <ul className="space-y-1">
            {activity.map((event) => (
              <li
                className="flex items-baseline justify-between gap-3 text-sm"
                key={event.id}
              >
                <span className="min-w-0 truncate">
                  {EVENT_WORDS[event.kind] ?? event.kind}
                  {' · '}
                  <span className="text-muted-foreground">{event.name}</span>
                  {event.detail ? `, ${event.detail}` : ''}
                </span>
                <DateTimeText
                  className="shrink-0 text-muted-foreground text-xs tabular-nums"
                  value={event.at}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
