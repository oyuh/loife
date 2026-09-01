import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { ScheduleCalendar } from '#/components/schedule-calendar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { WeekStrip } from '#/components/week-strip'
import { coursesQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import type { ItemRow } from '#/server/items'

/**
 * The whole term on Today: every class, every due date, every finished thing.
 *
 * The courses page answers "what does CS 2340 have coming", one class at a
 * time. This answers "what does the month look like", which is the question
 * the Today page was already trying to answer with a flat list of buckets.
 *
 * The week is always on screen because it is the part you glance at. The month
 * is behind a disclosure, since a full grid above the list would push the
 * actual to do list off the top of a phone.
 */
export function TodayCalendar({ items }: { items: ItemRow[] }) {
  const [open, setOpen] = useState(false)
  const { data: courses = [] } = useQuery(coursesQuery)

  const active = courses.filter((course) => course.active)

  return (
    <div className="space-y-3">
      <WeekStrip courses={active} detailed items={items} />

      <Collapsible onOpenChange={setOpen} open={open}>
        <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 text-muted-foreground text-sm">
          {open ? (
            <ChevronDown aria-hidden="true" className="size-4" />
          ) : (
            <CalendarDays aria-hidden="true" className="size-4" />
          )}
          {open ? 'Hide the month' : 'Show the month'}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div
            className={cn(
              'mt-3 rounded-lg border border-border bg-card/40 p-3',
            )}
          >
            <ScheduleCalendar courses={active} items={items} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
