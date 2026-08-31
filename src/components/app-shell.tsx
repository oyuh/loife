import { Link } from '@tanstack/react-router'
import { CalendarCheck, NotebookPen, Plus, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

/**
 * Today is the reason the app exists, so it takes the left and twice the room.
 * Search sits next to it because it reaches everything else, including Courses,
 * which is rare enough not to earn a permanent slot.
 */
const TAB_CLASS =
  'group flex min-h-14 flex-col items-center justify-center gap-1 text-xs ' +
  'text-muted-foreground data-[active=true]:text-foreground ' +
  'md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-md ' +
  'md:px-2 md:text-sm md:hover:bg-accent'

export function AppShell({
  children,
  onAddItem,
  onOpenPalette,
}: {
  children: ReactNode
  onAddItem: () => void
  onOpenPalette: () => void
}) {
  return (
    <div className="min-h-dvh md:flex md:items-start">
      <nav
        aria-label="Main"
        // pb-3 on top of the safe area inset. The inset alone leaves the row
        // flush against the home indicator, which is awkward to hit.
        className="fixed inset-x-0 bottom-0 z-20 flex border-border border-t bg-card
                   pb-[calc(env(safe-area-inset-bottom)+0.75rem)]
                   md:sticky md:top-0 md:h-dvh md:w-56 md:shrink-0 md:flex-col md:gap-1
                   md:border-t-0 md:border-r md:p-3 md:pb-3"
      >
        <p className="hidden px-2 pt-1 pb-4 font-semibold text-sm tracking-tight md:block">
          loife
        </p>

        <Link
          activeOptions={{ exact: true }}
          activeProps={{ 'data-active': 'true', 'aria-current': 'page' }}
          className={cn(TAB_CLASS, 'flex-[2] md:flex-none')}
          to="/"
        >
          <CalendarCheck aria-hidden="true" className="size-6 md:size-4" />
          <span className="font-medium text-sm group-data-[active=true]:underline group-data-[active=true]:underline-offset-4 md:text-sm md:no-underline">
            Today
          </span>
        </Link>

        {/* Cmd K is keyboard only, so a phone needs its own way in. */}
        <button
          className={cn(TAB_CLASS, 'flex-1 md:flex-none')}
          onClick={onOpenPalette}
          type="button"
        >
          <Search aria-hidden="true" className="size-5 md:size-4" />
          <span>Search</span>
        </button>

        <Link
          activeProps={{ 'data-active': 'true', 'aria-current': 'page' }}
          className={cn(TAB_CLASS, 'flex-1 md:flex-none')}
          to="/journal"
        >
          <NotebookPen aria-hidden="true" className="size-5 md:size-4" />
          <span className="group-data-[active=true]:underline group-data-[active=true]:underline-offset-4 md:no-underline">
            Journal
          </span>
        </Link>

        <button
          className={cn(TAB_CLASS, 'flex-1 md:flex-none')}
          onClick={onAddItem}
          type="button"
        >
          <Plus aria-hidden="true" className="size-5 md:size-4" />
          <span>Add</span>
        </button>

        <form
          action="/api/auth/logout"
          className="mt-auto hidden md:block"
          method="post"
        >
          <button
            className="min-h-11 px-2 text-muted-foreground text-sm underline-offset-4 hover:underline"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </nav>

      {/* Clears the fixed nav plus its safe-area padding on phones. */}
      <main className="min-w-0 flex-1 pb-32 md:pb-0">{children}</main>
    </div>
  )
}
