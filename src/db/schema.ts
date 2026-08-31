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
export const itemPriority = pgEnum('item_priority', ['low', 'normal', 'high'])
export const itemStatus = pgEnum('item_status', ['todo', 'doing', 'done'])
export const logKind = pgEnum('log_kind', ['journal', 'event'])

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
  color: text('color'),
  term: text('term'),
  // Bounds the RRULE on the recurring Google Calendar event.
  termStart: date('term_start'),
  termEnd: date('term_end'),
  // 0 is Sunday through 6 is Saturday, matching Date.getDay().
  days: smallint('days').array(),
  startTime: time('start_time'),
  endTime: time('end_time'),
  location: text('location'),
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
  priority: itemPriority('priority').notNull().default('normal'),
  status: itemStatus('status').notNull().default('todo'),
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
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check('settings_is_a_single_row', sql`${t.id} = 1`)],
)

export type Settings = typeof settings.$inferSelect
