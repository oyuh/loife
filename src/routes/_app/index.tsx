import { createFileRoute } from '@tanstack/react-router'
import { Checkbox } from '#/components/ui/checkbox'
import { groupByUrgency, overdueCount } from '#/lib/urgency'
import { cn } from '#/lib/utils'
import { type ItemRow, listItems } from '#/server/items'

export const Route = createFileRoute('/_app/')({
  component: Today,
  loader: () => listItems(),
})

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

function Today() {
  const items = Route.useLoaderData()
  const now = new Date()
  const groups = groupByUrgency(items, now)
  const late = overdueCount(items, now)

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {dayFormat.format(now)}
          {late > 0 && (
            <>
              {' · '}
              <span className="text-destructive">{late} overdue</span>
            </>
          )}
        </p>
      </header>

      {groups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.bucket}>
              <h2
                className={cn(
                  'mb-2 text-xs font-medium uppercase tracking-wide',
                  group.bucket === 'overdue'
                    ? 'text-destructive'
                    : 'text-muted-foreground',
                )}
              >
                {group.label}
              </h2>
              <ul className="divide-y divide-border border-y border-border">
                {group.items.map((item) => (
                  <ItemLine key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemLine({ item }: { item: ItemRow }) {
  const done = item.status === 'done'

  return (
    <li className="flex min-h-14 items-center gap-3 py-2">
      {/* Toggling arrives in phase 4, so this reads state without setting it. */}
      <Checkbox
        checked={done}
        disabled
        aria-label={item.name}
        className="shrink-0"
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate',
            done && 'text-muted-foreground line-through',
          )}
        >
          {item.name}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {item.course && <span>{item.course.code ?? item.course.name}</span>}
          <span className="capitalize">{item.type}</span>
          {item.dueAt && !item.allDay && (
            <span>{timeFormat.format(item.dueAt)}</span>
          )}
          {item.location && <span>{item.location}</span>}
        </p>
      </div>

      {item.priority === 'high' && !done && (
        <span className="shrink-0 text-xs font-medium text-primary">High</span>
      )}
    </li>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border px-5 py-12 text-center">
      <p className="font-medium">Nothing here yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Adding courses and assignments arrives in phase 4.
      </p>
    </div>
  )
}
