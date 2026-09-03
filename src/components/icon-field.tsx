import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CourseIcon } from '#/components/course-icon'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { COURSE_ICON_GROUPS, iconLabel, searchIcons } from '#/lib/course-icon'
import { useMediaQuery } from '#/lib/use-media-query'
import { cn } from '#/lib/utils'

/**
 * Picks one of the hundred preset icons, or none at all.
 *
 * Grouped rather than one long grid, because a hundred glyphs with no headings
 * is a wall you scan rather than read. The search collapses the headings away
 * once you type, since a filtered set is short enough not to need them.
 *
 * On a phone the grid opens in place rather than in a popover. A scrolling
 * popover inside a drawer means two nested scroll containers and a portal that
 * sits outside the drawer, and on iOS the drawer cancels touch moves that do
 * not resolve to a scrollable element. Opening in place leaves one scroll
 * container, the drawer's own, and nothing to fight over.
 */
export function IconField({
  value,
  color,
  onChange,
}: {
  value: string | null
  /** The course colour, so the grid previews how the icon will actually look. */
  color: string
  onChange: (icon: string | null) => void
}) {
  const isDesktop = useMediaQuery('(min-width: 640px)')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const matches = useMemo(() => searchIcons(query), [query])
  const searching = query.trim().length > 0

  const groups = useMemo(
    () =>
      COURSE_ICON_GROUPS.map((group) => ({
        group,
        icons: matches.filter((icon) => icon.group === group),
      })).filter((section) => section.icons.length > 0),
    [matches],
  )

  // Held in a ref so `choose` never changes identity. Callers pass an inline
  // arrow, so a callback built from the prop directly would change on every
  // render and defeat the memo on the grid below.
  const latest = useRef(onChange)
  useEffect(() => {
    latest.current = onChange
  }, [onChange])

  const choose = useCallback((name: string | null) => {
    latest.current(name)
    setOpen(false)
    setQuery('')
  }, [])

  const search = (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="-translate-y-1/2 absolute top-1/2 left-2 size-4 text-muted-foreground"
      />
      <Input
        aria-label="Search icons"
        className="h-11 pl-8"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search icons"
        value={query}
      />
    </div>
  )

  // A hundred buttons, rebuilt only when something they show changes. The
  // course dialog re-renders on every keystroke in any of its fields, and
  // without this each one rebuilt the whole grid.
  const grid = useMemo(
    () => (
      <>
        {groups.length === 0 && (
          <p className="px-1 py-6 text-center text-muted-foreground text-sm">
            No icon matches “{query.trim()}”.
          </p>
        )}

        {groups.map((section) => (
          <div className="mb-2 last:mb-0" key={section.group}>
            {!searching && (
              <p className="px-1 pb-1 font-medium text-muted-foreground text-xs">
                {section.group}
              </p>
            )}
            <div className="grid grid-cols-6 gap-0.5">
              {section.icons.map((icon) => {
                const selected = value === icon.name
                return (
                  <button
                    aria-label={iconLabel(icon.name)}
                    aria-pressed={selected}
                    className={cn(
                      'flex size-11 items-center justify-center rounded-md outline-none',
                      'hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      selected && 'bg-accent ring-1 ring-foreground',
                    )}
                    key={icon.name}
                    onClick={() => choose(icon.name)}
                    title={iconLabel(icon.name)}
                    type="button"
                  >
                    <CourseIcon
                      className="size-5"
                      color={color}
                      name={icon.name}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </>
    ),
    [groups, searching, value, color, query, choose],
  )

  const trigger = (onClick?: () => void) => (
    <Button
      aria-expanded={open}
      className="min-h-11 gap-2 px-3"
      onClick={onClick}
      type="button"
      variant="outline"
    >
      {value ? (
        <>
          <CourseIcon color={color} name={value} />
          {iconLabel(value)}
        </>
      ) : (
        'Choose an icon'
      )}
    </Button>
  )

  const clear = value && (
    <Button
      className="min-h-11 gap-1 px-3 text-muted-foreground"
      onClick={() => choose(null)}
      size="sm"
      type="button"
      variant="ghost"
    >
      <X aria-hidden="true" className="size-4" />
      Clear
    </Button>
  )

  // On a phone the whole grid renders inline with no height cap, so the only
  // thing that scrolls is the drawer it sits in.
  if (!isDesktop) {
    return (
      <div className="space-y-2" data-vaul-no-drag>
        <div className="flex flex-wrap items-center gap-2">
          {trigger(() => setOpen(!open))}
          {clear}
        </div>

        {open && (
          <div className="space-y-2 rounded-md border border-border p-2">
            {search}
            {grid}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>{trigger()}</PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <div className="border-border border-b p-2">{search}</div>
          <div className="max-h-64 overflow-y-auto p-2">{grid}</div>
        </PopoverContent>
      </Popover>
      {clear}
    </div>
  )
}
