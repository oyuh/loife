import { createServerFn } from '@tanstack/react-start'
import { and, isNotNull, isNull, lt, or } from 'drizzle-orm'
import { db } from '#/db'
import { items } from '#/db/schema'
import { loadSettings } from '#/lib/google.server'
import { requireUser } from '#/lib/session.server'
import { syncItem } from './calendar.server'

// Only createServerFn wrappers live here. Their bodies are stripped from the
// client build, whereas a plain exported function would keep google.server
// alive all the way into the browser bundle.

/**
 * Pushes anything the calendar has not caught up on. Covers a Google outage or
 * an expired token without a queue or a job runner, which is the whole reason
 * syncedAt exists alongside updatedAt.
 */
export const reconcileCalendar = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireUser()

    const settings = await loadSettings()
    if (!settings?.googleRefreshToken) return { pushed: 0 }

    const stale = await db
      .select({ id: items.id })
      .from(items)
      .where(
        and(
          isNotNull(items.dueAt),
          or(isNull(items.syncedAt), lt(items.syncedAt, items.updatedAt)),
        ),
      )
      .limit(50)

    for (const row of stale) await syncItem(row.id)
    return { pushed: stale.length }
  },
)

/** Whether the Google grant exists, so the UI can offer to connect. */
export const calendarStatus = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireUser()
    const settings = await loadSettings()
    return {
      connected: Boolean(settings?.googleRefreshToken),
      calendarId: settings?.googleCalendarId ?? null,
    }
  },
)
