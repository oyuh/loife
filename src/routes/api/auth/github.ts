import { createFileRoute } from '@tanstack/react-router'
import { setCookie } from '@tanstack/react-start/server'
import { isProduction } from '#/lib/env'
import { authorizeUrl } from '#/lib/github'

export const Route = createFileRoute('/api/auth/github')({
  server: {
    handlers: {
      GET: () => {
        // Random state, echoed back by GitHub and checked in the callback. This
        // is what stops an attacker replaying their own authorization code.
        const state = crypto.randomUUID()

        setCookie('loife_oauth_state', state, {
          httpOnly: true,
          sameSite: 'lax',
          secure: isProduction,
          path: '/',
          maxAge: 600,
        })

        return new Response(null, {
          status: 302,
          headers: { Location: authorizeUrl(state) },
        })
      },
    },
  },
})
