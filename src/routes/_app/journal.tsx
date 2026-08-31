import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { NotebookPen } from 'lucide-react'
import { useState } from 'react'
import { JournalDialog } from '#/components/journal-dialog'
import { Pill } from '#/components/kibo-ui/pill'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '#/components/ui/item'
import { journalQuery } from '#/lib/queries'
import type { LogEntryRow } from '#/server/journal'

export const Route = createFileRoute('/_app/journal')({
  component: Journal,
  loader: ({ context }) => context.queryClient.ensureQueryData(journalQuery),
})

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

/** Groups entries under a month heading, so a long journal stays scannable. */
function monthOf(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

function Journal() {
  const { data: entries } = useSuspenseQuery(journalQuery)
  const [openId, setOpenId] = useState<number | null>(null)

  const months = new Map<string, LogEntryRow[]>()
  for (const entry of entries) {
    const key = monthOf(entry.date)
    const existing = months.get(key)
    if (existing) existing.push(entry)
    else months.set(key, [entry])
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <header className="mb-6">
        <h1 className="font-semibold text-2xl tracking-tight">Journal</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Written from the Today screen. Tap a day to read or edit it.
        </p>
      </header>

      {entries.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <NotebookPen />
            </EmptyMedia>
            <EmptyTitle>Nothing logged yet</EmptyTitle>
            <EmptyDescription>
              Use the box under the Today list. Type what happened, press enter,
              and it lands here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-8">
          {[...months].map(([month, monthEntries]) => (
            <section key={month}>
              <h2 className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {month}
              </h2>

              <ItemGroup>
                {monthEntries.map((entry) => (
                  <Item
                    className="gap-3 rounded-none border-b-border px-0 py-3 last:border-b-transparent"
                    key={entry.id}
                    size="sm"
                  >
                    <button
                      className="flex min-w-0 flex-1 text-left"
                      onClick={() => setOpenId(entry.id)}
                      type="button"
                    >
                      <ItemContent className="gap-0.5">
                        <ItemTitle className="w-full truncate">
                          {entry.title ??
                            dayFormat.format(
                              new Date(`${entry.date}T00:00:00`),
                            )}
                        </ItemTitle>
                        <ItemDescription className="line-clamp-2 whitespace-pre-wrap">
                          {entry.preview
                            ? `${entry.preview}${entry.truncated ? '…' : ''}`
                            : 'Empty'}
                        </ItemDescription>
                      </ItemContent>
                    </button>

                    {entry.kind === 'event' && (
                      <ItemActions>
                        <Pill>Event</Pill>
                      </ItemActions>
                    )}
                  </Item>
                ))}
              </ItemGroup>
            </section>
          ))}
        </div>
      )}

      <JournalDialog
        entryId={openId}
        onOpenChange={(open) => {
          if (!open) setOpenId(null)
        }}
      />
    </div>
  )
}
