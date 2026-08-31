Completion times, history, a grace period before hiding, and a usable swipe

Ticking a row now records when. The row says "done 11:56 AM" and the detail
sheet leads with the full stamp, so a finished thing shows it rather than only
implying it. Reopening clears the time so the grace period restarts instead of
measuring from a completion that was undone.

item_events records what happened and when, append only: created, completed,
reopened, moved. The row holds current state, this holds how it got there. The
detail sheet lists it newest first.

Finished work no longer vanishes on the tap. Ticking is one gesture and easy to
hit by accident, so a row lingers before dropping off, longest for the work
that matters most:

  P1  2 hours      P2  1 hour      P3  30 minutes
  P4  15 minutes   P5  10 minutes

A preference on the Courses page overrides that with a fixed delay, zero
included, which means hide at once. Rows ticked before this existed have no
recorded time and fall back to the old rule of staying only on their due day,
which is tested alongside the rest.

The swipe menu was unusable. Three labelled buttons needed 176px, which on a
375px screen clipped Delete against the right edge and pushed the row's own
text off the left. They are icons now at 52px each, and all three sit inside
the viewport with the row title still readable at x=21. Measured, not guessed.
