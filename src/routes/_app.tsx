import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { AddItemDialog } from '#/components/add-item-dialog'
import { AppShell } from '#/components/app-shell'
import { BulkAddDialog } from '#/components/bulk-add-dialog'
import { CommandPalette } from '#/components/command-palette'
import { Toaster } from '#/components/ui/sonner'
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

  return (
    <>
      <AppShell onAddItem={() => setAdding(true)}>
        <Outlet />
      </AppShell>

      <AddItemDialog open={adding} onOpenChange={setAdding} />
      <BulkAddDialog open={bulkAdding} onOpenChange={setBulkAdding} />
      <CommandPalette
        onAddItem={() => setAdding(true)}
        onBulkAdd={() => setBulkAdding(true)}
      />
      <Toaster position="top-center" />
    </>
  )
}
