import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { settings } from '#/db/schema'
import { requireEnv } from './env'

/**
 * Google Calendar over plain fetch. The `googleapis` package carries every
 * Google API in one dependency, and this needs four endpoints, so it stays out
 * for the same reason arctic did on the GitHub side.
 */

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

/** Write access to calendars this app creates, and nothing else. */
const SCOPE = 'https://www.googleapis.com/auth/calendar'

export const CALENDAR_NAME = 'loife'

export function googleCallbackUrl(): string {
  return `${requireEnv('PUBLIC_URL')}/api/google/callback`
}

export function googleAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: googleCallbackUrl(),
    response_type: 'code',
    scope: SCOPE,
    // offline plus consent is what makes Google hand back a refresh token.
    // Without both, a second authorization returns only an access token and
    // the grant silently stops surviving restarts.
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${AUTHORIZE_URL}?${params}`
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error_description?: string
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })

  const payload = (await response.json()) as TokenResponse
  if (!response.ok) {
    throw new Error(
      `Google token request failed with ${response.status}: ${payload.error_description ?? 'no reason given'}`,
    )
  }
  return payload
}

export async function exchangeGoogleCode(code: string): Promise<string> {
  const payload = await postToken({
    code,
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
    redirect_uri: googleCallbackUrl(),
    grant_type: 'authorization_code',
  })

  if (!payload.refresh_token) {
    throw new Error(
      'Google returned no refresh token. Revoke the app at myaccount.google.com/permissions and connect again.',
    )
  }
  return payload.refresh_token
}

/**
 * Access tokens last an hour and are cheap to mint, so they are held in memory
 * rather than stored. A restart just asks for a new one.
 */
let cachedAccessToken: { token: string; expiresAt: number } | null = null

async function accessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token
  }

  const row = await loadSettings()
  if (!row?.googleRefreshToken) {
    throw new Error('Google Calendar is not connected yet.')
  }

  const payload = await postToken({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
    refresh_token: row.googleRefreshToken,
    grant_type: 'refresh_token',
  })

  if (!payload.access_token) throw new Error('Google returned no access token')

  cachedAccessToken = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  }
  return cachedAccessToken.token
}

async function calendarFetch(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
    },
  })

  // A deleted event answers 404 or 410. Both mean the same thing to us, that
  // there is nothing left to change, so neither is an error worth throwing on.
  if (response.status === 404 || response.status === 410) return null

  if (!response.ok) {
    throw new Error(
      `Google Calendar ${path} failed with ${response.status}: ${await response.text()}`,
    )
  }

  return response.status === 204 ? null : await response.json()
}

export async function loadSettings() {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1))
  return row ?? null
}

export async function saveGoogleGrant(refreshToken: string): Promise<void> {
  await db
    .insert(settings)
    .values({ id: 1, googleRefreshToken: refreshToken })
    .onConflictDoUpdate({
      target: settings.id,
      set: { googleRefreshToken: refreshToken },
    })
  cachedAccessToken = null
}

/**
 * The dedicated calendar, created once. School events stay separable from your
 * personal ones, so they can be hidden in a click and a sync bug can never
 * touch anything else.
 */
export async function ensureCalendarId(): Promise<string> {
  const row = await loadSettings()
  if (row?.googleCalendarId) return row.googleCalendarId

  const created = (await calendarFetch('/calendars', {
    method: 'POST',
    body: JSON.stringify({
      summary: CALENDAR_NAME,
      timeZone: process.env.TZ ?? 'America/Chicago',
    }),
  })) as { id: string }

  await db
    .insert(settings)
    .values({ id: 1, googleCalendarId: created.id })
    .onConflictDoUpdate({
      target: settings.id,
      set: { googleCalendarId: created.id },
    })

  return created.id
}

export interface CalendarEvent {
  summary: string
  description?: string
  location?: string
  /** All-day events use a date, timed ones use a dateTime. */
  start: { date?: string; dateTime?: string; timeZone?: string }
  end: { date?: string; dateTime?: string; timeZone?: string }
  recurrence?: string[]
}

export async function insertEvent(event: CalendarEvent): Promise<string> {
  const calendarId = encodeURIComponent(await ensureCalendarId())
  const created = (await calendarFetch(`/calendars/${calendarId}/events`, {
    method: 'POST',
    body: JSON.stringify(event),
  })) as { id: string }
  return created.id
}

export async function patchEvent(
  eventId: string,
  event: CalendarEvent,
): Promise<boolean> {
  const calendarId = encodeURIComponent(await ensureCalendarId())
  const result = await calendarFetch(
    `/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', body: JSON.stringify(event) },
  )
  // null means Google no longer has it, so the caller should insert instead.
  return result !== null
}

export async function deleteEvent(eventId: string): Promise<void> {
  const calendarId = encodeURIComponent(await ensureCalendarId())
  await calendarFetch(
    `/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  )
}
