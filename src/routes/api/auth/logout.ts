import { createFileRoute } from '@tanstack/react-router'
import { useAppSession } from '#/lib/session'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      // POST because it changes state. A GET would let any image tag log you out.
      POST: async () => {
        const session = await useAppSession()
        await session.clear()
        return new Response(null, { status: 302, headers: { Location: '/' } })
      },

      // Without this a GET falls through to the app shell and answers 200.
      GET: () =>
        new Response('Use POST to sign out.', {
          status: 405,
          headers: { Allow: 'POST', 'Content-Type': 'text/plain; charset=utf-8' },
        }),
    },
  },
})
