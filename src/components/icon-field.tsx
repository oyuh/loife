import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CourseIcon } from '#/components/course-icon'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { COURSE_ICON_GROUPS, iconLabel, searchIcons } from '#/lib/course-icon'
import { cn } from '#/lib/utils'

/**
 * Picks one of the hundred preset icons, or none at all.
 *
 * Grouped rather than one long grid, because a hundred glyphs with no headings
 * is a wall you scan rather than read. The search collapses the headings away
 * once you type, since a filtered set is short enough not to need them.
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

  const choose = (name: string | null) => {
    onChange(name)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            className="min-h-11 gap-2 px-3"
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
        </PopoverTrigger>

        <PopoverContent align="start" className="w-72 p-0">
          <div className="relative border-border border-b p-2">
            <Search
              aria-hidden="true"
              className="-translate-y-1/2 absolute top-1/2 left-4 size-4 text-muted-foreground"
            />
            <Input
              aria-label="Search icons"
              className="h-9 pl-8"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search icons"
              value={query}
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
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
          </div>
        </PopoverContent>
      </Popover>

      {value && (
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
      )}
    </div>
  )
}
