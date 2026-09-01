import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SectionId } from '#/lib/today-layout'
import { cn } from '#/lib/utils'

/**
 * The Today page's sections, rearrangeable while `arranging` is on.
 *
 * Off, this renders its children and nothing else — no listeners, no handles,
 * no wrapper behaviour. The page reads the same as it did before the feature
 * existed, which matters because arranging is the rare mode and reading is the
 * common one.
 */
export function Arrangeable({
  arranging,
  children,
  onMove,
  order,
}: {
  arranging: boolean
  children: ReactNode
  onMove: (from: SectionId, to: SectionId) => void
  order: readonly SectionId[]
}) {
  const sensors = useSensors(
    /*
     * The handle is the only thing that starts a drag, but a phone still needs
     * the few pixels of slop: without it a tap that moves slightly is read as
     * a drag and the section jumps under the finger.
     */
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  if (!arranging) return children

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={({ active, over }: DragEndEvent) => {
        if (over && active.id !== over.id) {
          onMove(active.id as SectionId, over.id as SectionId)
        }
      }}
      sensors={sensors}
    >
      <SortableContext
        items={[...order]}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  )
}

/**
 * One movable section.
 *
 * While arranging, the section is indented to make room for a handle sitting
 * in the gutter, so the content itself does not reflow and nothing inside it
 * has to know this mode exists.
 */
export function ArrangeableSection({
  arranging,
  children,
  id,
  label,
}: {
  arranging: boolean
  children: ReactNode
  id: SectionId
  label: string
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: !arranging })

  if (!arranging) return children

  return (
    <div
      className={cn('relative pl-8', isDragging && 'z-10 opacity-80')}
      ref={setNodeRef}
      /*
       * dnd-kit ships a helper that builds this string, but it lives in a
       * package we would have to depend on for one line. The drag is locked to
       * the vertical axis, so x is always 0 and there is no scaling to carry.
       */
      style={{
        transform: transform
          ? `translate3d(0, ${transform.y}px, 0)`
          : undefined,
        transition,
      }}
    >
      <button
        aria-label={`Move ${label}`}
        className="absolute top-0 left-0 flex size-11 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      {/*
        Nothing inside a section should be usable while it is being moved: the
        checkboxes, swipe rows and collapsible headers all want the same
        pointer the drag does.
      */}
      <div className="pointer-events-none">{children}</div>
    </div>
  )
}
