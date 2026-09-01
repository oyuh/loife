import { cn } from '#/lib/utils'

/**
 * The name, set the way the favicon sets it.
 *
 * The icon in `public/` is these same letters traced out of Outfit at weight
 * 800 with -0.02em of tracking, in --primary on nothing. Keeping the two in
 * step is the whole reason this is a component rather than a hardcoded string
 * in each place: change the weight, the tracking or the colour here and the
 * icon has to be regenerated to match.
 *
 * Size is left to the caller, since the sidebar and the sign-in page want it at
 * very different ones.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-extrabold text-primary tracking-[-0.02em]',
        className,
      )}
    >
      loife
    </span>
  )
}
