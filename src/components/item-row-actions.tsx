import { CalendarClock, Check, MoreVertical, Trash2, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '#/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { MOVE_TARGETS, type MoveTarget } from '#/lib/move-targets'

export interface RowActions {
  done: boolean
  onToggle: () => void
  onMove: (target: MoveTarget) => void
  onDelete: () => void
}

/** Right click anywhere on the row. */
export function RowContextMenu({
  actions,
  children,
}: {
  actions: RowActions
  children: ReactNode
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={actions.onToggle}>
          {actions.done ? <Undo2 /> : <Check />}
          {actions.done ? 'Mark not done' : 'Mark done'}
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <CalendarClock />
            Move to
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {MOVE_TARGETS.map((target) => (
              <ContextMenuItem
                key={target.label}
                onSelect={() => actions.onMove(target)}
              >
                {target.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />
        <ContextMenuItem onSelect={actions.onDelete} variant="destructive">
          <Trash2 />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** The three dot button, for anyone who does not think to right click. */
export function RowMenuButton({
  actions,
  label,
}: {
  actions: RowActions
  label: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Actions for ${label}`}
          className="min-h-10 shrink-0"
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={actions.onToggle}>
          {actions.done ? <Undo2 /> : <Check />}
          {actions.done ? 'Mark not done' : 'Mark done'}
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CalendarClock />
            Move to
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {MOVE_TARGETS.map((target) => (
              <DropdownMenuItem
                key={target.label}
                onSelect={() => actions.onMove(target)}
              >
                {target.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={actions.onDelete} variant="destructive">
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
