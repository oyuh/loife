Three fixes: the mobile nav, the log composer, and a context menu gap

The context menu sub trigger was missing gap-2, which the dropdown version
has, so the icon sat flush against Move to. Upstream inconsistency rather than
anything I wrote, but ours now matches: all four rows measure an 8px gap.

The composer was sticky, which only holds while its own container is on
screen, so it rode the bottom of the page content and drifted up whenever the
list was short. Fixed positioning instead, with insets that clear the phone
tab bar and its safe area on one side and the desktop rail on the other. It
now sits 11px above the nav and moves 0px on scroll.

The mobile nav marked its current tab with an underline under small grey text,
which is easy to miss. The active tab is a filled pill with full contrast text
now. Every tab is the same width too, since one double width item read as
lopsided rather than emphasised.
