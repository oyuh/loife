import { type RefObject, useEffect, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'

/**
 * How many times scrolling may extend the list on its own before it wants a
 * click. Without a ceiling the bottom of the page is unreachable: anything
 * under the list moves down by another slice every time you get near it, and
 * History keeps its recent activity down there.
 */
const AUTO_STEPS = 5

/** Loaded before the bottom arrives, so the list reads as continuous. */
const LOOKAHEAD = '600px'

export interface Reveal<T> {
  /** The rows to render right now. */
  shown: T[]
  /** How many are still held back. */
  more: number
  sentinel: RefObject<HTMLButtonElement | null>
  showMore: () => void
}

/**
 * Shows the front of a long list and grows it as its end comes into view.
 *
 * These lists are read newest first and downwards, which is the case page
 * numbers are worst at: page 4 of a journal is not a place anyone means to go,
 * and the number moves every time you write an entry. So there are no pages.
 * There is a list that keeps going, and the rows you have not scrolled to yet
 * are not in the document.
 *
 * `resetKey` is whatever changes the list out from under this. A filter, a
 * chosen date. Without it a search that matches three things would still be
 * offering to show forty more of the list you just left.
 */
export function useReveal<T>(
  rows: T[],
  step: number,
  resetKey?: unknown,
): Reveal<T> {
  const [count, setCount] = useState(step)
  const sentinel = useRef<HTMLButtonElement>(null)
  const autoLoads = useRef(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is the whole point
  useEffect(() => {
    setCount(step)
    autoLoads.current = 0
  }, [resetKey, step])

  const more = Math.max(rows.length - count, 0)

  // Asking again resets the allowance, so a click buys another run of
  // scrolling rather than one more slice.
  const showMore = () => {
    autoLoads.current = 0
    setCount((current) => current + step)
  }

  useEffect(() => {
    const element = sentinel.current
    if (!element || more === 0) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        if (autoLoads.current >= AUTO_STEPS) return
        autoLoads.current += 1
        setCount((current) => current + step)
      },
      { rootMargin: LOOKAHEAD },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [more, step])

  return { shown: rows.slice(0, count), more, sentinel, showMore }
}

/**
 * The end of a revealed list.
 *
 * A real button rather than a bare marker div, because the observer is an
 * optimisation and not the interface: a keyboard, a screen reader, and any
 * browser that fires nothing still have the thing to press. Its height is
 * fixed, so a slice arriving does not shift what is already on screen.
 */
export function RevealMore<T>({
  reveal,
  noun,
}: {
  reveal: Reveal<T>
  noun: string
}) {
  if (reveal.more === 0) return null

  return (
    <div className="flex justify-center pt-6 pb-2">
      <Button
        className="min-h-11 text-muted-foreground text-xs"
        onClick={reveal.showMore}
        ref={reveal.sentinel}
        type="button"
        variant="ghost"
      >
        Show more
        <span className="tabular-nums">
          {reveal.more} {noun} left
        </span>
      </Button>
    </div>
  )
}
