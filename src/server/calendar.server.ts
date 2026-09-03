import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '#/db'
import { courses, items } from '#/db/schema'
import { toCalendarEvent } from '#/lib/calendar-event'
import { toCourseEvent } from '#/lib/course-event'
import {
  deleteEvent,
  insertEvent,
  loadSettings,
  updateEvent,
} from '#/lib/google.server'

const timeZone = () => process.env.TZ ?? 'America/Chicago'

/**
 * Pushes one item to Google Calendar. The database is the source of truth and
 * the calendar is a rendering of it, so this only ever goes one direction.
 *
 * Never throws. A calendar outage must not fail the write that triggered it,
 * and `syncedAt` staying behind `updatedAt` is what lets the sweep retry.
 */
export async function syncItem(itemId: number): Promise<void> {
  try {
    const [row] = await db
      .select({
        id: items.id,
        name: items.name,
        type: items.type,
        priority: items.priority,
        dueAt: items.dueAt,
        allDay: items.allDay,
        location: items.location,
        notes: items.notes,
        status: items.status,
        googleEventId: items.googleEventId,
        courseCode: courses.code,
        courseName: courses.name,
        courseColor: courses.color,
      })
      .from(items)
      .leftJoin(courses, eq(items.courseId, courses.id))
      .where(eq(items.id, itemId))

    if (!row) return

    const settings = await loadSettings()
    if (!settings?.googleRefreshToken) return

    const event = toCalendarEvent(row, {
      courseLabel: row.courseCode ?? row.courseName,
      courseColor: row.courseColor,
      timeZone: timeZone(),
    })

    // No due date means nothing belongs on the calendar. If an event was
    // already there, it has to come off.
    if (!event) {
      if (row.googleEventId) {
        await deleteEvent(row.googleEventId)
        await db
          .update(items)
          .set({ googleEventId: null, syncedAt: new Date() })
          .where(eq(items.id, itemId))
      }
      return
    }

    if (row.googleEventId) {
      const replaced = await updateEvent(row.googleEventId, event)
      if (replaced) {
        await markSynced(itemId, row.googleEventId)
        return
      }
      // Google no longer has it, so fall through and insert a fresh one.
    }

    const eventId = await insertEvent(event)
    await markSynced(itemId, eventId)
  } catch (error) {
    console.error(`calendar sync failed for item ${itemId}:`, error)
  }
}

async function markSynced(itemId: number, eventId: string) {
  // syncedAt is set from the row's own updatedAt rather than now(), so an edit
  // that lands mid-sync is not mistaken for already pushed.
  await db
    .update(items)
    .set({ googleEventId: eventId, syncedAt: sql`${items.updatedAt}` })
    .where(eq(items.id, itemId))
}

/**
 * Re-pushes every dated item on a course, because something about the course
 * itself changed the events its items produce.
 *
 * Only the colour does that today. An item's event carries its course's
 * colour, and editing the course leaves the items' own rows untouched, so
 * without this a recoloured course would keep pushing the old colour to Notion
 * until each item happened to be edited for some other reason.
 *
 * Clearing `syncedAt` first is what makes a failure recoverable: the row is
 * marked as owing a push before the push is attempted, so the reconcile sweep
 * picks up whatever Google refused.
 */
export async function syncCourseItems(courseId: number): Promise<void> {
  try {
    const rows = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.courseId, courseId), isNotNull(items.dueAt)))

    if (rows.length === 0) return

    await db
      .update(items)
      .set({ syncedAt: null })
      .where(and(eq(items.courseId, courseId), isNotNull(items.dueAt)))

    for (const row of rows) await syncItem(row.id)
  } catch (error) {
    console.error(`calendar resync failed for course ${courseId}:`, error)
  }
}

export async function removeItemEvent(eventId: string | null): Promise<void> {
  if (!eventId) return
  try {
    await deleteEvent(eventId)
  } catch (error) {
    console.error('calendar delete failed:', error)
  }
}

/**
 * Pushes a course's recurring meeting event. One event per course, bounded by
 * the term, rather than one per week.
 *
 * Never throws, for the same reason syncItem does not: a calendar problem must
 * not fail the write that triggered it.
 */
export async function syncCourse(courseId: number): Promise<void> {
  try {
    const [row] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))

    if (!row) return

    const settings = await loadSettings()
    if (!settings?.googleRefreshToken) return

    const event = row.active ? toCourseEvent(row, timeZone()) : null

    // An inactive course, or one with no meeting pattern, belongs on no
    // calendar. If it had an event, take it off.
    if (!event) {
      if (row.googleEventId) {
        await deleteEvent(row.googleEventId)
        await db
          .update(courses)
          .set({ googleEventId: null, syncedAt: new Date() })
          .where(eq(courses.id, courseId))
      }
      return
    }

    if (row.googleEventId) {
      const replaced = await updateEvent(row.googleEventId, event)
      if (replaced) {
        await markCourseSynced(courseId, row.googleEventId)
        return
      }
    }

    const eventId = await insertEvent(event)
    await markCourseSynced(courseId, eventId)
  } catch (error) {
    console.error(`calendar sync failed for course ${courseId}:`, error)
  }
}

async function markCourseSynced(courseId: number, eventId: string) {
  await db
    .update(courses)
    .set({ googleEventId: eventId, syncedAt: sql`${courses.updatedAt}` })
    .where(eq(courses.id, courseId))
}
