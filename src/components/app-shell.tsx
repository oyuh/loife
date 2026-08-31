import { Link } from '@tanstack/react-router'
import { BookOpen, CalendarCheck, NotebookPen, Plus } from 'lucide-react'
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
}: {
  children: ReactNode
  onAddItem: () => void
}) {
  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card
                   pb-[env(safe-area-inset-bottom)]
                   md:static md:h-dvh md:w-56 md:shrink-0 md:flex-col md:gap-1
                   md:border-t-0 md:border-r md:p-3 md:pb-3"
      >
        <p className="hidden px-2 pb-4 pt-1 text-sm font-semibold tracking-tight md:block">
          loife
        </p>

        {TABS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === '/' }}
            activeProps={{ 'data-active': 'true', 'aria-current': 'page' }}
            className={TAB_CLASS}
          >
            <Icon className="size-5 md:size-4" aria-hidden="true" />
            <span className="group-data-[active=true]:underline group-data-[active=true]:underline-offset-4 md:no-underline">
              {label}
            </span>
          </Link>
        ))}

        <button type="button" onClick={onAddItem} className={TAB_CLASS}>
          <Plus className="size-5 md:size-4" aria-hidden="true" />
          <span>Add</span>
        </button>

        <form
          method="post"
          action="/api/auth/logout"
          className="mt-auto hidden md:block"
        >
          <button
            type="submit"
            className="min-h-11 px-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Sign out
          </button>
        </form>
      </nav>

      {/* Bottom padding clears the fixed nav on phones. */}
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
    </div>
  )
}
