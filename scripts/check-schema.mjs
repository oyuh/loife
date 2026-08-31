/**
 * Applies the generated migrations to an in-process Postgres and asserts that
 * the constraints actually reject bad rows. Runs with no Docker and no Railway.
 *
 *   pnpm db:check
 */
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS_DIR = 'drizzle'

const files = (await readdir(MIGRATIONS_DIR))
  .filter((f) => f.endsWith('.sql'))
  .sort()
assert.ok(files.length > 0, 'no .sql migrations found, run pnpm db:generate')

const db = new PGlite()
for (const file of files) {
  const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
  for (const statement of sql.split('--> statement-breakpoint')) {
    if (statement.trim()) await db.exec(statement)
  }
}
console.log(`applied ${files.length} migration file(s)`)

const insert = async (sql, params = []) => (await db.query(sql, params)).rows[0]

const course = await insert(
  "insert into courses (name, code) values ('Systems', 'CS 2110') returning id",
)
const item = await insert(
  'insert into items (course_id, name) values ($1, $2) returning id',
  [course.id, 'Project 1'],
)
const logEntry = await insert(
  "insert into log_entries (date, kind) values ('2026-09-01', 'event') returning id",
)

const attach = (cols, vals) =>
  db.query(
    `insert into attachments (${cols}, key, filename, content_type, size)
     values (${vals}, gen_random_uuid()::text, 'f.pdf', 'application/pdf', 10)`,
  )

// One owner is the only shape allowed.
await attach('item_id', String(item.id))
await attach('log_entry_id', String(logEntry.id))
await assert.rejects(
  attach('item_id, log_entry_id', `${item.id}, ${logEntry.id}`),
  /attachment_has_exactly_one_owner/,
  'an attachment owned by both an item and a log entry must be rejected',
)
await assert.rejects(
  db.query(
    `insert into attachments (key, filename, content_type, size)
     values ('orphan', 'f.pdf', 'application/pdf', 10)`,
  ),
  /attachment_has_exactly_one_owner/,
  'an attachment owned by nothing must be rejected',
)
console.log('ok  attachments require exactly one owner')

// Object keys are unique, so a retry cannot point two rows at one R2 object.
await db.query(
  `insert into attachments (item_id, key, filename, content_type, size)
   values ($1, 'fixed-key', 'f.pdf', 'application/pdf', 10)`,
  [item.id],
)
await assert.rejects(
  db.query(
    `insert into attachments (item_id, key, filename, content_type, size)
     values ($1, 'fixed-key', 'g.pdf', 'application/pdf', 10)`,
    [item.id],
  ),
  /attachments_key_unique/,
  'a duplicate R2 key must be rejected',
)
console.log('ok  attachment keys are unique')

// The inline log appends to today's entry, so a day holds at most one journal.
await db.query("insert into log_entries (date, kind) values ('2026-09-02', 'journal')")
await assert.rejects(
  db.query("insert into log_entries (date, kind) values ('2026-09-02', 'journal')"),
  /one_journal_per_day/,
  'a second journal entry on one day must be rejected',
)
// Events are unconstrained, and they do not collide with that day's journal.
await db.query("insert into log_entries (date, kind) values ('2026-09-02', 'event')")
await db.query("insert into log_entries (date, kind) values ('2026-09-02', 'event')")
console.log('ok  one journal per day, many events per day')

// Deleting an item takes its attachments with it.
await db.query('delete from items where id = $1', [item.id])
const remaining = await db.query(
  'select count(*)::int as n from attachments where item_id = $1',
  [item.id],
)
assert.equal(remaining.rows[0].n, 0, 'item attachments must cascade on delete')
console.log('ok  attachments cascade when their item is deleted')

// Deleting a course keeps its items and orphans them, rather than losing work.
const survivor = await insert(
  'insert into items (course_id, name) values ($1, $2) returning id',
  [course.id, 'Survives the course'],
)
await db.query('delete from courses where id = $1', [course.id])
const orphan = await db.query('select course_id from items where id = $1', [
  survivor.id,
])
assert.equal(orphan.rows.length, 1, 'deleting a course must not delete its items')
assert.equal(orphan.rows[0].course_id, null, 'the item course_id must go null')
console.log('ok  deleting a course orphans its items instead of deleting them')

await db.close()
console.log('\nschema check passed')
