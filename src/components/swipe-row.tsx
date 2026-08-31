import { type ReactNode, useRef, useState } from 'react'
import { cn } from '#/lib/utils'

/**
 * Swipe a row left to reveal its actions.
 *
 * Hand rolled on pointer events rather than a gesture library, because the
 * hard part is not the maths but deciding when a drag is a swipe and when it
 * is the page scrolling. The rule here: the first few pixels decide, and once
 * a direction wins it keeps the gesture.
 *
 * Actions are icons rather than words. Three labelled buttons needed 176px,
 * which on a 375px screen pushed the row's own text off the left edge and
 * still clipped the last button against the right.
 */

const ACTION_WIDTH = 52
const ACTION_GAP = 6
const EDGE_PADDING = 8

/** Movement before a direction is chosen. */
const DIRECTION_THRESHOLD = 8

export function SwipeRow({
  children,
  actions,
  count,
  disabled,
}: {
  children: ReactNode
  actions: ReactNode
  /** How many buttons sit behind the row, which sets how far it slides. */
  count: number
  disabled?: boolean
}) {
  const revealed =
    count * ACTION_WIDTH + (count - 1) * ACTION_GAP + EDGE_PADDING * 2

  const [offset, setOffset] = useState(0)
  const [sliding, setSliding] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'undecided' | 'horizontal' | 'vertical'>('undecided')

  const onPointerDown = (event: React.PointerEvent) => {
    // Mouse users get the context menu and the three dot button instead, so
    // this only arms for touch and pen.
    if (disabled || event.pointerType === 'mouse') return
    start.current = { x: event.clientX, y: event.clientY }
    axis.current = 'undecided'
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!start.current) return

    const dx = event.clientX - start.current.x
    const dy = event.clientY - start.current.y

    if (axis.current === 'undecided') {
      if (
        Math.abs(dx) < DIRECTION_THRESHOLD &&
        Math.abs(dy) < DIRECTION_THRESHOLD
      ) {
        return
      }
      // Whichever axis moved further wins, and vertical hands the gesture back
      // to the page so scrolling still feels normal.
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
      if (axis.current === 'horizontal') setSliding(true)
    }

    if (axis.current !== 'horizontal') return

    // Left only, and never further than the actions behind it.
    setOffset(Math.min(0, Math.max(-revealed, dx)))
  }

  const onPointerUp = () => {
    if (axis.current === 'horizontal') {
      setOffset(offset < -revealed / 2 ? -revealed : 0)
    }
    start.current = null
    axis.current = 'undecided'
    setSliding(false)
  }

  const open = offset !== 0

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden={!open}
        className="absolute inset-y-1 right-0 flex items-stretch"
        style={{ gap: ACTION_GAP, paddingInline: EDGE_PADDING }}
      >
        {actions}
      </div>

      <div
        className={cn(
          'relative bg-background',
          !sliding && 'transition-transform duration-200',
        )}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>

      {/* Tapping anywhere else closes an open row, the way mail apps behave. */}
      {open && (
        <button
          aria-label="Close actions"
          className="absolute inset-0 z-10"
          onClick={() => setOffset(0)}
          type="button"
        />
      )}
    </div>
  )
}

/** One icon button behind a row, sized so three fit on a narrow phone. */
export function SwipeAction({
  label,
  onClick,
  children,
  destructive,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  destructive?: boolean
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md',
        '[&_svg]:size-5',
        destructive
          ? 'bg-destructive text-background'
          : 'bg-secondary text-secondary-foreground',
      )}
      onClick={onClick}
      style={{ width: ACTION_WIDTH }}
      type="button"
    >
      {children}
    </button>
  )
}
