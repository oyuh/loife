/**
 * Filter language for the command palette.
 *
 * Free text plus `key:value` filters, so one input covers "essay in CS 2340
 * with a file, due before Friday" without a form. Pure and dependency free so
 * scripts/check-search.ts can exercise it.
 */

export interface Searchable {
  kind: 'item' | 'journal'
  title: string
  body: string
  date: Date | null
  courseCode: string | null
  type: string | null
  priority: number | null
  status: string | null
  hasAttachment: boolean
}

export interface Filters {
  text: string[]
  course?: string
  type?: string
  status?: string
  priority?: number
  hasAttachment?: boolean
  before?: Date
  after?: Date
  kind?: 'item' | 'journal'
}

const KEYS = [
  'course',
  'in',
  'type',
  'is',
  'status',
  'priority',
  'p',
  'has',
  'before',
  'after',
  'kind',
] as const

/** `2026-09-15`, or a relative word, or nothing. */
export function parseFilterDate(value: string, now: Date): Date | undefined {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (iso) {
    // From parts, since a bare date string parses as UTC midnight.
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  }

  const relative: Record<string, number> = {
    today: 0,
    tomorrow: 1,
    yesterday: -1,
    week: 7,
    month: 30,
  }

  const days = relative[value.toLowerCase()]
  if (days === undefined) return undefined

  const result = new Date(now)
  result.setDate(result.getDate() + days)
  result.setHours(0, 0, 0, 0)
  return result
}

export function parseQuery(query: string, now: Date = new Date()): Filters {
  const filters: Filters = { text: [] }

  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    const split = token.indexOf(':')
    const key = split > 0 ? token.slice(0, split).toLowerCase() : ''
    const value = split > 0 ? token.slice(split + 1) : ''

    if (!value || !(KEYS as readonly string[]).includes(key)) {
      filters.text.push(token.toLowerCase())
      continue
    }

    switch (key) {
      case 'course':
      case 'in':
        filters.course = value.toLowerCase()
        break
      case 'type':
        filters.type = value.toLowerCase()
        break
      case 'is':
      case 'status':
        if (value.toLowerCase() === 'attached') filters.hasAttachment = true
        else filters.status = value.toLowerCase()
        break
      case 'priority':
      case 'p': {
        const level = Number(value)
        if (level >= 1 && level <= 5) filters.priority = level
        break
      }
      case 'has':
        if (['file', 'files', 'attachment'].includes(value.toLowerCase())) {
          filters.hasAttachment = true
        }
        break
      case 'before':
        filters.before = parseFilterDate(value, now)
        break
      case 'after':
        filters.after = parseFilterDate(value, now)
        break
      case 'kind':
        if (value === 'item' || value === 'journal') filters.kind = value
        break
    }
  }

  return filters
}

export function matches(entry: Searchable, filters: Filters): boolean {
  if (filters.kind && entry.kind !== filters.kind) return false

  if (filters.course) {
    const code = entry.courseCode?.toLowerCase().replace(/\s+/g, '') ?? ''
    if (!code.includes(filters.course.replace(/\s+/g, ''))) return false
  }

  if (filters.type && entry.type !== filters.type) return false
  if (filters.status && entry.status !== filters.status) return false
  if (filters.priority && entry.priority !== filters.priority) return false
  if (filters.hasAttachment && !entry.hasAttachment) return false

  // A dateless entry cannot satisfy a date filter, so it drops out rather than
  // slipping through as a false match.
  if (filters.before) {
    if (!entry.date || entry.date >= filters.before) return false
  }
  if (filters.after) {
    if (!entry.date || entry.date <= filters.after) return false
  }

  if (filters.text.length > 0) {
    const haystack = `${entry.title} ${entry.body}`.toLowerCase()
    if (!filters.text.every((word) => haystack.includes(word))) return false
  }

  return true
}

export function search<T extends Searchable>(
  entries: T[],
  query: string,
  now: Date = new Date(),
): T[] {
  const filters = parseQuery(query, now)
  return entries.filter((entry) => matches(entry, filters))
}

/** Shown under the input so the syntax is discoverable rather than secret. */
export const FILTER_HINTS = [
  { token: 'in:cs2340', describes: 'one course' },
  { token: 'type:exam', describes: 'assignments, exams, tasks, readings' },
  { token: 'p:1', describes: 'a priority level' },
  { token: 'has:file', describes: 'only things with an attachment' },
  { token: 'before:2026-10-01', describes: 'due before a date' },
  { token: 'after:today', describes: 'due after a date' },
  { token: 'kind:journal', describes: 'journal entries only' },
  { token: 'is:done', describes: 'by status' },
] as const
