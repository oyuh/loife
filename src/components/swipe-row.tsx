import { type ReactNode, useRef, useState } from 'react'
import { cn } from '#/lib/utils'

/**
 * Swipe a row left to reveal its actions.
 *
 * Hand rolled on pointer events rather than a gesture library, because the
 * hard part is not the maths but deciding when a drag is a swipe and when it
 * is the page scrolling. The rule here: the first few pixels decide, and once
 * a direction wins it keeps the gesture.
 */

const ACTIONS_WIDTH = 176
/** Movement before a direction is chosen. */
const DIRECTION_THRESHOLD = 8
/** How far you have to get for the row to stay open on release. */
const OPEN_THRESHOLD = ACTIONS_WIDTH / 2

export function SwipeRow({
  children,
  actions,
  disabled,
}: {
  children: ReactNode
  actions: ReactNode
  disabled?: boolean
}) {
  const [offset, setOffset] = useState(0)
  const [sliding, setSliding] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'undecided' | 'horizontal' | 'vertical'>('undecided')

  const close = () => setOffset(0)

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

    // Left only, and never past the width of the actions behind it.
    const next = Math.min(
      0,
      Math.max(-ACTIONS_WIDTH, dx + (offset < 0 ? -0 : 0)),
    )
    setOffset(next)
  }

  const onPointerUp = () => {
    if (axis.current === 'horizontal') {
      setOffset(offset < -OPEN_THRESHOLD ? -ACTIONS_WIDTH : 0)
    }
    start.current = null
    axis.current = 'undecided'
    setSliding(false)
  }

  const open = offset !== 0

  return (
    <div className="relative overflow-hidden">
      {/* Sits behind the row and is revealed as it slides. */}
      <div
        aria-hidden={!open}
        className="absolute inset-y-0 right-0 flex items-center gap-1 pr-1"
        style={{ width: ACTIONS_WIDTH }}
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
          onClick={close}
          type="button"
        />
      )}
    </div>
  )
}
