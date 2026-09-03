import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '#/components/ui/drawer'
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Textarea } from '#/components/ui/textarea'
import { formatKeyDayLong, formatKeyRelative } from '#/lib/datetime'
import { journalQuery } from '#/lib/queries'
import { useMediaQuery } from '#/lib/use-media-query'
import { appendToDay } from '#/server/journal'

/**
 * Writing one line into a day, from wherever you were.
 *
 * Built to the same shape as the add dialog on purpose, down to the header,
 * the scrolling body and the footer. It used to live inside the command
 * palette's own sheet, and a short sheet with a field in it is the case vaul's
 * keyboard handling gets wrong: it measures the sheet's distance from the top
 * of the screen and sizes it to fill everything below that, which on a sheet
 * iOS had already shifted upward meant the whole viewport.
 */
export function JournalComposeDialog({
  /** The day to write into, or null when closed. */
  date,
  /** Whatever was typed in the palette, which is usually the thought itself. */
  seed = '',
  onOpenChange,
}: {
  date: string | null
  seed?: string
  onOpenChange: (open: boolean) => void
}) {
  const [text, setText] = useState(seed)
  const fieldId = useId()
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery('(min-width: 640px)')

  // Seeded on open rather than at mount, since this instance outlives any one
  // day the way the add dialog outlives any one item.
  useEffect(() => {
    if (date) setText(seed)
  }, [date, seed])

  const log = useMutation({
    mutationFn: () =>
      appendToDay({ data: { text: text.trim(), date: date as string } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalQuery.queryKey })
      toast.success('Logged')
      onOpenChange(false)
    },
    // The dialog stays open and keeps the text, so a failure never eats what
    // was written.
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : 'Could not log that',
      ),
  })

  const close = (next: boolean) => {
    if (!log.isPending) onOpenChange(next)
  }

  const title = date ? formatKeyDayLong(date) : ''
  const description = date
    ? `Adds a line to ${formatKeyRelative(date)}, stamped with the time.`
    : ''

  const body = (
    <form
      className="pb-2"
      id="journal-compose-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (text.trim()) log.mutate()
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={fieldId}>Entry</FieldLabel>
          <Textarea
            className="min-h-[22dvh] sm:min-h-32"
            id={fieldId}
            maxLength={2000}
            onChange={(event) => setText(event.target.value)}
            placeholder="What happened. Markdown works."
            value={text}
          />
        </Field>
      </FieldGroup>
    </form>
  )

  const submit = (
    <Button
      className="min-h-11 w-full sm:w-auto"
      disabled={log.isPending || !text.trim()}
      form="journal-compose-form"
      type="submit"
    >
      {log.isPending ? 'Logging…' : 'Log it'}
    </Button>
  )

  if (!isDesktop) {
    return (
      <Drawer onOpenChange={close} open={date !== null}>
        {/*
          Tall on purpose, and the variant has to match the one drawer.tsx
          already sets or tailwind-merge keeps both and the base wins.

          vaul resizes a sheet when the keyboard opens, and which arithmetic
          it uses turns on `drawerHeight > innerHeight * 0.8`. Under that bar
          it sizes the sheet from 26px below the top of the screen rather
          than from where the sheet actually starts, so a short sheet gets
          stretched to most of the screen and iOS then shoves it up out of
          the way of the keyboard. Measured at 375x812: the cap was 649.8px
          against a threshold of 649.6px. The add sheet is a long form and
          clears it, which is why that one has always behaved.
        */}
        <DrawerContent className="h-[92dvh] data-[vaul-drawer-direction=bottom]:max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4">{body}</div>
          <DrawerFooter>{submit}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog onOpenChange={close} open={date !== null}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>{submit}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
