import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarCheck, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AddItemDialog } from '#/components/add-item-dialog'
import { InlineLog } from '#/components/inline-log'
import { Pill, PillIndicator } from '#/components/kibo-ui/pill'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
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
import { itemsQuery } from '#/lib/queries'
import {
  BUCKET_COLORS,
  DEFAULT_PRIORITY,
  groupByUrgency,
  overdueCount,
  PRIORITY_LABELS,
} from '#/lib/urgency'
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

/** 1 and 2 are urgent, 4 and 5 are deferred, 3 says nothing worth a pill. */
const PRIORITY_INDICATOR: Record<number, 'error' | 'warning' | 'success'> = {
  1: 'error',
  2: 'warning',
  4: 'success',
  5: 'success',
}

function Today() {
  const { data: items } = useSuspenseQuery(itemsQuery)
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<ItemRow | null>(null)
  // Collapsed rather than expanded, so the set stays empty in the common case
  // where everything is open.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleSection = (bucket: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(bucket)) next.delete(bucket)
      else next.add(bucket)
      return next
    })

  /**
   * Paints one row before the round trip and hands back the snapshot that
   * makes putting it back possible. Both mutations edit a single row in the
   * same list, so they share this.
   */
  const patchRow = async (id: number, patch: Partial<ItemRow>) => {
    await queryClient.cancelQueries({ queryKey: itemsQuery.queryKey })
    const previous = queryClient.getQueryData<ItemRow[]>(itemsQuery.queryKey)
    queryClient.setQueryData<ItemRow[]>(itemsQuery.queryKey, (old) =>
      old?.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
    return { previous }
  }

  const rollback =
    (message: string) =>
    (
      _error: unknown,
      _vars: unknown,
      context: { previous?: ItemRow[] } | undefined,
    ) => {
      if (context?.previous) {
        queryClient.setQueryData(itemsQuery.queryKey, context.previous)
      }
      toast.error(message)
    }

  const settle = () =>
    queryClient.invalidateQueries({ queryKey: itemsQuery.queryKey })

  const toggle = useMutation({
    mutationFn: (vars: { id: number; status: ItemRow['status'] }) =>
      setItemStatus({ data: vars }),
    onMutate: (vars) => patchRow(vars.id, { status: vars.status }),
    onError: rollback('Could not save that, so it is back how it was.'),
    onSettled: settle,
  })

  const now = new Date()
  const groups = groupByUrgency(items, now)
  const late = overdueCount(items, now)

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <header className="mb-6">
        <h1 className="font-semibold text-2xl tracking-tight">Today</h1>
        <p className="mt-1 flex items-center gap-2 text-muted-foreground text-sm">
          {dayFormat.format(now)}
          {late > 0 && <span className="text-destructive">{late} overdue</span>}
        </p>
      </header>

      {groups.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarCheck />
            </EmptyMedia>
            <EmptyTitle>Nothing due</EmptyTitle>
            <EmptyDescription>
              Use Add in the nav, or press ⌘K, to put something here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <Collapsible
              key={group.bucket}
              onOpenChange={() => toggleSection(group.bucket)}
              open={!collapsed.has(group.bucket)}
            >
              <CollapsibleTrigger className="group mb-1 flex min-h-11 w-full items-center gap-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                <ChevronRight
                  aria-hidden="true"
                  className="size-3 transition-transform group-data-[state=open]:rotate-90"
                />
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: BUCKET_COLORS[group.bucket] }}
                />
                {group.label}
                <span className="ml-auto tabular-nums">
                  {group.items.length}
                </span>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <ItemGroup>
                  {group.items.map((item) => {
                    const done = item.status === 'done'

                    return (
                      <Item
                        className="gap-3 rounded-none border-b-border px-0 py-3 last:border-b-transparent"
                        key={item.id}
                        size="sm"
                      >
                        {/* Padding rather than a bigger box, so the tap target
                          clears 44px while the control stays small. */}
                        <span className="-m-2 shrink-0 p-2">
                          <Checkbox
                            aria-label={`Mark ${item.name} done`}
                            checked={done}
                            className="size-5"
                            onCheckedChange={(checked) =>
                              toggle.mutate({
                                id: item.id,
                                status: checked === true ? 'done' : 'todo',
                              })
                            }
                          />
                        </span>

                        {/* The whole row toggles, so a 20px box is never the only
                          target. */}
                        <button
                          aria-label={`Open ${item.name}`}
                          className="flex min-w-0 flex-1 select-none text-left"
                          onClick={() => setEditing(item)}
                          type="button"
                        >
                          <ItemContent className="gap-0.5">
                            <ItemTitle
                              className={cn(
                                'w-full truncate',
                                done && 'text-muted-foreground line-through',
                              )}
                            >
                              {item.name}
                            </ItemTitle>
                            <ItemDescription className="flex flex-wrap items-center gap-x-2">
                              {item.course && (
                                <span>
                                  {item.course.code ?? item.course.name}
                                </span>
                              )}
                              <span className="capitalize">{item.type}</span>
                              {item.dueAt && !item.allDay && (
                                <span>{timeFormat.format(item.dueAt)}</span>
                              )}
                              {item.location && <span>{item.location}</span>}
                            </ItemDescription>
                          </ItemContent>
                        </button>

                        {/* P3 is the default and says nothing, so only the
                          deviations get a pill. */}
                        {!done && item.priority !== DEFAULT_PRIORITY && (
                          <ItemActions>
                            <Pill title={PRIORITY_LABELS[item.priority]}>
                              <PillIndicator
                                variant={PRIORITY_INDICATOR[item.priority]}
                              />
                              P{item.priority}
                            </Pill>
                          </ItemActions>
                        )}
                      </Item>
                    )
                  })}
                </ItemGroup>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      <InlineLog />

      <AddItemDialog
        item={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        open={editing !== null}
      />
    </div>
  )
}
