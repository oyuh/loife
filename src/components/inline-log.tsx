import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CornerDownLeft } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { journalQuery } from '#/lib/queries'
import { appendToDay } from '#/server/journal'

/**
 * One input, pinned to the bottom of the screen like a chat composer.
 *
 * Fixed rather than sticky. Sticky only holds while its own container is on
 * screen, so it rode the bottom of the page content rather than the viewport
 * and drifted up whenever the list was short.
 *
 * The bottom inset clears the phone tab bar and its safe area, and the left
 * pad clears the desktop rail, so the field lines up with the column above it.
 */
export function InlineLog() {
  const [text, setText] = useState('')
  const queryClient = useQueryClient()

  const log = useMutation({
    mutationFn: (line: string) => appendToDay({ data: { text: line } }),
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
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-10
                 pb-[calc(var(--bottom-inset)+5.25rem)]
                 md:pb-4 md:pl-56"
    >
      <div className="pointer-events-auto mx-auto w-full max-w-2xl px-5">
        <form
          className="flex gap-2 rounded-lg border border-border bg-card p-2 shadow-lg"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <Input
            aria-label="Log what happened"
            className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
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
          >
            <CornerDownLeft />
          </Button>
        </form>
      </div>
    </div>
  )
}
