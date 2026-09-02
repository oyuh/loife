import { QueryClient } from '@tanstack/react-query'

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        /*
         * Without this every mount refetched, so walking Today to Journal and
         * back re-ran the same queries each way. Every mutation here
         * invalidates the keys it touched, and invalidation ignores this, so
         * nothing you just changed waits half a minute to show up.
         */
        staleTime: 30_000,
      },
    },
  })

  return {
    queryClient,
  }
}
export default function TanstackQueryProvider() {}
