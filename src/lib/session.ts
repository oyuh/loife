import { useSession } from '@tanstack/react-start/server'
import { isProduction, requireEnv } from './env'

export interface AppSession {
  githubId: number
  login: string
  name: string | null
  avatarUrl: string
}

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30

/**
 * Start seals session cookies with encryption and a signature, so there is no
 * hand-rolled HMAC here.
 */
export function useAppSession() {
  return useSession<AppSession>({
    name: 'loife_session',
    password: requireEnv('SESSION_SECRET'),
    maxAge: THIRTY_DAYS_IN_SECONDS,
    // Cookie only. Turning the header channel off means a request cannot hand
    // us a session through `x-loife_session-session`.
    sessionHeader: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
      maxAge: THIRTY_DAYS_IN_SECONDS,
    },
  })
}

/** The signed-in user, or null. Read this before returning any private data. */
export async function getSessionUser(): Promise<AppSession | null> {
  const session = await useAppSession()
  const { githubId, login, name, avatarUrl } = session.data
  if (!githubId || !login || !avatarUrl) return null
  return { githubId, login, name: name ?? null, avatarUrl }
}
