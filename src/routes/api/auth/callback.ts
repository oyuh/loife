import { createFileRoute } from '@tanstack/react-router'
import { deleteCookie, getCookie } from '@tanstack/react-start/server'
import {
  exchangeCodeForToken,
  fetchGitHubUser,
  isAllowedUser,
} from '#/lib/github'
import { useAppSession } from '#/lib/session'

function deny(message: string): Response {
  return new Response(message, {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const expectedState = getCookie('loife_oauth_state')

        // Single use, whatever happens next.
        deleteCookie('loife_oauth_state', { path: '/' })

        if (!code || !state || !expectedState || state !== expectedState) {
          return deny('OAuth state check failed. Start again from the sign in link.')
        }

        const token = await exchangeCodeForToken(code)
        const user = await fetchGitHubUser(token)

        if (!isAllowedUser(user)) {
          return deny('This app has one user and your account is not it.')
        }

        const session = await useAppSession()
        await session.update({
          githubId: user.id,
          login: user.login,
          name: user.name,
          avatarUrl: user.avatar_url,
        })

        return new Response(null, { status: 302, headers: { Location: '/' } })
      },
    },
  },
})
