/**
 * Filter language for the command palette.
 *
 * Free text plus `key:value` filters, so one input covers "essay in CS 210
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
  /*
   * Optional because a journal day has none of them, and because leaving them
   * out has to keep meaning "no match" rather than throwing.
   */
  location?: string | null
  completedAt?: Date | null
  actualMinutes?: number | null
  estimatedMinutes?: number | null
}

/** `30` is exactly, `>30` and `<30` are the open ends. */
export interface MinutesFilter {
  op: '>' | '<' | '='
  minutes: number
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
  location?: string
  /* Completion, which is a different question from when a thing was due. */
  done?: Date
  doneBefore?: Date
  doneAfter?: Date
  took?: MinutesFilter
  estimate?: MinutesFilter
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
  'at',
  'location',
  'done',
  'donebefore',
  'doneafter',
  'took',
  'est',
] as const

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
]

/** Local midnight from parts, since a bare date string parses as UTC. */
const midnight = (year: number, month: number, day: number) =>
  new Date(year, month, day)

/** Local midnight, a number of days from now. */
function shift(now: Date, days: number) {
  const result = new Date(now)
  result.setDate(result.getDate() + days)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * A date written any of the ways someone types one in a hurry.
 *
 * Deliberately no weekday names. `before:friday` reads as the coming Friday
 * and `after:friday` as the one just gone, and there is no way to serve both
 * from one parser without guessing wrong half the time. Signed offsets say the
 * same things without the ambiguity.
 *
 * Returns undefined for anything it does not recognise, which leaves the token
 * to be treated as free text rather than silently filtering on a wrong date.
 */
export function parseFilterDate(value: string, now: Date): Date | undefined {
  const text = value.toLowerCase().trim()
  if (!text) return undefined

  // 2026-09-15, 2026/09/15, 2026-9-5
  const full = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text)
  if (full)
    return midnight(Number(full[1]), Number(full[2]) - 1, Number(full[3]))

  // 9/15 and 09-15, in the year we are already in
  const short = /^(\d{1,2})[-/](\d{1,2})$/.exec(text)
  if (short) {
    return midnight(now.getFullYear(), Number(short[1]) - 1, Number(short[2]))
  }

  // sep15, sep-15, september-15, and the same the other way round
  const named = /^([a-z]{3,})[-_]?(\d{1,2})$|^(\d{1,2})[-_]?([a-z]{3,})$/.exec(
    text,
  )
  if (named) {
    const month = MONTHS.indexOf((named[1] ?? named[4]).slice(0, 3))
    const day = Number(named[2] ?? named[3])
    if (month >= 0 && day >= 1 && day <= 31) {
      return midnight(now.getFullYear(), month, day)
    }
  }

  const words: Record<string, number> = {
    today: 0,
    tomorrow: 1,
    yesterday: -1,
    week: 7,
    month: 30,
    year: 365,
    lastweek: -7,
    lastmonth: -30,
    lastyear: -365,
  }
  if (text in words) return shift(now, words[text])

  // 7d, 2w, 3mo, 1y, and the same with a minus for the past
  const offset = /^(-?\d+)(d|w|mo|m|y)$/.exec(text)
  if (offset) {
    const size = { d: 1, w: 7, mo: 30, m: 30, y: 365 }[offset[2]]
    if (size) return shift(now, Number(offset[1]) * size)
  }

  return undefined
}

/** `30`, `>30`, `<30`. Anything else is not a minutes filter. */
export function parseMinutes(value: string): MinutesFilter | undefined {
  const parsed = /^([<>]?)(\d+)$/.exec(value)
  if (!parsed) return undefined
  return {
    op: (parsed[1] || '=') as MinutesFilter['op'],
    minutes: Number(parsed[2]),
  }
}

function minutesMatch(
  actual: number | null | undefined,
  filter: MinutesFilter,
) {
  // Unrecorded is not zero, so an unfilled field never satisfies a comparison.
  if (actual == null) return false
  if (filter.op === '>') return actual > filter.minutes
  if (filter.op === '<') return actual < filter.minutes
  return actual === filter.minutes
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

    /*
     * Each arm answers whether it understood the value. A known key with a
     * value it cannot read — `before:lunch`, `p:9`, `took:soon` — must not
     * quietly become no filter at all, because a filter that silently matches
     * everything is worse than one that does not exist. It falls through to
     * free text instead, which narrows rather than widens.
     */
    const understood = ((): boolean => {
      switch (key) {
        case 'course':
        case 'in':
          filters.course = value.toLowerCase()
          return true
        case 'type':
          filters.type = value.toLowerCase()
          return true
        case 'is':
        case 'status':
          if (value.toLowerCase() === 'attached') filters.hasAttachment = true
          else filters.status = value.toLowerCase()
          return true
        case 'priority':
        case 'p': {
          const level = Number(value)
          if (!(level >= 1 && level <= 5)) return false
          filters.priority = level
          return true
        }
        case 'has':
          if (!['file', 'files', 'attachment'].includes(value.toLowerCase())) {
            return false
          }
          filters.hasAttachment = true
          return true
        case 'kind':
          if (value !== 'item' && value !== 'journal') return false
          filters.kind = value
          return true
        case 'at':
        case 'location':
          filters.location = value.toLowerCase()
          return true
        case 'before':
        case 'after':
        case 'done':
        case 'donebefore':
        case 'doneafter': {
          const date = parseFilterDate(value, now)
          if (!date) return false
          if (key === 'before') filters.before = date
          else if (key === 'after') filters.after = date
          else if (key === 'done') filters.done = date
          else if (key === 'donebefore') filters.doneBefore = date
          else filters.doneAfter = date
          return true
        }
        case 'took':
        case 'est': {
          const minutes = parseMinutes(value)
          if (!minutes) return false
          if (key === 'took') filters.took = minutes
          else filters.estimate = minutes
          return true
        }
        default:
          return false
      }
    })()

    if (!understood) filters.text.push(token.toLowerCase())
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

  if (filters.location) {
    const where = entry.location?.toLowerCase() ?? ''
    if (!where.includes(filters.location)) return false
  }

  /*
   * Completion is its own axis. On the history page it is the useful one: what
   * a thing was due is often months away from when it actually got finished.
   */
  if (filters.done) {
    const next = new Date(filters.done)
    next.setDate(next.getDate() + 1)
    if (
      !entry.completedAt ||
      entry.completedAt < filters.done ||
      entry.completedAt >= next
    ) {
      return false
    }
  }
  if (filters.doneBefore) {
    if (!entry.completedAt || entry.completedAt >= filters.doneBefore) {
      return false
    }
  }
  if (filters.doneAfter) {
    if (!entry.completedAt || entry.completedAt <= filters.doneAfter) {
      return false
    }
  }

  if (filters.took && !minutesMatch(entry.actualMinutes, filters.took)) {
    return false
  }
  if (
    filters.estimate &&
    !minutesMatch(entry.estimatedMinutes, filters.estimate)
  ) {
    return false
  }

  if (filters.text.length > 0) {
    /*
     * The course code and the location are in here as well as behind their own
     * keys, so typing `math` or `library` finds things without having to know
     * that `in:` and `at:` exist.
     */
    const haystack =
      `${entry.title} ${entry.body} ${entry.courseCode ?? ''} ${entry.location ?? ''}`.toLowerCase()
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
  { token: 'in:cs210', describes: 'one course' },
  { token: 'type:exam', describes: 'assignments, exams, tasks, readings' },
  { token: 'p:1', describes: 'a priority level' },
  { token: 'has:file', describes: 'only things with an attachment' },
  { token: 'before:2026-10-01', describes: 'due before a date' },
  { token: 'after:today', describes: 'due after a date' },
  { token: 'kind:journal', describes: 'journal entries only' },
  { token: 'is:done', describes: 'by status' },
  { token: 'at:library', describes: 'by location' },
  { token: 'done:yesterday', describes: 'finished on a day' },
  { token: 'doneafter:-7d', describes: 'finished since a date' },
  { token: 'took:>60', describes: 'how long it actually took' },
  { token: 'est:<30', describes: 'how long you thought it would' },
] as const
