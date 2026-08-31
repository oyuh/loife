import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Checkbox } from '#/components/ui/checkbox'
import { itemsQuery } from '#/lib/queries'
import { groupByUrgency, overdueCount } from '#/lib/urgency'
import { cn } from '#/lib/utils'
import { type ItemRow, setItemStatus } from '#/server/items'

export const Route = createFileRoute('/_app/')({
  component: Today,
  loader: ({ context }) => context.queryClient.ensureQueryData(itemsQuery),
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
  const { data: items } = useSuspenseQuery(itemsQuery)
  const queryClient = useQueryClient()

  const toggle = useMutation({
    mutationFn: (vars: { id: number; status: ItemRow['status'] }) =>
      setItemStatus({ data: vars }),

    // Paint the change before the round trip, so a tap never waits on the
    // network. The snapshot is what makes putting it back possible.
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: itemsQuery.queryKey })
      const previous = queryClient.getQueryData<ItemRow[]>(itemsQuery.queryKey)
      queryClient.setQueryData<ItemRow[]>(itemsQuery.queryKey, (old) =>
        old?.map((item) =>
          item.id === vars.id ? { ...item, status: vars.status } : item,
        ),
      )
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(itemsQuery.queryKey, context.previous)
      }
      toast.error('Could not save that, so it is back how it was.')
    },

    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: itemsQuery.queryKey }),
  })

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
                  <ItemLine
                    key={item.id}
                    item={item}
                    onToggle={(done) =>
                      toggle.mutate({
                        id: item.id,
                        status: done ? 'done' : 'todo',
                      })
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemLine({
  item,
  onToggle,
}: {
  item: ItemRow
  onToggle: (done: boolean) => void
}) {
  const done = item.status === 'done'

  return (
    <li className="flex min-h-14 items-center gap-3 py-2">
      <Checkbox
        checked={done}
        onCheckedChange={(checked) => onToggle(checked === true)}
        aria-label={item.name}
        className="size-5 shrink-0"
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
      <p className="font-medium">Nothing due</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Use Add in the nav, or press ⌘K, to put something here.
      </p>
    </div>
  )
}
