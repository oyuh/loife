import { Check, Pipette } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
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
  const [open, setOpen] = useState(false)
  const google = nearestGoogleColor(value)

  // The picker converts through HSL and back, so mounting it emits a colour
  // that can sit a digit off the one it was handed. Propagating that would
  // knock a preset out of its own selected state the moment the popover
  // opened, so the first change after mount is dropped.
  const settled = useRef(false)

  const handleChange = useCallback(
    (rgba: number[]) => {
      if (!settled.current) {
        settled.current = true
        return
      }
      onChange(toHex(rgba))
    },
    [onChange],
  )

  const custom = !COURSE_COLORS.includes(value.toLowerCase())

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {COURSE_COLORS.map((color) => {
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
        })}

        <Popover
          onOpenChange={(next) => {
            if (next) settled.current = false
            setOpen(next)
          }}
          open={open}
        >
          <PopoverTrigger asChild>
            <Button
              aria-label="Pick a custom colour"
              className={cn(
                'ml-1 min-h-11 gap-2 px-3',
                custom && 'border-foreground',
              )}
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
          </PopoverTrigger>

          {/* overflow-y-auto is not for scrolling, the picker always fits.
              It makes this element a scroll container, which is what vaul
              looks for when a drawer is open: its touchmove handler calls
              preventDefault on any touch whose nearest scrollable ancestor is
              the document, and that cancelled every drag in here on a phone. */}
          <PopoverContent
            align="start"
            className="w-64 overflow-y-auto overscroll-contain p-3"
          >
            {/* Remounted per open, so it starts from the colour in the form
                rather than whatever it was left on. */}
            <ColorPicker
              className="gap-3"
              defaultValue={value}
              key={open ? value : 'closed'}
              // ColorPicker's props extend the div's, so its own onChange
              // intersects with React's and nothing satisfies both. It
              // destructures the prop out rather than spreading it onto the
              // div, so only the type is wrong, never the call.
              onChange={handleChange as unknown as ColorPickerProps['onChange']}
            >
              <ColorPickerSelection className="h-32 rounded-md" />
              <ColorPickerHue />
              {/* No alpha slider. Google takes no transparency, and a
                  half-faded course dot only reads as a mistake. */}
              <ColorPickerFormat />
            </ColorPicker>
          </PopoverContent>
        </Popover>
      </div>

      {google && (
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
      )}
    </div>
  )
}
