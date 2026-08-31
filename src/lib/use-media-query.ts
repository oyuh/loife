import { useEffect, useState } from 'react'

/**
 * Starts false on the server and on first paint, then corrects after mount.
 * Only the add form reads this, and it opens on a tap, so the correction has
 * always happened before anything renders from it.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const list = window.matchMedia(query)
    setMatches(list.matches)

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}
