/**
 * Fills a development database with a plausible week so the Today view has
 * something to render. Refuses to run against anything but localhost.
 *
 *   pnpm db:seed
 */
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  throw new Error('refusing to seed a database that is not on localhost')
}

const sql = postgres(url)
const day = (offset, hour = 23, minute = 59) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(hour, minute, 0, 0)
  return d
}

/** A term running either side of today, as `2026-09-15`. */
const dateOnly = (offsetDays) => day(offsetDays).toISOString().slice(0, 10)
const termStart = dateOnly(-45)
const termEnd = dateOnly(75)

try {
  await sql`truncate attachments, log_entries, items, courses restart identity cascade`

  // Term dates and an instructor on every row, so a seeded database exercises
  // the courses calendar and the mailto link rather than leaving both blank.
  // Two courses share an instructor, which is what the instructor combobox is
  // for.
  const [databases, algebra, writing] = await sql`
    insert into courses (
      name, code, color, term, days, start_time, end_time, location,
      term_start, term_end, instructor, instructor_email
    )
    values
      ('Intro to Databases', 'CS 210', '#3b82f6', 'Sample Term', '{1,3,5}', '10:00', '10:50', 'Science Hall 210',
       ${termStart}, ${termEnd}, 'Dr oyuh', 'oyuh@example.edu'),
      ('Linear Algebra', 'MATH 220', '#22c55e', 'Sample Term', '{2,4}', '13:00', '14:15', 'Math Building 104',
       ${termStart}, ${termEnd}, 'Dr Bell', 'bell@example.edu'),
      ('Technical Writing', 'ENGL 150', '#a855f7', 'Sample Term', '{2,4}', '16:00', '17:15', 'Library 318',
       ${termStart}, ${termEnd}, 'Dr oyuh', 'oyuh@example.edu')
    returning id`

  await sql`
    insert into items (course_id, name, type, due_at, all_day, priority, status, location)
    values
      (${databases.id}, 'Lab 2: schema design', 'assignment', ${day(-2)}, true, 2, 'todo', null),
      (${algebra.id}, 'Problem set 6', 'assignment', ${day(-1)}, true, 3, 'todo', null),
      (${databases.id}, 'Reading: indexes and query plans', 'reading', ${day(0, 9, 0)}, false, 4, 'todo', null),
      (${writing.id}, 'Draft of report 2', 'assignment', ${day(0, 23, 59)}, true, 2, 'todo', null),
      (${algebra.id}, 'Quiz 4', 'exam', ${day(0, 13, 0)}, false, 3, 'done', 'Math Building 104'),
      (${writing.id}, 'Peer review response', 'task', ${day(1)}, true, 3, 'todo', null),
      (${algebra.id}, 'Midterm 2', 'exam', ${day(4, 13, 0)}, false, 2, 'todo', 'Math Building 104'),
      (${databases.id}, 'Lab 3 proposal', 'assignment', ${day(6)}, true, 3, 'todo', null),
      (${databases.id}, 'Final project', 'assignment', ${day(30)}, true, 3, 'todo', null),
      (null, 'Renew library card', 'task', null, true, 4, 'todo', null)`

  const dayOf = (offset) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  await sql`
    insert into log_entries (date, kind, title, body, course_id)
    values
      (${dayOf(0)}, 'journal', null, ${'Finished the schema diagram for lab 2.' + String.fromCharCode(10) + 'Started reading about index types.'}, ${databases.id}),
      (${dayOf(-1)}, 'journal', null, ${'Quiz went fine. The reading was heavier than expected.'}, null),
      (${dayOf(-3)}, 'journal', 'Catch-up day', ${'Reworked the problem set from scratch. Much clearer the second time.'}, ${algebra.id}),
      (${dayOf(-3)}, 'event', 'Advising appointment', ${'Registered for next term. One elective still to pick.'}, null),
      (${dayOf(-9)}, 'journal', null, ${'Long library session. The lab 2 skeleton is done.'}, ${databases.id})`

  const counts = await sql`
    select (select count(*) from courses) as courses,
           (select count(*) from items) as items,
           (select count(*) from log_entries) as entries`
  console.log(
    `seeded ${counts[0].courses} courses, ${counts[0].items} items, ${counts[0].entries} journal entries`,
  )
} finally {
  await sql.end()
}
