/**
 * Converts between the two native inputs the add form uses and the single
 * `dueAt` + `allDay` pair the database stores.
 *
 * Everything here builds dates from parts. `new Date('2026-09-15')` parses as
 * UTC midnight, which lands on the previous day for anyone west of Greenwich,
 * and that is exactly the bug this module exists to avoid.
 */

export interface DueFields {
  /** `<input type="date">` value, `2026-09-15`, or empty for no due date. */
  date: string
  /** `<input type="time">` value, `17:00`, or empty for an all-day item. */
  time: string
}

export interface DueValue {
  dueAt: Date | null
  allDay: boolean
}

/** An item with no time is due by the end of its day, not the start. */
const END_OF_DAY = { hours: 23, minutes: 59 } as const

export function toDueValue({ date, time }: DueFields): DueValue {
  if (!date) return { dueAt: null, allDay: true }

  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return { dueAt: null, allDay: true }

  if (!time) {
    const at = new Date(
      year,
      month - 1,
      day,
      END_OF_DAY.hours,
      END_OF_DAY.minutes,
      0,
      0,
    )
    return { dueAt: at, allDay: true }
  }

  const [hours, minutes] = time.split(':').map(Number)
  return {
    dueAt: new Date(year, month - 1, day, hours ?? 0, minutes ?? 0, 0, 0),
    allDay: false,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The inverse, for editing an existing item. */
export function toDueFields({ dueAt, allDay }: DueValue): DueFields {
  if (!dueAt) return { date: '', time: '' }

  const date = `${dueAt.getFullYear()}-${pad(dueAt.getMonth() + 1)}-${pad(dueAt.getDate())}`
  if (allDay) return { date, time: '' }

  return { date, time: `${pad(dueAt.getHours())}:${pad(dueAt.getMinutes())}` }
}
