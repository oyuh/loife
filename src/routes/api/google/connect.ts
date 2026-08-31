import { createFileRoute } from '@tanstack/react-router'
import { setCookie } from '@tanstack/react-start/server'
import { isProduction } from '#/lib/env'
import { googleAuthorizeUrl } from '#/lib/google.server'
import { getSessionUser } from '#/lib/session.server'

export const Route = createFileRoute('/api/google/connect')({
  server: {
    handlers: {
      GET: async () => {
        // Signing in with GitHub gates this, so nobody else can start a grant
        // against your Google account.
        if (!(await getSessionUser())) {
          return new Response('Sign in first.', { status: 403 })
        }

        const state = crypto.randomUUID()
        setCookie('loife_google_state', state, {
          httpOnly: true,
          sameSite: 'lax',
          secure: isProduction,
          path: '/',
          maxAge: 600,
        })

        return new Response(null, {
          status: 302,
          headers: { Location: googleAuthorizeUrl(state) },
        })
      },
    },
  },
})
