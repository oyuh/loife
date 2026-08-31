Detail sheet, an add form for anything, future journal days, nav reorder

Tapping a Today row used to drop straight into a form. It now opens a detail
sheet: the notes rendered, the files viewable, and the three things worth
changing in a hurry, which are done, priority, and when. Edit is a button
inside it rather than the only way in.

The add form was assignment shaped and cluttered. It is Add anything now, with
To do first, and the layout is name, kind, when, priority. Course, place,
notes and files fold away, so the common case is four controls rather than
nine.

Files can be attached while adding. An attachment row needs an item id, which
a new item does not have yet, so the files are held and uploaded once the save
returns one.

The journal takes any date, ahead or behind, not only days that already exist.
A chosen day opens ready to type and is labelled Planned when it is in the
future.

Nav is Today, Search, Journal, Add, with Today on the left at twice the width.
Courses moved into the palette, since a term's classes are set up once and then
rarely touched.

Two fixes in the new code. A label wrapping a Radix Select associates with
nothing, because the trigger is a button, so the trigger carries its own name.
And staged files key on name, size and modified time, since two files can share
a name and a position shifts when one is removed.
