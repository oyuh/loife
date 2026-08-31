import { createServerFn } from '@tanstack/react-start'
import { and, isNotNull, isNull, lt, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db'
import { items, settings } from '#/db/schema'
import { listBusy, loadSettings } from '#/lib/google.server'
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
      hideCompletedAfterMinutes: settings?.hideCompletedAfterMinutes ?? null,
      dayStart: settings?.dayStart ?? '09:00',
      dayEnd: settings?.dayEnd ?? '22:00',
      breakMinutes: settings?.breakMinutes ?? 10,
    }
  },
)

/** Preferences live in the same single settings row as the Google grant. */
export const savePreferences = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      // Null means work the delay out from priority instead.
      hideCompletedAfterMinutes: z.number().int().min(0).max(1440).nullable(),
      dayStart: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
      dayEnd: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
      breakMinutes: z.number().int().min(0).max(120).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireUser()
    await db
      .insert(settings)
      .values({ id: 1, ...data })
      .onConflictDoUpdate({ target: settings.id, set: data })
  })

/**
 * What the calendar already has in a window, so the planner works around real
 * commitments rather than only around class times.
 */
export const busyPeriods = createServerFn({ method: 'GET' })
  .validator(z.object({ from: z.string(), to: z.string() }))
  .handler(async ({ data }) => {
    await requireUser()
    return await listBusy(new Date(data.from), new Date(data.to))
  })
