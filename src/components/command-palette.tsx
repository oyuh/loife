import { useNavigate } from '@tanstack/react-router'
import { BookOpen, CalendarCheck, NotebookPen, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '#/components/ui/command'
import { Kbd } from '#/components/ui/kbd'

export function CommandPalette({ onAddItem }: { onAddItem: () => void }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k') return
      if (!event.metaKey && !event.ctrlKey) return
      event.preventDefault()
      setOpen((previous) => !previous)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close first so focus returns before the next thing takes it.
  const run = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Add work or jump between pages"
    >
      <CommandInput placeholder="Type a command…" />
      <CommandList>
        <CommandEmpty>Nothing matches that.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(onAddItem)}>
            <Plus />
            Add assignment
            <CommandShortcut>
              <Kbd>A</Kbd>
            </CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => run(() => navigate({ to: '/' }))}>
            <CalendarCheck />
            Today
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: '/courses' }))}>
            <BookOpen />
            Courses
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: '/journal' }))}>
            <NotebookPen />
            Journal
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
