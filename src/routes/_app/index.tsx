import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarCheck, ChevronRight, Paperclip } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AddItemDialog } from '#/components/add-item-dialog'
import { AttachmentsList } from '#/components/attachments-list'
import { InlineLog } from '#/components/inline-log'
import { RowContextMenu, RowMenuButton } from '#/components/item-row-actions'
import { Pill, PillIndicator } from '#/components/kibo-ui/pill'
import { SwipeRow } from '#/components/swipe-row'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
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
import { type MoveTarget, moveTargetDate } from '#/lib/move-targets'
import { itemsQuery } from '#/lib/queries'
import {
  BUCKET_COLORS,
  DEFAULT_PRIORITY,
  groupByUrgency,
  overdueCount,
  PRIORITY_LABELS,
} from '#/lib/urgency'
import { cn } from '#/lib/utils'
import {
  deleteItem,
  type ItemRow,
  setItemDue,
  setItemStatus,
} from '#/server/items'

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
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(['week', 'later', 'someday']),
  )
  const [confirming, setConfirming] = useState<ItemRow | null>(null)
  const [showingFiles, setShowingFiles] = useState<ItemRow | null>(null)

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

  const move = useMutation({
    mutationFn: (vars: { id: number; dueAt: Date | null }) =>
      setItemDue({ data: { ...vars, allDay: true } }),
    onMutate: (vars) => patchRow(vars.id, { dueAt: vars.dueAt, allDay: true }),
    onError: rollback('Could not move that, so it is back how it was.'),
    onSettled: settle,
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteItem({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsQuery.queryKey })
      setConfirming(null)
      toast.success('Deleted')
    },
    onError: () => toast.error('Could not delete that'),
  })

  const actionsFor = (item: ItemRow) => ({
    done: item.status === 'done',
    onEdit: () => setEditing(item),
    onToggle: () =>
      toggle.mutate({
        id: item.id,
        status: item.status === 'done' ? 'todo' : 'done',
      }),
    onMove: (target: MoveTarget) => {
      move.mutate({ id: item.id, dueAt: moveTargetDate(target) })
      toast.success(`${item.name} moved to ${target.label.toLowerCase()}`)
    },
    onDelete: () => setConfirming(item),
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
                    const actions = actionsFor(item)

                    return (
                      <SwipeRow
                        actions={
                          <>
                            <Button
                              className="h-full flex-1 rounded-none"
                              onClick={actions.onToggle}
                              variant="secondary"
                            >
                              {actions.done ? 'Undo' : 'Done'}
                            </Button>
                            <Button
                              className="h-full flex-1 rounded-none"
                              onClick={actions.onEdit}
                              variant="secondary"
                            >
                              Edit
                            </Button>
                            <Button
                              className="h-full flex-1 rounded-none"
                              onClick={actions.onDelete}
                              variant="destructive"
                            >
                              Delete
                            </Button>
                          </>
                        }
                        key={item.id}
                      >
                        <RowContextMenu actions={actions}>
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
                                    done &&
                                      'text-muted-foreground line-through',
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
                                  <span className="capitalize">
                                    {item.type}
                                  </span>
                                  {item.dueAt && !item.allDay && (
                                    <span>{timeFormat.format(item.dueAt)}</span>
                                  )}
                                  {item.location && (
                                    <span>{item.location}</span>
                                  )}
                                </ItemDescription>
                              </ItemContent>
                            </button>

                            {item.attachmentCount > 0 && (
                              <Button
                                aria-label={`Files on ${item.name}`}
                                className="min-h-10 shrink-0 gap-1 px-2 text-muted-foreground text-xs"
                                onClick={() => setShowingFiles(item)}
                                size="sm"
                                type="button"
                                variant="ghost"
                              >
                                <Paperclip />
                                {item.attachmentCount}
                              </Button>
                            )}

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
                            <RowMenuButton
                              actions={actions}
                              label={item.name}
                            />
                          </Item>
                        </RowContextMenu>
                      </SwipeRow>
                    )
                  })}
                </ItemGroup>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-10 -mx-5 mt-6 border-border border-t bg-background px-5 pt-3 pb-1 md:bottom-0 md:pb-3">
        <InlineLog />
      </div>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
        open={confirming !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.name} goes for good, along with any files on it and
              its calendar event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-background hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (confirming) remove.mutate(confirming.id)
              }}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setShowingFiles(null)
        }}
        open={showingFiles !== null}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">
              {showingFiles?.name}
            </DialogTitle>
          </DialogHeader>
          {showingFiles && (
            <AttachmentsList owner={{ itemId: showingFiles.id }} />
          )}
        </DialogContent>
      </Dialog>

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
