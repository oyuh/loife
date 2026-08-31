import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db'
import { itemEvents, items, studySessions } from '#/db/schema'
import { requireUser } from '#/lib/session.server'

/** The session still running, if there is one. Only ever one at a time. */
export const currentSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireUser()
    const [row] = await db
      .select({
        id: studySessions.id,
        itemId: studySessions.itemId,
        subject: studySessions.subject,
        plannedMinutes: studySessions.plannedMinutes,
        startedAt: studySessions.startedAt,
        itemName: items.name,
      })
      .from(studySessions)
      .leftJoin(items, eq(studySessions.itemId, items.id))
      .where(isNull(studySessions.endedAt))
      .orderBy(desc(studySessions.startedAt))
      .limit(1)

    return row ?? null
  },
)

export const startSession = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      itemId: z.number().int().positive().nullable(),
      subject: z.string().trim().max(200).nullable(),
      plannedMinutes: z.number().int().min(1).max(600).nullable(),
    }),
  )
  .handler(async ({ data }) => {
    await requireUser()

    // Starting a second session would make both times wrong, so the running
    // one is closed first rather than left dangling.
    await closeRunning()

    const [row] = await db
      .insert(studySessions)
      .values(data)
      .returning({ id: studySessions.id })

    return row
  })

async function closeRunning() {
  const running = await db
    .select({ id: studySessions.id, startedAt: studySessions.startedAt })
    .from(studySessions)
    .where(isNull(studySessions.endedAt))

  for (const session of running) {
    const now = new Date()
    await db
      .update(studySessions)
      .set({
        endedAt: now,
        // Rounded up, so a nine minute sitting is not recorded as zero.
        actualMinutes: Math.max(
          1,
          Math.ceil((+now - +session.startedAt) / 60_000),
        ),
      })
      .where(eq(studySessions.id, session.id))
  }
}

export const stopSession = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireUser()

    const [running] = await db
      .select()
      .from(studySessions)
      .where(isNull(studySessions.endedAt))
      .orderBy(desc(studySessions.startedAt))
      .limit(1)

    if (!running) return { minutes: 0 }

    const now = new Date()
    const minutes = Math.max(1, Math.ceil((+now - +running.startedAt) / 60_000))

    await db
      .update(studySessions)
      .set({ endedAt: now, actualMinutes: minutes })
      .where(eq(studySessions.id, running.id))

    if (running.itemId) {
      await db.insert(itemEvents).values({
        itemId: running.itemId,
        kind: 'edited',
        detail: `studied ${minutes} min`,
      })
    }

    return { minutes }
  },
)

/** Minutes already put in per item, so the planner can subtract them. */
export const studiedByItem = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireUser()
    const rows = await db
      .select({
        itemId: studySessions.itemId,
        minutes: sql<number>`coalesce(sum(${studySessions.actualMinutes}), 0)::int`,
      })
      .from(studySessions)
      .where(
        and(
          sql`${studySessions.itemId} is not null`,
          sql`${studySessions.actualMinutes} is not null`,
        ),
      )
      .groupBy(studySessions.itemId)

    return Object.fromEntries(
      rows.map((row) => [row.itemId as number, row.minutes]),
    )
  },
)

export const listSessions = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireUser()
    return db
      .select({
        id: studySessions.id,
        subject: studySessions.subject,
        plannedMinutes: studySessions.plannedMinutes,
        actualMinutes: studySessions.actualMinutes,
        startedAt: studySessions.startedAt,
        endedAt: studySessions.endedAt,
        itemName: items.name,
      })
      .from(studySessions)
      .leftJoin(items, eq(studySessions.itemId, items.id))
      .orderBy(desc(studySessions.startedAt))
      .limit(50)
  },
)
