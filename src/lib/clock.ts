/**
 * One ticking clock for the whole page.
 *
 * Relative text ("in 3 days", "2 minutes ago") has to be recomputed as time
 * passes, and the obvious way to do that — an interval inside each component —
 * puts forty timers on a list of forty rows and re-renders every one of them
 * once a second to change nothing. This is a single interval that every
 * subscriber shares, and it does not run at all when nobody is subscribed.
 *
 * Callers pick how precisely they care. A tooltip showing seconds asks for
 * 1000 and re-renders each second; a row saying "in 3 days" asks for 30000 and
 * re-renders twice a minute. The snapshot is rounded down to that precision,
 * so React's own bail-out drops the renders in between.
 */

import { useSyncExternalStore } from 'react'

const TICK_MS = 1000

const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null
let current = Date.now()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  if (!timer) {
    timer = setInterval(() => {
      current = Date.now()
      for (const notify of listeners) notify()
    }, TICK_MS)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

/** Per precision, so two components asking for the same one share the identity. */
const snapshots = new Map<number, () => number>()

function snapshotFor(precision: number): () => number {
  const existing = snapshots.get(precision)
  if (existing) return existing

  const read = () => Math.floor(current / precision) * precision
  snapshots.set(precision, read)
  return read
}

/*
 * Null on the server and on the hydrating render.
 *
 * Relative text is a comparison against the current time, and the server's
 * answer is stale before the bytes leave it. Rendering "in 3 hours" into the
 * HTML would guarantee a mismatch against whatever the browser works out a
 * moment later, so the server renders no relative text at all and it appears
 * on hydration instead.
 */
const serverSnapshot = () => null

/**
 * The current time, rounded to `precision` milliseconds, or null before the
 * first client render. Subscribing is what starts the shared interval.
 */
export function useClock(precision = 30_000): Date | null {
  const millis = useSyncExternalStore(
    subscribe,
    snapshotFor(precision),
    serverSnapshot,
  )
  return millis === null ? null : new Date(millis)
}

/** How often a readout showing seconds has to be redrawn. */
export const SECOND_PRECISION = 1000

/** Twice a minute, which is enough for anything counted in minutes or days. */
export const COARSE_PRECISION = 30_000
