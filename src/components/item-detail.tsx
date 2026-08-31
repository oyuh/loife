import { CalendarClock, Check, Pencil, Trash2, Undo2 } from 'lucide-react'
import { AttachmentsList } from '#/components/attachments-list'
import { Pill, PillIndicator } from '#/components/kibo-ui/pill'
import { Markdown } from '#/components/markdown'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '#/components/ui/drawer'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { MOVE_TARGETS, type MoveTarget } from '#/lib/move-targets'
import { PRIORITY_LABELS, PRIORITY_LEVELS } from '#/lib/urgency'
import { useMediaQuery } from '#/lib/use-media-query'
import type { ItemRow } from '#/server/items'

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

const PRIORITY_INDICATOR: Record<number, 'error' | 'warning' | 'success'> = {
  1: 'error',
  2: 'warning',
  4: 'success',
  5: 'success',
}

/**
 * Read an item without editing it: the notes rendered, the files viewable, and
 * the things worth changing in a hurry, which are done, priority, and when.
 *
 * Everything else lives behind Edit, so opening a row does not put it into a
 * form when all you wanted was to read the notes.
 */
export function ItemDetail({
  item,
  onOpenChange,
  onEdit,
  onToggle,
  onPriority,
  onMove,
  onDelete,
}: {
  item: ItemRow | null
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onToggle: () => void
  onPriority: (priority: number) => void
  onMove: (target: MoveTarget) => void
  onDelete: () => void
}) {
  const isDesktop = useMediaQuery('(min-width: 640px)')
  if (!item) return null

  const done = item.status === 'done'

  const subtitle = [
    item.course?.code ?? item.course?.name,
    item.type,
    item.dueAt
      ? item.allDay
        ? dateFormat.format(item.dueAt)
        : `${dateFormat.format(item.dueAt)} at ${timeFormat.format(item.dueAt)}`
      : 'No due date',
    item.location,
  ]
    .filter(Boolean)
    .join(' · ')

  const body = (
    <div className="space-y-5 pb-2">
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11 flex-1"
          onClick={onToggle}
          variant={done ? 'secondary' : 'default'}
        >
          {done ? <Undo2 /> : <Check />}
          {done ? 'Not done' : 'Mark done'}
        </Button>
        <Button className="min-h-11" onClick={onEdit} variant="secondary">
          <Pencil />
          Edit
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <span className="font-medium text-sm">Priority</span>
          <Select
            onValueChange={(value) => onPriority(Number(value))}
            value={String(item.priority)}
          >
            <SelectTrigger aria-label="Priority" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_LEVELS.map((level) => (
                <SelectItem key={level} value={String(level)}>
                  P{level} · {PRIORITY_LABELS[level]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <span className="font-medium text-sm">Move to</span>
          <Select
            onValueChange={(label) => {
              const target = MOVE_TARGETS.find((t) => t.label === label)
              if (target) onMove(target)
            }}
            value=""
          >
            <SelectTrigger aria-label="Move to" className="h-11 w-full">
              <CalendarClock className="size-4 shrink-0" />
              <SelectValue placeholder="Pick a day" />
            </SelectTrigger>
            <SelectContent>
              {MOVE_TARGETS.map((target) => (
                <SelectItem key={target.label} value={target.label}>
                  {target.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {item.notes ? (
        <section className="space-y-1.5">
          <p className="font-medium text-sm">Notes</p>
          <Markdown>{item.notes}</Markdown>
        </section>
      ) : null}

      <section className="space-y-1.5">
        <p className="font-medium text-sm">Files</p>
        <AttachmentsList owner={{ itemId: item.id }} />
        {item.attachmentCount === 0 && (
          <p className="text-muted-foreground text-sm">
            Nothing attached. Add files from Edit.
          </p>
        )}
      </section>

      <Button
        className="min-h-11 w-full text-destructive hover:text-destructive"
        onClick={onDelete}
        variant="ghost"
      >
        <Trash2 />
        Delete
      </Button>
    </div>
  )

  const heading = (
    <>
      <span className="flex items-center gap-2">
        <span className="truncate">{item.name}</span>
        {item.priority !== 3 && (
          <Pill className="shrink-0">
            <PillIndicator variant={PRIORITY_INDICATOR[item.priority]} />P
            {item.priority}
          </Pill>
        )}
      </span>
    </>
  )

  if (!isDesktop) {
    return (
      <Drawer onOpenChange={onOpenChange} open>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="pr-8">{heading}</DrawerTitle>
            <DrawerDescription>{subtitle}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-4">{body}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-8">{heading}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}
