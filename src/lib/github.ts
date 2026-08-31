import { requireEnv } from './env'

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const TOKEN_URL = 'https://github.com/login/oauth/access_token'
const USER_URL = 'https://api.github.com/user'

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  avatar_url: string
}

export function callbackUrl(): string {
  return `${requireEnv('PUBLIC_URL')}/api/auth/callback`
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('GITHUB_CLIENT_ID'),
    redirect_uri: callbackUrl(),
    scope: 'read:user',
    state,
  })
  return `${AUTHORIZE_URL}?${params}`
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: requireEnv('GITHUB_CLIENT_ID'),
      client_secret: requireEnv('GITHUB_CLIENT_SECRET'),
      code,
      redirect_uri: callbackUrl(),
    }),
  })

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed with ${response.status}`)
  }

  const body = (await response.json()) as {
    access_token?: string
    error_description?: string
  }

  if (!body.access_token) {
    throw new Error(
      `GitHub returned no access token: ${body.error_description ?? 'no reason given'}`,
    )
  }

  return body.access_token
}

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const response = await fetch(USER_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'loife',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub user lookup failed with ${response.status}`)
  }

  return (await response.json()) as GitHubUser
}

/**
 * The allowlist. Compares the numeric account ID rather than the login, because
 * GitHub lets a username be changed and then claimed by someone else.
 */
export function isAllowedUser(user: GitHubUser): boolean {
  return String(user.id) === requireEnv('ALLOWED_GITHUB_ID')
}
