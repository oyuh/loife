import { createServerFn } from '@tanstack/react-start'
import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db'
import { logEntries } from '#/db/schema'
import { localDateString } from '#/lib/calendar-event'
import { requireUser } from '#/lib/session.server'

const PREVIEW_LENGTH = 160

export interface LogEntryRow {
  id: number
  date: string
  kind: 'journal' | 'event'
  title: string | null
  preview: string | null
  /** Whether the body is longer than the preview shows. */
  truncated: boolean
}

/**
 * The list carries a preview rather than every body. A year of daily entries
 * is a few hundred kilobytes, which is a lot to ship for a screen that shows
 * one line each.
 */
export const listLogEntries = createServerFn({ method: 'GET' }).handler(
  async (): Promise<LogEntryRow[]> => {
    await requireUser()

    const rows = await db
      .select({
        id: logEntries.id,
        date: logEntries.date,
        kind: logEntries.kind,
        title: logEntries.title,
        preview: sql<
          string | null
        >`left(${logEntries.body}, ${PREVIEW_LENGTH})`,
        length: sql<number>`coalesce(length(${logEntries.body}), 0)`,
      })
      .from(logEntries)
      .orderBy(desc(logEntries.date), desc(logEntries.id))

    return rows.map(({ length, ...row }) => ({
      ...row,
      truncated: length > PREVIEW_LENGTH,
    }))
  },
)

export const getLogEntry = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await requireUser()
    const [row] = await db
      .select()
      .from(logEntries)
      .where(eq(logEntries.id, data.id))
    return row ?? null
  })

const lineInput = z.object({
  text: z.string().trim().min(1, 'Write something first').max(2000),
})

/**
 * Appends one line to today's journal entry, creating the entry if the day has
 * none yet.
 *
 * The append happens inside the insert so a second line cannot read a stale
 * body and overwrite the first. The partial unique index on (date) where
 * kind = 'journal' is what the conflict target refers to.
 */
export const appendToToday = createServerFn({ method: 'POST' })
  .validator(lineInput)
  .handler(async ({ data }) => {
    await requireUser()

    const today = localDateString(new Date())

    const [row] = await db
      .insert(logEntries)
      .values({ date: today, kind: 'journal', body: data.text })
      .onConflictDoUpdate({
        target: logEntries.date,
        targetWhere: sql`${logEntries.kind} = 'journal'`,
        set: {
          body: sql`coalesce(${logEntries.body} || E'\n', '') || ${data.text}`,
        },
      })
      .returning({ id: logEntries.id })

    return row
  })

const entryInput = z.object({
  id: z.number().int().positive(),
  title: z.string().max(200).nullable(),
  body: z.string().max(100_000).nullable(),
})

export const updateLogEntry = createServerFn({ method: 'POST' })
  .validator(entryInput)
  .handler(async ({ data }) => {
    await requireUser()
    const trim = (value: string | null) => value?.trim() || null

    await db
      .update(logEntries)
      .set({ title: trim(data.title), body: trim(data.body) })
      .where(eq(logEntries.id, data.id))

    return { id: data.id }
  })

export const deleteLogEntry = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await requireUser()
    await db.delete(logEntries).where(eq(logEntries.id, data.id))
  })
