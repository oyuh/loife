import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CornerDownLeft } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { journalQuery } from '#/lib/queries'
import { appendToToday } from '#/server/journal'

/**
 * One input, pinned under the Today list. Type what happened and press enter,
 * and it appends to today's journal entry, creating the entry if the day has
 * none yet. Nothing to open first, which is the whole point.
 */
export function InlineLog() {
  const [text, setText] = useState('')
  const queryClient = useQueryClient()

  const log = useMutation({
    mutationFn: (line: string) => appendToToday({ data: { text: line } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalQuery.queryKey })
      toast.success('Logged')
    },
    onError: (error) => {
      // Put the text back, so a failure never eats what was typed.
      setText((current) => current || log.variables || '')
      toast.error(error instanceof Error ? error.message : 'Could not log that')
    },
  })

  const submit = () => {
    const line = text.trim()
    if (!line) return
    // Cleared straight away, so the next thought can be typed immediately.
    setText('')
    log.mutate(line)
  }

  return (
    <form
      className="mt-8 flex gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Input
        aria-label="Log what happened"
        className="h-11"
        maxLength={2000}
        onChange={(event) => setText(event.target.value)}
        placeholder="Log what happened…"
        value={text}
      />
      <Button
        aria-label="Add to today's journal"
        className="min-h-11 shrink-0"
        disabled={!text.trim() || log.isPending}
        size="icon"
        type="submit"
        variant="secondary"
      >
        <CornerDownLeft />
      </Button>
    </form>
  )
}
