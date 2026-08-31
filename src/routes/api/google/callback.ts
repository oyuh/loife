import { createFileRoute } from '@tanstack/react-router'
import { deleteCookie, getCookie } from '@tanstack/react-start/server'
import {
  ensureCalendarId,
  exchangeGoogleCode,
  saveGoogleGrant,
} from '#/lib/google.server'
import { getSessionUser } from '#/lib/session.server'

function deny(message: string): Response {
  return new Response(message, {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export const Route = createFileRoute('/api/google/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await getSessionUser())) return deny('Sign in first.')

        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const expectedState = getCookie('loife_google_state')

        deleteCookie('loife_google_state', { path: '/' })

        if (!code || !state || !expectedState || state !== expectedState) {
          return deny('OAuth state check failed. Start again from Settings.')
        }

        await saveGoogleGrant(await exchangeGoogleCode(code))

        // Create the dedicated calendar straight away, so the first assignment
        // sync is not also the first time this can fail.
        await ensureCalendarId()

        return new Response(null, { status: 302, headers: { Location: '/' } })
      },
    },
  },
})
