Calendar reminders, a status panel, and edits that cannot go stale

Events carried no reminders, so they inherited the default of a calendar
created through the API, which is nothing. Each now sets its own:

  class meeting     10 minutes before
  assignment        the morning before if all day, an hour if timed
  exam              the same, plus a day earlier again

Google measures an all-day reminder from midnight at the start of the day, so
900 minutes is 9am the morning before rather than fifteen hours before the
deadline. Overrides stay inside the cap of five.

Updates use PUT rather than PATCH. PATCH merges, so anything the body omitted
kept its old value: clearing a location, dropping a note, or turning a weekly
class into a single session would have left the stale version on the calendar.
A full replace makes the event equal what was computed, by construction. Six
tests cover the edits that would have gone stale, including a dropped weekly
pattern, which must send an empty recurrence rather than omitting the field.

server/calendar.ts split in two. Importing the status server function from a
component made the module client reachable, and its plain syncItem and
syncCourse exports kept the Google client alive all the way into the browser
bundle. The build caught it. Only createServerFn wrappers stay in calendar.ts,
with the rest in calendar.server.ts.

CalendarStatus on the Courses page shows whether the grant exists and offers a
manual push, since sync failures are logged rather than thrown and were
therefore invisible.

Course pickers show the name beside the code.
