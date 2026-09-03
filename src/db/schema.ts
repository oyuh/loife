import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const itemType = pgEnum('item_type', [
  'assignment',
  'exam',
  'task',
  'reading',
])
export const itemStatus = pgEnum('item_status', ['todo', 'doing', 'done'])
export const logKind = pgEnum('log_kind', ['journal', 'event'])
export const itemEventKind = pgEnum('item_event_kind', [
  'created',
  'completed',
  'reopened',
  'moved',
  'edited',
])

/** Timestamps every synced table carries, so the reconcile sweep can compare them. */
const syncTimestamps = {
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
}

export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code'),
  // A hex string. Drawn as-is in the app, and mapped to the nearest of Google
  // Calendar's eleven event colours on the way out, which is what reaches
  // Notion Calendar. See lib/google-color.ts.
  color: text('color'),
  // A lucide export name from lib/course-icon.ts, drawn beside the course
  // wherever it appears. Null means fall back to the colour bar alone.
  icon: text('icon'),
  term: text('term'),
  // Bounds the RRULE on the recurring Google Calendar event.
  termStart: date('term_start'),
  termEnd: date('term_end'),
  // 0 is Sunday through 6 is Saturday, matching Date.getDay().
  days: smallint('days').array(),
  startTime: time('start_time'),
  endTime: time('end_time'),
  // 1 is weekly, 2 is every other week, and so on. Labs are rarely weekly.
  meetingInterval: smallint('meeting_interval').notNull().default(1),
  // One-off meetings that follow no pattern, added on top of the weekly rule
  // or used on their own when a course has no pattern at all.
  meetingDates: date('meeting_dates').array(),
  location: text('location'),
  // Who teaches it, and where to reach them. Two columns rather than one
  // "instructor" string, because the email is the part you actually act on and
  // parsing it back out of "Dr oyuh <oyuh@example.edu>" is a job nobody wants.
  instructor: text('instructor'),
  instructorEmail: text('instructor_email'),
  notes: text('notes'),
  active: boolean('active').notNull().default(true),
  googleEventId: text('google_event_id'),
  ...syncTimestamps,
})

/** Assignments, exams, tasks, and readings, so the Today view runs one query. */
export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  // Null for personal tasks that belong to no course.
  courseId: integer('course_id').references(() => courses.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  type: itemType('type').notNull().default('assignment'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  // True when you gave a date with no time, which becomes an all-day event.
  allDay: boolean('all_day').notNull().default(false),
  // 1 is most urgent through 5 is least. A number sorts and blends with days
  // remaining in a way three named levels cannot.
  priority: smallint('priority').notNull().default(3),
  status: itemStatus('status').notNull().default('todo'),
  // When it was ticked, so the row can say so and linger before hiding.
  completedAt: timestamp('completed_at', { withTimezone: true }),
  // How long you think it takes, which is what the planner schedules against.
  estimatedMinutes: smallint('estimated_minutes'),
  // How long it actually took, recorded on completion. Kept separate so the
  // estimate stays honest rather than being overwritten by the outcome.
  actualMinutes: smallint('actual_minutes'),
  // Total preparation this needs before the due date, as opposed to how long
  // the thing itself takes. An exam is two hours; revising for it is ten.
  studyMinutes: smallint('study_minutes'),
  location: text('location'),
  notes: text('notes'),
  googleEventId: text('google_event_id'),
  ...syncTimestamps,
})

export const logEntries = pgTable(
  'log_entries',
  {
    id: serial('id').primaryKey(),
    date: date('date').notNull(),
    kind: logKind('kind').notNull().default('journal'),
    title: text('title'),
    // No length cap, unlike a Notion rich text property.
    body: text('body'),
    courseId: integer('course_id').references(() => courses.id, {
      onDelete: 'set null',
    }),
    location: text('location'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // The inline log appends to today's entry or creates it. Enforcing one
    // journal row per day here means two fast taps cannot race into two rows.
    // Events are unconstrained, since you can log many in a day.
    uniqueIndex('one_journal_per_day')
      .on(t.date)
      .where(sql`${t.kind} = 'journal'`),
  ],
)

/**
 * What happened to an item and when.
 *
 * Append only. The row itself holds the current state, this holds how it got
 * there, which is what makes "ticked at 9:14, moved twice before that" answerable.
 */
export const itemEvents = pgTable('item_events', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id')
    .notNull()
    .references(() => items.id, { onDelete: 'cascade' }),
  kind: itemEventKind('kind').notNull(),
  /** A short human sentence, such as "moved to Oct 3". */
  detail: text('detail'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * A stretch of time actually spent preparing.
 *
 * Separate from the item so a single exam can accumulate many sessions, and so
 * study that belongs to no particular item still has somewhere to go.
 */
export const studySessions = pgTable('study_sessions', {
  id: serial('id').primaryKey(),
  itemId: integer('item_id').references(() => items.id, {
    onDelete: 'cascade',
  }),
  /** What it was for, when it belongs to no item. */
  subject: text('subject'),
  plannedMinutes: smallint('planned_minutes'),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Null while a session is still running. */
  endedAt: timestamp('ended_at', { withTimezone: true }),
  /** Written when the session ends, so history does not recompute it. */
  actualMinutes: smallint('actual_minutes'),
})

export const attachments = pgTable(
  'attachments',
  {
    id: serial('id').primaryKey(),
    itemId: integer('item_id').references(() => items.id, {
      onDelete: 'cascade',
    }),
    logEntryId: integer('log_entry_id').references(() => logEntries.id, {
      onDelete: 'cascade',
    }),
    // R2 object key, a UUID. Unique so a retry cannot point two rows at one object.
    key: text('key').notNull().unique(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Exactly one owner. `<>` on two booleans is XOR in Postgres.
    check(
      'attachment_has_exactly_one_owner',
      sql`(${t.itemId} IS NULL) <> (${t.logEntryId} IS NULL)`,
    ),
  ],
)

// ponytail: no secondary indexes yet. A single user generates hundreds of rows,
// which Postgres scans in well under a millisecond. Add an index on
// items(due_at) and items(course_id) when the Today query shows up slow.

export type Course = typeof courses.$inferSelect
export type NewCourse = typeof courses.$inferInsert
export type Item = typeof items.$inferSelect
export type NewItem = typeof items.$inferInsert
export type LogEntry = typeof logEntries.$inferSelect
export type NewLogEntry = typeof logEntries.$inferInsert
export type ItemEvent = typeof itemEvents.$inferSelect
export type StudySession = typeof studySessions.$inferSelect
export type Attachment = typeof attachments.$inferSelect
export type NewAttachment = typeof attachments.$inferInsert

/**
 * One row, holding the Google grant. There is one user, so this is a place to
 * keep a refresh token rather than a real settings system. The CHECK keeps it
 * to a single row so nothing has to guess which one is current.
 */
export const settings = pgTable(
  'settings',
  {
    id: integer('id').primaryKey().default(1),
    googleRefreshToken: text('google_refresh_token'),
    googleCalendarId: text('google_calendar_id'),
    // Null means work it out from priority. A number is a fixed override in
    // minutes, so a mis-tap has however long you want to catch it.
    hideCompletedAfterMinutes: smallint('hide_completed_after_minutes'),
    // The window the planner is allowed to fill, as local `HH:MM`.
    dayStart: time('day_start').notNull().default('09:00'),
    dayEnd: time('day_end').notNull().default('22:00'),
    // Minutes of breathing room left between scheduled blocks.
    breakMinutes: smallint('break_minutes').notNull().default(10),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check('settings_is_a_single_row', sql`${t.id} = 1`)],
)

export type Settings = typeof settings.$inferSelect
