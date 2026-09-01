import { format, isValid, parse } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import { Input } from '#/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { cn } from '#/lib/utils'

/**
 * A date field that picks the right control for the device.
 *
 * A phone already has a good date picker, and it is the one the OS puts on the
 * bottom of the screen with a thumb-sized wheel. A desktop browser has a
 * cramped dropdown that varies per browser, so from `sm` up this shows a
 * calendar instead.
 *
 * Both controls render and CSS chooses between them, rather than a media query
 * in JavaScript. That keeps the server and the client rendering the same
 * markup, which a `window.matchMedia` check would not.
 *
 * kibo has no date input. Its `mini-calendar` is a strip of consecutive days
 * for picking one near today, which cannot reach a term start months out, and
 * its `calendar` displays a year of events rather than taking a value. So the
 * desktop half is shadcn's Calendar, which is the same react-day-picker kibo
 * builds its own calendar on.
 */

/** The wire format everywhere in this app, and what a date input reads. */
const WIRE = 'yyyy-MM-dd'

function toDate(value: string): Date | undefined {
  if (!value) return undefined
  // Parsed from parts rather than through `new Date`, which reads a bare
  // yyyy-mm-dd as UTC midnight and lands on the day before in this timezone.
  const parsed = parse(value, WIRE, new Date())
  return isValid(parsed) ? parsed : undefined
}

export function DateField({
  id,
  value,
  onChange,
  label,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  /** Names the desktop button, which has no visible text when empty. */
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = toDate(value)

  return (
    <>
      <Input
        className={cn('h-11 sm:hidden', className)}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />

      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-label={selected ? `${label}: ${value}` : label}
            className={cn(
              'hidden h-11 w-full justify-start px-3 font-normal sm:flex',
              !selected && 'text-muted-foreground',
              className,
            )}
            type="button"
            variant="outline"
          >
            <CalendarIcon aria-hidden="true" className="shrink-0 opacity-60" />
            {selected ? format(selected, 'MMM d, yyyy') : 'Pick a date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            // Dropdowns rather than one month at a time, because a term start
            // or a journal entry from last semester is a lot of arrow presses.
            captionLayout="dropdown"
            // Without this it opens on today, so editing a term that started
            // in January means paging back from wherever you are now.
            defaultMonth={selected}
            mode="single"
            onSelect={(date) => {
              onChange(date ? format(date, WIRE) : '')
              setOpen(false)
            }}
            selected={selected}
            startMonth={new Date(new Date().getFullYear() - 2, 0)}
            endMonth={new Date(new Date().getFullYear() + 3, 11)}
          />
        </PopoverContent>
      </Popover>
    </>
  )
}
