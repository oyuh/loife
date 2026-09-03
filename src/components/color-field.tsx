import { Check, Pipette } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  ColorPicker,
  ColorPickerFormat,
  ColorPickerHue,
  type ColorPickerProps,
  ColorPickerSelection,
} from '#/components/kibo-ui/color-picker'
import { Button } from '#/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { COURSE_COLORS, nearestGoogleColor } from '#/lib/google-color'
import { useMediaQuery } from '#/lib/use-media-query'
import { cn } from '#/lib/utils'

const toHex = ([r, g, b]: number[]) =>
  `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`

export function ColorField({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  // The dialog becomes a drawer at the same width, and a popover floating over
  // a bottom sheet is both awkward to use and a fight with the drawer over who
  // owns a drag. Below this the picker opens in place instead.
  const isDesktop = useMediaQuery('(min-width: 640px)')
  const [open, setOpen] = useState(false)

  // Bumped once per opening. The picker is keyed on it so that reopening
  // reloads the colour from the form, without the key changing as the colour
  // changes: keying on the value itself remounts the picker mid-drag, which
  // resets its dragging state and stops the drag after a single move.
  const [session, setSession] = useState(0)

  const google = nearestGoogleColor(value)
  const custom = !COURSE_COLORS.includes(value.toLowerCase())

  // Whether the pointer or keyboard has actually reached the picker this
  // session.
  //
  // Mounting the picker emits a colour on its own, because it converts through
  // HSL and back and can land a digit off what it was handed. Propagating that
  // would knock a preset out of its own selected state the moment the picker
  // opened. Counting emissions is not enough to spot it, since React runs an
  // effect twice per mount in development, so this waits for a real gesture.
  const touched = useRef(false)

  // Held in a ref, and the callback below never changes identity.
  //
  // ColorPicker lists onChange in the deps of the effect that calls it. Every
  // caller passes an inline arrow, so a callback rebuilt on each render gives
  // that effect a new identity each time: it fires, the parent sets state, the
  // render produces another new identity, and it fires again forever. A stable
  // callback means the effect only runs when the colour actually moves.
  const latest = useRef(onChange)
  useEffect(() => {
    latest.current = onChange
  }, [onChange])

  const handleChange = useCallback((rgba: number[]) => {
    if (!touched.current) return
    latest.current(toHex(rgba))
  }, [])

  const setOpenState = (next: boolean) => {
    if (next) {
      touched.current = false
      setSession((n) => n + 1)
    }
    setOpen(next)
  }

  const picker = (
    <div
      onKeyDownCapture={() => {
        touched.current = true
      }}
      onPointerDownCapture={() => {
        touched.current = true
      }}
    >
      <ColorPicker
        className="gap-3"
        defaultValue={value}
        key={session}
        // ColorPicker's props extend the div's, so its own onChange intersects
        // with React's and nothing satisfies both. It destructures the prop out
        // rather than spreading it onto the div, so only the type is wrong.
        onChange={handleChange as unknown as ColorPickerProps['onChange']}
      >
        <ColorPickerSelection className="h-36 rounded-md" />
        <ColorPickerHue />
        {/* No alpha slider. Google takes no transparency, and a half faded
          course dot only reads as a mistake. */}
        <ColorPickerFormat />
      </ColorPicker>
    </div>
  )

  const swatches = COURSE_COLORS.map((color) => {
    const selected = value.toLowerCase() === color
    return (
      // The padding gives a 44px target while the dot itself stays small.
      <button
        aria-label={`Colour ${color}`}
        aria-pressed={selected}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        key={color}
        onClick={() => onChange(color)}
        type="button"
      >
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-full border-2',
            selected ? 'border-foreground' : 'border-transparent',
          )}
          style={{ backgroundColor: color }}
        >
          {selected && (
            <Check aria-hidden="true" className="size-4 text-white" />
          )}
        </span>
      </button>
    )
  })

  // Built per call so the mobile branch can own the click while the popover
  // branch leaves it to PopoverTrigger.
  const trigger = (onClick?: () => void) => (
    <Button
      aria-expanded={open}
      aria-label="Pick a custom colour"
      className={cn('ml-1 min-h-11 gap-2 px-3', custom && 'border-foreground')}
      onClick={onClick}
      size="sm"
      type="button"
      variant="outline"
    >
      <Pipette aria-hidden="true" className="size-4" />
      Custom
      {custom && (
        <span
          aria-hidden="true"
          className="size-4 rounded-full border border-border"
          style={{ backgroundColor: value }}
        />
      )}
    </Button>
  )

  const hint = google && (
    <p className="text-muted-foreground text-xs">
      Notion Calendar shows this as{' '}
      <span
        aria-hidden="true"
        className="inline-block size-2 translate-y-px rounded-full"
        style={{ backgroundColor: google.hex }}
      />{' '}
      <span className="text-foreground">{google.name}</span>
      {custom && ', the nearest of the eleven colours Google allows'}.
    </p>
  )

  return (
    // data-vaul-no-drag stops the drawer treating a drag in here as a pull to
    // dismiss. vaul checks the attribute on the target and its ancestors, so
    // one on the wrapper covers the square, the slider and the swatches.
    <Wrapper>
      <div className="flex flex-wrap items-center gap-1">
        {swatches}
        {isDesktop ? (
          <Popover onOpenChange={setOpenState} open={open}>
            <PopoverTrigger asChild>{trigger()}</PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3">
              {picker}
            </PopoverContent>
          </Popover>
        ) : (
          trigger(() => setOpenState(!open))
        )}
      </div>

      {!isDesktop && open && (
        <div className="rounded-md border border-border p-3">{picker}</div>
      )}

      {hint}
    </Wrapper>
  )
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2" data-vaul-no-drag>
      {children}
    </div>
  )
}
