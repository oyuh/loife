import { Link } from '@tanstack/react-router'
import {
  BookOpen,
  CalendarCheck,
  NotebookPen,
  Plus,
  Search,
} from 'lucide-react'
import type { ReactNode } from 'react'

const TABS = [
  { to: '/', label: 'Today', icon: CalendarCheck },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/journal', label: 'Journal', icon: NotebookPen },
] as const

const TAB_CLASS =
  'group flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs ' +
  'text-muted-foreground data-[active=true]:text-foreground ' +
  'md:min-h-11 md:flex-none md:flex-row md:justify-start md:gap-3 md:rounded-md ' +
  'md:px-2 md:text-sm md:hover:bg-accent'

/**
 * One nav element for both layouts. It sits along the bottom on a phone and
 * becomes a left rail from `md` up, so there is no duplicated markup and no
 * second set of links to keep in sync.
 */
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
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="Main"
        // pb-3 on top of the safe area inset. The inset alone leaves the row
        // flush against the home indicator, which is awkward to hit.
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card
                   pb-[calc(env(safe-area-inset-bottom)+0.75rem)]
                   md:static md:h-dvh md:w-56 md:shrink-0 md:flex-col md:gap-1
                   md:border-t-0 md:border-r md:p-3 md:pb-3"
      >
        <p className="hidden px-2 pb-4 pt-1 font-semibold text-sm tracking-tight md:block">
          loife
        </p>

        {TABS.map(({ to, label, icon: Icon }) => (
          <Link
            activeOptions={{ exact: to === '/' }}
            activeProps={{ 'data-active': 'true', 'aria-current': 'page' }}
            className={TAB_CLASS}
            key={to}
            to={to}
          >
            <Icon aria-hidden="true" className="size-5 md:size-4" />
            <span className="group-data-[active=true]:underline group-data-[active=true]:underline-offset-4 md:no-underline">
              {label}
            </span>
          </Link>
        ))}

        {/* Cmd K is keyboard only, so a phone needs its own way in. */}
        <button className={TAB_CLASS} onClick={onOpenPalette} type="button">
          <Search aria-hidden="true" className="size-5 md:size-4" />
          <span>Search</span>
        </button>

        <button className={TAB_CLASS} onClick={onAddItem} type="button">
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
      <main className="flex-1 pb-32 md:pb-0">{children}</main>
    </div>
  )
}
