import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { AddItemDialog } from '#/components/add-item-dialog'
import { AppShell } from '#/components/app-shell'
import { BulkAddDialog } from '#/components/bulk-add-dialog'
import { CommandPalette } from '#/components/command-palette'
import { Toaster } from '#/components/ui/sonner'
import { itemsQuery } from '#/lib/queries'
import { fetchCurrentUser } from '#/server/auth'

/**
 * Pathless layout wrapping every signed-in page. The guard sits here so a new
 * route cannot be added without it, though the server functions still check
 * the session themselves, since this one only protects the UI.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const user = await fetchCurrentUser()
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
  // A search result opens the assignment, so the layout holds the id and the
  // Today route is not the only place an item can be edited from.
  const [openItemId, setOpenItemId] = useState<number | null>(null)

  return (
    <>
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
        onOpenChange={setPaletteOpen}
        onOpenItem={setOpenItemId}
        onQueryChange={setPaletteQuery}
        open={paletteOpen}
        query={paletteQuery}
      />
      <SearchResultDialog
        id={openItemId}
        onOpenChange={(open) => {
          if (!open) setOpenItemId(null)
        }}
      />
      <Toaster position="top-center" />
    </>
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
