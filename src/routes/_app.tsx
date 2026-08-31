import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppShell } from '#/components/app-shell'
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
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})
