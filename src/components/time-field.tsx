import { ClockIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '#/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { formatTime, parseTime } from '#/lib/parse-time'
import { cn } from '#/lib/utils'

/**
 * A time field you type into, with a wheel behind it.
 *
 * A phone already has a good time picker, and it is the wheel the OS puts at
 * the bottom of the screen, so below `sm` this stays a native input.
 *
 * On a desktop the box takes typing. `930`, `9:30`, `9:30 pm` and `2130` all
 * land in the same place, and the clock opens three columns you spin the way
 * an iPhone does. The wheel steps in five minutes and the parser does not, so
 * anything it cannot land on is still one thing you can type.
 */

/** Tall enough to be a touch target, and the unit every offset works in. */
const ROW = 44

/** Odd, so one row sits in the middle with the same number above and below. */
const VISIBLE = 5

const PAD = ((VISIBLE - 1) / 2) * ROW

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)
const MERIDIEMS = ['AM', 'PM'] as const

interface Parts {
  hour: number
  minute: number
  meridiem: 'AM' | 'PM'
}

/** Nine in the morning, for a field opened with nothing in it yet. */
const DEFAULT_PARTS: Parts = { hour: 9, minute: 0, meridiem: 'AM' }

function toParts(value: string): Parts | null {
  const wire = parseTime(value)
  if (!wire) return null

  const [hours, minutes] = wire.split(':').map(Number)
  // Rounded onto the wheel's step, so a typed 9:37 still parks somewhere.
  const stepped = Math.min(55, Math.round(minutes / 5) * 5)

  return {
    hour: hours % 12 === 0 ? 12 : hours % 12,
    minute: stepped,
    meridiem: hours < 12 ? 'AM' : 'PM',
  }
}

function fromParts({ hour, minute, meridiem }: Parts): string {
  let hours = hour === 12 ? 0 : hour
  if (meridiem === 'PM') hours += 12
  return `${String(hours).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * One spinning column.
 *
 * No CSS scroll snapping. It is what every wheel recipe reaches for, and in a
 * container this short Chrome resolves a wheel notch straight back onto the
 * row it started from, so the column will not move at all for a mouse or a
 * trackpad. Measured: the same gesture moves it 132px with snapping off and
 * 0px with either `mandatory` or `proximity`.
 *
 * The wheel is handled here too, one row per notch, rather than left to the
 * browser to resolve into a distance. Small deltas were being swallowed
 * whole, which is the difference between a wheel that feels stiff and one
 * that does not appear to work at all.
 *
 * Dragging and touch still scroll the box directly, and the row is centred
 * once that stops. There is no event for "stopped flicking" that everything
 * agrees on, so settling is a short debounce after the last scroll.
 */
function Column<T extends string | number>({
  options,
  value,
  onSelect,
  label,
  format,
}: {
  options: readonly T[]
  value: T
  onSelect: (next: T) => void
  label: string
  format?: (option: T) => string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const name = useId()
  const settling = useRef<number | null>(null)

  const index = Math.max(0, options.indexOf(value))

  // The wheel listener is bound once, so it reads the current position and
  // callback through refs rather than being torn down on every render.
  const latest = useRef({ index, options, onSelect })
  latest.current = { index, options, onSelect }

  // Park on the current value, including when it changed by typing rather
  // than by spinning.
  useEffect(() => {
    const node = ref.current
    if (!node) return

    const target = index * ROW
    if (Math.abs(node.scrollTop - target) < 2) return

    // Instant, not smooth. A glide passes through every row on the way and
    // the settle handler below reads one of them as a choice, which walked the
    // value somewhere nobody asked for. Landing straight on the row means the
    // handler finds nothing changed and stays quiet.
    node.scrollTop = target
  }, [index])

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Trackpads fire many small deltas and a mouse fires one large one, so
    // distance is accumulated and spent a row at a time.
    let travelled = 0

    const onWheel = (event: WheelEvent) => {
      // Only works on a listener registered as non-passive, which is why this
      // is not React's onWheel.
      event.preventDefault()

      travelled += event.deltaY
      const steps = Math.trunc(travelled / ROW)
      if (!steps) return
      travelled -= steps * ROW

      const current = latest.current
      const next = Math.min(
        current.options.length - 1,
        Math.max(0, current.index + steps),
      )
      if (next !== current.index) current.onSelect(current.options[next])
    }

    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(
    () => () => {
      if (settling.current) window.clearTimeout(settling.current)
    },
    [],
  )

  return (
    // The fieldset names the group and does not scroll. Scrolling happens on
    // the div inside it, because Chromium will set scrollTop on a fieldset but
    // will not let a wheel or a trackpad move it, which left the column frozen
    // while every programmatic check passed.
    <fieldset className="min-w-0 flex-1">
      <legend className="sr-only">{label}</legend>
      <div
        className="relative overflow-y-auto"
        onScroll={() => {
          if (settling.current) window.clearTimeout(settling.current)
          settling.current = window.setTimeout(() => {
            const node = ref.current
            if (!node) return

            const index = Math.round(node.scrollTop / ROW)
            const landed = options[index]
            if (landed === undefined) return

            // Centre it here, since there is no CSS snapping left to do it.
            // Smooth is safe on this path: a drag has already stopped, so the
            // rows it glides past cannot be read back as another choice.
            node.scrollTo({ top: index * ROW, behavior: 'smooth' })
            if (landed !== value) onSelect(landed)
          }, 120)
        }}
        ref={ref}
        style={{ height: VISIBLE * ROW }}
      >
        <div style={{ height: PAD }} />
        {options.map((option) => (
          <label
            className={cn(
              'flex w-full cursor-pointer items-center justify-center',
              'text-base tabular-nums transition-colors',
              'has-[:focus-visible]:rounded-md has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
              option === value
                ? 'font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            key={String(option)}
            style={{ height: ROW }}
          >
            {/* A real radio group, so the arrow keys spin the column without
              any key handling written here. */}
            <input
              checked={option === value}
              className="sr-only"
              name={name}
              onChange={() => onSelect(option)}
              type="radio"
              value={String(option)}
            />
            {format ? format(option) : option}
          </label>
        ))}
        <div style={{ height: PAD }} />
      </div>
    </fieldset>
  )
}

export function TimeField({
  id,
  value,
  onChange,
  label,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  /** Names the clock button, which carries no visible text. */
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState<string | null>(null)

  /*
   * The wheel holds its own position rather than reading it back out of the
   * value it just wrote. Deriving it meant that committing one column
   * re-rendered the other two, which re-parked them, which could land a column
   * the user was still flicking on the wrong row.
   */
  const [parts, setParts] = useState<Parts>(
    () => toParts(value) ?? DEFAULT_PARTS,
  )

  // Null means nothing is half typed, so the box shows the committed value.
  const text = typed ?? (value ? formatTime(value) : '')

  // Opening is the moment to catch up with a value that was typed instead.
  useEffect(() => {
    if (open) setParts(toParts(value) ?? DEFAULT_PARTS)
  }, [open, value])

  const commitTyped = () => {
    if (typed === null) return
    const parsed = parseTime(typed)
    // An empty box clears the field. Anything unreadable snaps back, rather
    // than saving something that was never a time.
    if (parsed) onChange(parsed)
    else if (!typed.trim()) onChange('')
    setTyped(null)
  }

  const spin = (next: Partial<Parts>) => {
    const merged = { ...parts, ...next }
    setParts(merged)
    onChange(fromParts(merged))
  }

  return (
    <>
      {/* Empty draws as a blank box on iOS, so it says what it is instead.
          Same trick as the date field next to it. */}
      <div className={cn('relative sm:hidden', className)}>
        <Input
          className={cn('h-11', !value && 'text-transparent')}
          id={id}
          onChange={(event) => {
            const next = event.target.value
            // A native time input reports half finished edits as well. Callers
            // save what they are handed, so only a complete time gets through.
            if (!next || parseTime(next)) onChange(next)
          }}
          type="time"
          value={value}
        />
        {!value && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-2 left-3 flex items-center truncate text-base text-muted-foreground"
          >
            Pick a time
          </span>
        )}
      </div>

      <div className={cn('relative hidden sm:block', className)}>
        {/* The native input above owns `id`, so this one is named instead
            rather than repeating it and leaving two in the document. */}
        <Input
          aria-label={label}
          className="h-11 pr-11"
          onBlur={commitTyped}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitTyped()
            }
            if (event.key === 'Escape') setTyped(null)
          }}
          placeholder="Type a time"
          value={text}
        />

        <Popover onOpenChange={setOpen} open={open}>
          <PopoverTrigger asChild>
            <button
              aria-label={`${label}: open the time wheel`}
              className={cn(
                'absolute top-0 right-0 flex h-11 w-11 items-center justify-center',
                'rounded-r-md text-muted-foreground transition-colors',
                'hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              )}
              type="button"
            >
              <ClockIcon aria-hidden="true" className="size-4" />
            </button>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-56 p-0">
            <div className="relative">
              {/* The band the chosen row sits in, the way iOS marks it. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-md bg-accent"
                style={{ height: ROW }}
              />
              <div className="relative flex px-1">
                <Column
                  format={(hour) => String(hour)}
                  label="Hour"
                  onSelect={(hour) => spin({ hour })}
                  options={HOURS}
                  value={parts.hour}
                />
                <Column
                  format={(minute) => String(minute).padStart(2, '0')}
                  label="Minute"
                  onSelect={(minute) => spin({ minute })}
                  options={MINUTES}
                  value={parts.minute}
                />
                <Column
                  label="AM or PM"
                  onSelect={(meridiem) => spin({ meridiem })}
                  options={MERIDIEMS}
                  value={parts.meridiem}
                />
              </div>
            </div>

            <p className="border-border border-t px-3 py-2 text-center text-muted-foreground text-xs">
              Or type any minute in the box
            </p>
          </PopoverContent>
        </Popover>
      </div>
    </>
  )
}
