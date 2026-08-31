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

try {
  await sql`truncate attachments, log_entries, items, courses restart identity cascade`

  const [systems, calc, writing] = await sql`
    insert into courses (name, code, color, term, days, start_time, end_time, location)
    values
      ('Computer Systems', 'CS 2340', '#3b82f6', 'Fall 2026', '{1,3,5}', '10:00', '10:50', 'ECSS 2.410'),
      ('Calculus II', 'MATH 2414', '#22c55e', 'Fall 2026', '{2,4}', '13:00', '14:15', 'FN 2.102'),
      ('Rhetoric', 'RHET 1302', '#a855f7', 'Fall 2026', '{2,4}', '16:00', '17:15', 'JO 3.516')
    returning id`

  await sql`
    insert into items (course_id, name, type, due_at, all_day, priority, status, location)
    values
      (${systems.id}, 'Project 2: shell', 'assignment', ${day(-2)}, true, 2, 'todo', null),
      (${calc.id}, 'Problem set 6', 'assignment', ${day(-1)}, true, 3, 'todo', null),
      (${systems.id}, 'Reading: pipes and forks', 'reading', ${day(0, 9, 0)}, false, 4, 'todo', null),
      (${writing.id}, 'Draft of essay 2', 'assignment', ${day(0, 23, 59)}, true, 2, 'todo', null),
      (${calc.id}, 'Quiz 4', 'exam', ${day(0, 13, 0)}, false, 3, 'done', 'FN 2.102'),
      (${writing.id}, 'Peer review response', 'task', ${day(1)}, true, 3, 'todo', null),
      (${calc.id}, 'Midterm 2', 'exam', ${day(4, 13, 0)}, false, 2, 'todo', 'FN 2.102'),
      (${systems.id}, 'Project 3 proposal', 'assignment', ${day(6)}, true, 3, 'todo', null),
      (${systems.id}, 'Final project', 'assignment', ${day(30)}, true, 3, 'todo', null),
      (null, 'Renew parking permit', 'task', null, true, 4, 'todo', null)`

  const dayOf = (offset) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  await sql`
    insert into log_entries (date, kind, title, body, course_id)
    values
      (${dayOf(0)}, 'journal', null, ${'Office hours for the shell project, finally understood fork.' + String.fromCharCode(10) + 'Started the essay outline.'}, ${systems.id}),
      (${dayOf(-1)}, 'journal', null, ${'Quiz went fine. Reading was heavier than expected.'}, null),
      (${dayOf(-3)}, 'journal', 'Rough one', ${'Slept through the alarm and missed the first half of calc. Got notes from Priya.'}, ${calc.id}),
      (${dayOf(-3)}, 'event', 'Advising appointment', ${'Registered for spring. Need one more elective.'}, null),
      (${dayOf(-9)}, 'journal', null, ${'Long library session. Project 2 skeleton is done.'}, ${systems.id})`

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
