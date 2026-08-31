import { queryOptions } from '@tanstack/react-query'
import { listCourses } from '#/server/courses'
import { listItems } from '#/server/items'
import { listDays } from '#/server/journal'

/**
 * Shared query definitions. Route loaders prime these on the server and the
 * components read the same keys, so a page never refetches what SSR already
 * sent, and a mutation has one key to update optimistically.
 */
export const itemsQuery = queryOptions({
  queryKey: ['items'] as const,
  queryFn: () => listItems(),
})

export const coursesQuery = queryOptions({
  queryKey: ['courses'] as const,
  queryFn: () => listCourses(),
})

export const journalQuery = queryOptions({
  queryKey: ['journal'] as const,
  queryFn: () => listDays(),
})
