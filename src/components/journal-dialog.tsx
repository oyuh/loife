import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { AttachmentsPanel } from '#/components/attachments-panel'
import { MarkdownField } from '#/components/markdown-field'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '#/components/ui/drawer'
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { journalQuery } from '#/lib/queries'
import { useMediaQuery } from '#/lib/use-media-query'
import { getLogEntry, updateLogEntry } from '#/server/journal'

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export function JournalDialog({
  entryId,
  onOpenChange,
}: {
  entryId: number | null
  onOpenChange: (open: boolean) => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const titleId = useId()
  const bodyId = useId()
  const queryClient = useQueryClient()
  const isDesktop = useMediaQuery('(min-width: 640px)')

  // The list only carries a preview, so the full body is fetched on open.
  const { data: entry, isLoading } = useQuery({
    queryKey: ['journal', entryId],
    queryFn: () => getLogEntry({ data: { id: entryId as number } }),
    enabled: entryId !== null,
  })

  useEffect(() => {
    setTitle(entry?.title ?? '')
    setBody(entry?.body ?? '')
  }, [entry])

  const save = useMutation({
    mutationFn: () =>
      updateLogEntry({
        data: { id: entryId as number, title, body },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalQuery.queryKey })
      queryClient.invalidateQueries({ queryKey: ['journal', entryId] })
      toast.success('Saved')
      onOpenChange(false)
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : 'Could not save that',
      ),
  })

  const heading = entry
    ? dayFormat.format(new Date(`${entry.date}T00:00:00`))
    : 'Loading…'

  const content = (
    <form
      className="pb-2"
      id="journal-form"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={titleId}>
            Title
            <span className="ml-1 font-normal text-muted-foreground">
              optional
            </span>
          </FieldLabel>
          <Input
            className="h-11"
            id={titleId}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="A name for the day"
            value={title}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={bodyId}>Entry</FieldLabel>
          <MarkdownField
            className="min-h-48 font-normal"
            disabled={isLoading}
            id={bodyId}
            onChange={setBody}
            placeholder="What happened."
            rows={10}
            value={body}
          />
        </Field>

        {entryId !== null && (
          <Field>
            <FieldLabel>Attachments</FieldLabel>
            <AttachmentsPanel logEntryId={entryId} />
          </Field>
        )}
      </FieldGroup>
    </form>
  )

  const submit = (
    <Button
      className="min-h-11 w-full sm:w-auto"
      disabled={save.isPending || isLoading}
      form="journal-form"
      type="submit"
    >
      {save.isPending ? 'Saving…' : 'Save'}
    </Button>
  )

  const close = (next: boolean) => {
    if (!save.isPending) onOpenChange(next)
  }

  if (!isDesktop) {
    return (
      <Drawer onOpenChange={close} open={entryId !== null}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{heading}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4">{content}</div>
          <DrawerFooter>{submit}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog onOpenChange={close} open={entryId !== null}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        {content}
        <DialogFooter>{submit}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
