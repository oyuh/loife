import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  CalendarCheck,
  Check,
  ChevronRight,
  Paperclip,
  Pencil,
  Trash2,
  Undo2,
} from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AddItemDialog } from '#/components/add-item-dialog'
import { Arrangeable, ArrangeableSection } from '#/components/arrangeable'
import { ClockText } from '#/components/date-time'
import { DayPlan } from '#/components/day-plan'
import { InlineLog } from '#/components/inline-log'
import { ItemDetail } from '#/components/item-detail'
import { RowContextMenu, RowMenuButton } from '#/components/item-row-actions'
import { Pill, PillIndicator } from '#/components/kibo-ui/pill'
import { StudyTimer } from '#/components/study-timer'
import { SwipeAction, SwipeRow } from '#/components/swipe-row'
import { TodayCalendar } from '#/components/today-calendar'
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
import { Switch } from '#/components/ui/switch'
import { formatDayLong } from '#/lib/datetime'
import { type MoveTarget, moveTargetDate } from '#/lib/move-targets'
import { coursesQuery, itemsQuery } from '#/lib/queries'
import {
  readOrder,
  reorder,
  SECTION_ORDER,
  type SectionId,
  writeOrder,
} from '#/lib/today-layout'
import {
  BUCKET_COLORS,
  DEFAULT_PRIORITY,
  groupByUrgency,
  overdueCount,
  PRIORITY_LABELS,
} from '#/lib/urgency'
import { cn } from '#/lib/utils'
import { calendarStatus } from '#/server/calendar'
import {
  deleteItem,
  type ItemRow,
  setItemDue,
  setItemStatus,
  updateItemPriority,
} from '#/server/items'

export const Route = createFileRoute('/_app/')({
  component: Today,
  // Courses too. Both the calendar and the day plan below need them to draw
  // classes, and fetched here they ride the server render instead of costing
  // a round trip once the page has already painted.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(itemsQuery),
      context.queryClient.ensureQueryData(coursesQuery),
    ]),
})

/** 1 and 2 are urgent, 4 and 5 are deferred, 3 says nothing worth a pill. */
const PRIORITY_INDICATOR: Record<number, 'error' | 'warning' | 'success'> = {
  1: 'error',
  2: 'warning',
  4: 'success',
  5: 'success',
}

/** One movable block on the Today page. */
type Section = { id: SectionId; label: string; node: ReactNode }

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
  const [viewing, setViewing] = useState<ItemRow | null>(null)
  const [arranging, setArranging] = useState(false)
  const [order, setOrder] = useState<SectionId[]>(() => [...SECTION_ORDER])

  /*
   * The saved order lives in localStorage, which does not exist while this
   * page is rendering on the server. So the markup ships in the default order
   * and a custom one lands on the first client render instead — a reordered
   * page moves once, just after it paints.
   */
  useEffect(() => setOrder(readOrder()), [])

  const moveSection = (from: SectionId, to: SectionId) => {
    // Reordering the whole list rather than the visible part of it, so a
    // section that is empty today keeps its place for the day it is not.
    const next = reorder(order, from, to)
    setOrder(next)
    writeOrder(next)
  }

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

  const setPriority = useMutation({
    mutationFn: (vars: { id: number; priority: number }) =>
      updateItemPriority({ data: vars }),
    onMutate: (vars) => patchRow(vars.id, { priority: vars.priority }),
    onError: rollback('Could not change that, so it is back how it was.'),
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

  const { data: prefs } = useQuery({
    queryKey: ['calendar-status'],
    queryFn: () => calendarStatus(),
  })

  const now = new Date()
  const groups = groupByUrgency(items, now, prefs?.hideCompletedAfterMinutes)
  const late = overdueCount(items, now)

  const buckets = new Map(
    groups.map((group) => [
      group.bucket,
      {
        label: group.label,
        node: (
          <Collapsible
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
              <span className="ml-auto tabular-nums">{group.items.length}</span>
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
                          <SwipeAction
                            label={actions.done ? 'Reopen' : 'Mark done'}
                            onClick={actions.onToggle}
                          >
                            {actions.done ? <Undo2 /> : <Check />}
                          </SwipeAction>
                          <SwipeAction label="Edit" onClick={actions.onEdit}>
                            <Pencil />
                          </SwipeAction>
                          <SwipeAction
                            destructive
                            label="Delete"
                            onClick={actions.onDelete}
                          >
                            <Trash2 />
                          </SwipeAction>
                        </>
                      }
                      count={3}
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
                            onClick={() => setViewing(item)}
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
                                  <ClockText value={item.dueAt} />
                                )}
                                {item.location && <span>{item.location}</span>}
                              </ItemDescription>
                            </ItemContent>
                          </button>

                          {item.attachmentCount > 0 && (
                            <Button
                              aria-label={`Files on ${item.name}`}
                              className="min-h-10 shrink-0 gap-1 px-2 text-muted-foreground text-xs"
                              onClick={() => setViewing(item)}
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
                          <RowMenuButton actions={actions} label={item.name} />
                        </Item>
                      </RowContextMenu>
                    </SwipeRow>
                  )
                })}
              </ItemGroup>
            </CollapsibleContent>
          </Collapsible>
        ),
      },
    ]),
  )

  /** The arranged order, minus the buckets that have nothing in them today. */
  const sections = order.flatMap((id): Section[] => {
    if (id === 'calendar') {
      return [
        { id, label: 'the calendar', node: <TodayCalendar items={items} /> },
      ]
    }
    if (id === 'timer') {
      return [{ id, label: 'the study timer', node: <StudyTimer /> }]
    }
    if (id === 'plan') {
      return [{ id, label: 'plan my day', node: <DayPlan items={items} /> }]
    }
    const bucket = buckets.get(id)
    return bucket ? [{ id, ...bucket }] : []
  })

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pt-8 pb-28">
      <header className="mb-6 flex items-start justify-between gap-4">
        {/* The date is the title. A "Today" above it named the tab you
            already tapped and cost a phone a whole line of the fold. */}
        <h1 className="flex flex-wrap items-baseline gap-x-2 font-semibold text-lg tracking-tight">
          {formatDayLong(now)}
          {late > 0 && (
            <span className="font-normal text-destructive text-sm">
              {late} overdue
            </span>
          )}
        </h1>

        {/*
          Arranging is a mode you turn on, move something, and turn off again,
          so the switch lives here rather than in settings — you cannot see
          what you are rearranging from another page.
        */}
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <label
            className="cursor-pointer text-muted-foreground text-xs uppercase tracking-wide"
            htmlFor="arrange"
          >
            Arrange
          </label>
          <Switch
            checked={arranging}
            id="arrange"
            onCheckedChange={setArranging}
          />
        </div>
      </header>

      {/*
        Every section is the same kind of thing to this list: an id, a name for
        the drag handle's label, and something to render. Buckets with nothing
        in them are simply absent, which is why the order is stored separately
        rather than being read back off what is on screen.
      */}
      <Arrangeable
        arranging={arranging}
        onMove={moveSection}
        order={sections.map((section) => section.id)}
      >
        <div className="space-y-8">
          {sections.map((section) => (
            <ArrangeableSection
              arranging={arranging}
              id={section.id}
              key={section.id}
              label={section.label}
            >
              {section.node}
            </ArrangeableSection>
          ))}
        </div>
      </Arrangeable>

      {groups.length === 0 && (
        <Empty className="mt-8 border border-dashed">
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
      )}

      <InlineLog />

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
              className="min-h-11"
              variant="destructive"
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

      <ItemDetail
        item={viewing}
        onDelete={() => {
          setConfirming(viewing)
          setViewing(null)
        }}
        onEdit={() => {
          setEditing(viewing)
          setViewing(null)
        }}
        onMove={(target) => {
          if (!viewing) return
          move.mutate({ id: viewing.id, dueAt: moveTargetDate(target) })
          toast.success(`Moved to ${target.label.toLowerCase()}`)
          setViewing(null)
        }}
        onOpenChange={(open) => {
          if (!open) setViewing(null)
        }}
        onPriority={(priority) => {
          if (viewing) setPriority.mutate({ id: viewing.id, priority })
        }}
        onToggle={() => {
          if (!viewing) return
          toggle.mutate({
            id: viewing.id,
            status: viewing.status === 'done' ? 'todo' : 'done',
          })
          setViewing(null)
        }}
      />

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
