import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { AddItemDialog } from '#/components/add-item-dialog'
import { AppShell } from '#/components/app-shell'
import { BulkAddDialog } from '#/components/bulk-add-dialog'
import { CommandPalette } from '#/components/command-palette'
import { JournalComposeDialog } from '#/components/journal-compose-dialog'
import { Toaster } from '#/components/ui/sonner'
import { TooltipProvider } from '#/components/ui/tooltip'
import { itemsQuery } from '#/lib/queries'
import { fetchCurrentUser } from '#/server/auth'

/**
 * Pathless layout wrapping every signed-in page. The guard sits here so a new
 * route cannot be added without it, though the server functions still check
 * the session themselves, since this one only protects the UI.
 */
export const Route = createFileRoute('/_app')({
  /*
   * beforeLoad runs on every navigation into this layout, and on the client a
   * server function is an HTTP request, so the bare call put a round trip in
   * front of every page change. Cached instead: the session cookie does not
   * change while the tab is open, and signing out reloads the page.
   */
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData({
      queryKey: ['current-user'] as const,
      queryFn: () => fetchCurrentUser(),
      staleTime: Number.POSITIVE_INFINITY,
    })
    if (!user) throw redirect({ to: '/signin' })
    return { user }
  },
  component: AppLayout,
})

function AppLayout() {
  // The add dialog is reachable from the nav and the palette, so its state
  // lives here rather than in either one.
  const [adding, setAdding] = useState(false)
  const [bulkAdding, setBulkAdding] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  // The day being written into, and the palette text that seeded it.
  const [writing, setWriting] = useState<{ date: string; seed: string }>({
    date: '',
    seed: '',
  })
  // A search result opens the assignment, so the layout holds the id and the
  // Today route is not the only place an item can be edited from.
  const [openItemId, setOpenItemId] = useState<number | null>(null)

  return (
    // One provider for the whole signed-in app, so every date tooltip shares a
    // delay and moving between two of them does not wait twice.
    <TooltipProvider>
      <AppShell
        onAddItem={() => setAdding(true)}
        onOpenPalette={() => setPaletteOpen(true)}
      >
        <Outlet />
      </AppShell>

      <AddItemDialog open={adding} onOpenChange={setAdding} />
      <BulkAddDialog open={bulkAdding} onOpenChange={setBulkAdding} />
      <CommandPalette
        onAddItem={() => setAdding(true)}
        onBulkAdd={() => setBulkAdding(true)}
        onWriteJournal={(date, seed) => setWriting({ date, seed })}
        onOpenChange={setPaletteOpen}
        onOpenItem={setOpenItemId}
        onQueryChange={setPaletteQuery}
        open={paletteOpen}
        query={paletteQuery}
      />
      <JournalComposeDialog
        date={writing.date || null}
        onOpenChange={(open) => {
          if (!open) setWriting({ date: '', seed: '' })
        }}
        seed={writing.seed}
      />
      <SearchResultDialog
        id={openItemId}
        onOpenChange={(open) => {
          if (!open) setOpenItemId(null)
        }}
      />
      <Toaster position="top-center" />
    </TooltipProvider>
  )
}

/** Opens an assignment picked from search, wherever you happen to be. */
function SearchResultDialog({
  id,
  onOpenChange,
}: {
  id: number | null
  onOpenChange: (open: boolean) => void
}) {
  const { data: items = [] } = useQuery({ ...itemsQuery, enabled: id !== null })
  const item = items.find((candidate) => candidate.id === id) ?? null

  return (
    <AddItemDialog
      item={item}
      onOpenChange={onOpenChange}
      open={item !== null}
    />
  )
}
