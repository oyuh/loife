import { ClockIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import { Input } from '#/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { formatTime, parseTime, timeOptions } from '#/lib/parse-time'
import { cn } from '#/lib/utils'

/**
 * A time field you type into.
 *
 * A phone already has a good time picker, and it is the wheel the OS puts at
 * the bottom of the screen, so below `sm` this stays a native input. On a
 * desktop the native control is three fiddly spin boxes, so from `sm` up this
 * is a text box with a list under it.
 *
 * Type whatever you like. `930`, `9:30`, `9:30 pm` and `2130` all land on the
 * same place, and anything the list does not offer is still accepted as long
 * as it parses. The list is every quarter hour, which is where nearly every
 * class and meeting starts.
 *
 * Both controls render and CSS chooses, rather than a media query in
 * JavaScript, so the server and the client agree on the markup.
 */

const OPTIONS = timeOptions()

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
  /** Names the desktop button, which shows only a time once one is set. */
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // What was typed is only a draft until it parses, so the field keeps showing
  // the committed value until then.
  const draft = parseTime(typed)

  // Typing an hour on its own should offer that whole hour. `9` parses to
  // 09:00, and filtering on that alone would hide 9:15 through 9:45, which are
  // the times you were most likely reaching for.
  const hourOnly = /^\d{1,2}\s*(am|pm|a|p)?$/i.test(typed.trim())
  let visible = OPTIONS
  if (typed) {
    visible = draft
      ? OPTIONS.filter((option) =>
          option.startsWith(hourOnly ? draft.slice(0, 3) : draft),
        )
      : []
  }

  const commit = (next: string) => {
    onChange(next)
    setTyped('')
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    // Opening on midnight when the class starts at 09:30 means scrolling past
    // most of the day, so the current value is brought into view.
    const id = window.setTimeout(() => {
      listRef.current
        ?.querySelector('[data-selected-time="true"]')
        ?.scrollIntoView({ block: 'center' })
    }, 0)
    return () => window.clearTimeout(id)
  }, [open])

  return (
    <>
      <Input
        className={cn('h-11 sm:hidden', className)}
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

      <Popover
        onOpenChange={(next) => {
          setOpen(next)
          // Closing on a half typed time keeps what parses and drops the rest.
          if (!next && draft) commit(draft)
          if (!next) setTyped('')
        }}
        open={open}
      >
        <PopoverTrigger asChild>
          <Button
            aria-label={value ? `${label}: ${formatTime(value)}` : label}
            className={cn(
              'hidden h-11 w-full justify-start px-3 font-normal sm:flex',
              !value && 'text-muted-foreground',
              className,
            )}
            type="button"
            variant="outline"
          >
            <ClockIcon aria-hidden="true" className="shrink-0 opacity-60" />
            {value ? formatTime(value) : 'Pick a time'}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-56 p-0">
          <Command
            // Times are filtered by hand below, because cmdk's fuzzy match
            // treats `930` as a loose match on half the day.
            shouldFilter={false}
          >
            <CommandInput
              onValueChange={setTyped}
              placeholder="Type a time"
              value={typed}
            />
            <CommandList ref={listRef}>
              <CommandEmpty>Not a time.</CommandEmpty>

              {/* Anything that parses is offered first, so a time the list
                  does not carry is still one keystroke away. */}
              {draft && !OPTIONS.includes(draft) && (
                <CommandItem onSelect={() => commit(draft)} value={draft}>
                  Use {formatTime(draft)}
                </CommandItem>
              )}

              {visible.map((option) => (
                <CommandItem
                  data-selected-time={option === value}
                  key={option}
                  onSelect={() => commit(option)}
                  value={option}
                >
                  {formatTime(option)}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  )
}
