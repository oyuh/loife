Day planner, history page, time estimates, and a settings home

The journal date picker looked broken because it worked. A picked day was
sorted into the list, so a past date landed hundreds of pixels down with no
feedback. Picking a date now shows that one day, with a way back.

The grace period preference was on the Courses page, which is not where anyone
would look. There is a Settings route now, in the sidebar and the palette, and
it holds the calendar state, the hide delay, and the hours to plan into.

A History route lists everything ever added, newest finished first, filterable
with the same syntax as search, with estimate against actual on each row and a
recent activity feed underneath.

Items carry an estimate and an actual. The estimate is what the planner
schedules against, the actual is recorded on completion, and they stay separate
so the estimate is not overwritten by the outcome and can be judged against it.

lib/plan-day.ts suggests when to do things: it takes the hours you allow,
subtracts today's classes, and lays the most urgent work into what is left.
Pure, and twelve cases cover it. Three worth naming.

Overlapping commitments merge before the gaps are worked out, since two
overlapping events would otherwise each carve their own hole and leave a
phantom gap between them that nothing could use.

Each window keeps its own cursor, so a two hour task that does not fit a one
hour gap takes a later window rather than blocking everything behind it.

And a bug the tests caught: past the end of the working window the code fell
back to the window start, so at six in the evening it cheerfully proposed nine
in the morning.

Work without an estimate is listed as unschedulable rather than given an
invented duration. The plan writes nothing, moves no due dates, and touches no
calendar.
