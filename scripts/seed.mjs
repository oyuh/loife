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
      (${systems.id}, 'Project 2: shell', 'assignment', ${day(-2)}, true, 'high', 'todo', null),
      (${calc.id}, 'Problem set 6', 'assignment', ${day(-1)}, true, 'normal', 'todo', null),
      (${systems.id}, 'Reading: pipes and forks', 'reading', ${day(0, 9, 0)}, false, 'low', 'todo', null),
      (${writing.id}, 'Draft of essay 2', 'assignment', ${day(0, 23, 59)}, true, 'high', 'todo', null),
      (${calc.id}, 'Quiz 4', 'exam', ${day(0, 13, 0)}, false, 'normal', 'done', 'FN 2.102'),
      (${writing.id}, 'Peer review response', 'task', ${day(1)}, true, 'normal', 'todo', null),
      (${calc.id}, 'Midterm 2', 'exam', ${day(4, 13, 0)}, false, 'high', 'todo', 'FN 2.102'),
      (${systems.id}, 'Project 3 proposal', 'assignment', ${day(6)}, true, 'normal', 'todo', null),
      (${systems.id}, 'Final project', 'assignment', ${day(30)}, true, 'normal', 'todo', null),
      (null, 'Renew parking permit', 'task', null, true, 'low', 'todo', null)`

  const counts = await sql`
    select (select count(*) from courses) as courses, (select count(*) from items) as items`
  console.log(`seeded ${counts[0].courses} courses and ${counts[0].items} items`)
} finally {
  await sql.end()
}
