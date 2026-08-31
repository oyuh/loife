# loife UI plan

Every screen in loife mapped to a specific kibo-ui component or pattern. See [PLAN.md](./PLAN.md) for the architecture and phases.

## What I had wrong

Phases 1 to 4 shipped on shadcn base components plus native inputs, and pulled nothing from kibo. This document corrects that.

Two components do not do what their names suggest, so they are not used below:

- `status` displays **service uptime**, not task status. `pill` covers item state instead.
- `relative-time` is a **multi-timezone clock**, not "due in 2 days". A small formatter covers that.

## Installing

Components come from the registry:

```bash
npx shadcn@latest add https://www.kibo-ui.com/r/list.json
```

Patterns are not in the registry, so they are copy-paste source from `packages/patterns/<group>/<variant>/` in [shadcnblocks/kibo](https://github.com/shadcnblocks/kibo), or from the site. Each group ships several numbered variants and we pick one.

## Today view

| Need | Source | Notes |
|---|---|---|
| Grouped task list | `list` component | Its own description is "tasks grouped by status and ranked by priority", which is this screen exactly |
| Row layout | `item/layout` pattern | Replaces the hand-rolled `<li>` |
| Priority and type chips | `pill` component | Replaces the plain `High` span |
| Overdue count | `badge/destructive` pattern | Currently coloured text |
| Empty state | `empty/data` pattern | Replaces the hand-rolled dashed box |
| Loading | `skeleton/list` pattern | Nothing today, needed for the sized-skeleton rule |
| Confirm a delete | `alert-dialog/destructive` pattern | Phase where delete lands |

## Add assignment dialog

| Need | Source | Notes |
|---|---|---|
| Shell on desktop | `dialog/standard` pattern | 17 variants to pick from |
| Shell on mobile | `drawer/bottom` pattern | A bottom sheet beats a centred dialog with the keyboard open |
| Field layout | `field/basic-inputs`, `field/selects` | Replaces my hand-rolled `Field` render prop |
| Whole-form layout | `form/multi-field` pattern | |
| Course picker | `combobox/rich-content` pattern | Rich content lets the row carry the course colour |
| Type and priority | `choicebox` component | Card-style radio, bigger tap targets than a select |
| Due date and time | `date-picker/standard` variant 4 | The only one of the eight that handles time |
| Near-term dates | `mini-calendar` component | Built for "picking dates close to today", which is most due dates |
| Notes | `textarea/labeled` pattern | |
| Location | `input/standard` pattern | |
| Save feedback | `sonner/promise` pattern | Replaces the plain success toast |

## Command palette

| Need | Source | Notes |
|---|---|---|
| The palette | `command/dialog` pattern | The component you named. 7 variants |
| Shortcut hint | `kbd/shortcut` pattern | Renders ⌘K properly per platform |
| Inline autocomplete | `combobox` component | Its description covers both autocomplete and palette use |

## Courses

| Need | Source | Notes |
|---|---|---|
| Course cards | `item/media` pattern | Colour swatch, code, meeting time |
| Course colour | `color-picker` component | For the add-class modal |
| Meeting days | `toggle-group/standard` pattern | Mon through Sun as toggle chips |
| Term start and end | `date-picker/standard` pattern | |
| Course detail sections | `tabs/standard` pattern | Items, meetings, notes |
| Labels | `tags` component | |

## Journal

| Need | Source | Notes |
|---|---|---|
| Entry body | `editor` component | Rich text, replacing a plain textarea |
| Day list | `list` component | |
| Writing streak | `contribution-graph` component | A calendar heatmap of days logged |
| Jump to a date | `mini-calendar` component | |

## Attachments, phase 9

| Need | Source | Notes |
|---|---|---|
| Upload | `dropzone` component | Drag and drop into an item or a journal day |
| Upload progress | `progress/with-label` pattern | |
| File rows | `item/media` pattern | Thumbnail, name, size |
| Image preview | `image-zoom` component | |

## Calendar views, v2

| Need | Source | Notes |
|---|---|---|
| Month grid | `calendar` component | Groups items by day and shows end dates |
| Semester timeline | `gantt` component | Assignments across a term |
| Status board | `kanban` component | Todo, doing, done |
| Course timetable | `calendar` component | Recurring meetings |

## Two gaps I could not fill

**1. The mobile bottom tab bar.** Kibo has `drawer/bottom`, `sheet/navigation`, `navigation-menu/*`, and `tabs/*`, but nothing that is a fixed bottom tab bar with icons. The current one is hand-rolled and becomes a left rail at `md`. Options:

- Keep the hand-rolled nav, since it works and matches the flat dark direction
- Restyle it on `tabs/standard`
- Something in kibo I missed

**2. Item status display.** `status` is for service uptime, so `pill` is my substitute for todo, doing, and done. Say if you would rather use `choicebox` or `toggle-group` for setting status inline on a row.

## Order of work

Pulling these in wholesale would rewrite four working phases at once, so:

1. **Today view first**, since `list` plus `item` plus `pill` plus `empty` replaces the most hand-rolled markup and is the screen you look at daily
2. **Add dialog second**, swapping in `combobox`, `choicebox`, `date-picker`, and the `drawer/bottom` shell on mobile
3. **Palette third**, moving to `command/dialog`
4. **Everything else** lands with the phase that needs it, rather than up front

Phases 5 onward use these from the start, so nothing there gets built twice.
