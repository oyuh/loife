import { Link } from '@tanstack/react-router'
import {
  CalendarCheck,
  Command,
  History,
  NotebookPen,
  Plus,
  Settings,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Wordmark } from '#/components/wordmark'
import { cn } from '#/lib/utils'

/**
 * The active tab is a filled pill, not an underline.
 *
 * On a phone an underline under small grey text is easy to miss, so the current
 * tab gets a background and full contrast text while the others stay muted.
 * Every tab is the same width, because one double width item made the row look
 * lopsided rather than emphasised.
 */
const TAB =
  'group relative flex flex-1 flex-col items-center justify-center gap-1 ' +
  'rounded-lg py-2 text-muted-foreground text-xs transition-colors ' +
  'data-[active=true]:bg-accent data-[active=true]:text-foreground ' +
  'md:min-h-11 md:flex-none md:flex-row md:justify-start md:gap-3 md:px-3 ' +
  'md:py-2 md:text-sm md:hover:bg-accent/60'

const ICON = 'size-5 shrink-0 md:size-4'

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
        // The row sits above the home indicator rather than against it, and
        // gets its own padding so the pills are not flush to the screen edges.
        className="fixed inset-x-0 bottom-0 z-20 flex gap-1 border-border border-t
                   bg-card/95 px-2 pt-2 backdrop-blur
                   pb-[calc(env(safe-area-inset-bottom)+0.5rem)]
                   md:sticky md:top-0 md:h-dvh md:w-56 md:shrink-0 md:flex-col
                   md:gap-1 md:border-t-0 md:border-r md:bg-card md:p-3"
      >
        <Wordmark className="hidden px-3 pt-1 pb-4 text-base md:block" />

        <Link
          activeOptions={{ exact: true }}
          activeProps={{ 'data-active': 'true', 'aria-current': 'page' }}
          className={TAB}
          to="/"
        >
          <CalendarCheck aria-hidden="true" className={ICON} />
          <span>Today</span>
        </Link>

        {/* Cmd K is keyboard only, so a phone needs its own way in. The phone
            label is the short one, because two words wrap under a 90px tab and
            push the whole row taller. */}
        <button
          aria-label="Command palette"
          className={TAB}
          onClick={onOpenPalette}
          type="button"
        >
          <Command aria-hidden="true" className={ICON} />
          <span className="md:hidden">Commands</span>
          <span className="hidden md:inline">Command palette</span>
        </button>

        <Link
          activeProps={{ 'data-active': 'true', 'aria-current': 'page' }}
          className={TAB}
          to="/journal"
        >
          <NotebookPen aria-hidden="true" className={ICON} />
          <span>Journal</span>
        </Link>

        <button className={TAB} onClick={onAddItem} type="button">
          <Plus aria-hidden="true" className={ICON} />
          <span>Add</span>
        </button>

        {/* Desktop only. The phone keeps four tabs and reaches these through
            search, which is where Courses lives too. */}
        <Link
          activeProps={{ 'data-active': 'true', 'aria-current': 'page' }}
          className={cn(TAB, 'hidden md:flex')}
          to="/history"
        >
          <History aria-hidden="true" className={ICON} />
          <span>History</span>
        </Link>

        <Link
          activeProps={{ 'data-active': 'true', 'aria-current': 'page' }}
          className={cn(TAB, 'hidden md:flex')}
          to="/settings"
        >
          <Settings aria-hidden="true" className={ICON} />
          <span>Settings</span>
        </Link>

        <form
          action="/api/auth/logout"
          className="mt-auto hidden md:block"
          method="post"
        >
          <button
            className="min-h-11 px-3 text-muted-foreground text-sm underline-offset-4 hover:underline"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </nav>

      {/*
        Bottom clears the fixed nav plus its safe-area padding on phones. Top
        clears the status bar, which the installed app draws its own background
        under — the head asks iOS for a translucent one so the dark ground runs
        to the top edge instead of stopping at a black bar.
      */}
      <main className="min-w-0 flex-1 pt-[env(safe-area-inset-top)] pb-28 md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  )
}
