/**
 * How one logged line is written into a day's journal body.
 *
 * Pure and free of the database, so scripts/check-journal.ts can run it, and
 * so the separator the SQL concatenates with is the same string the format
 * was designed around rather than an escape sequence retyped inside a query.
 */
import { formatClockWithSeconds, formatMonthDay } from './datetime.ts'

/**
 * A blank line rather than a single newline.
 *
 * Markdown folds a lone newline into the paragraph above it, so an afternoon
 * of logging came back out of the journal as one run-on sentence with every
 * entry jammed end to end.
 */
export const LOG_SEPARATOR = '\n\n'

/**
 * Two trailing spaces, which is how markdown is told a line break was meant.
 *
 * The palette's composer takes Shift+Enter, so a logged line can arrive with
 * newlines inside it, and those fold away for exactly the same reason.
 */
const hardBreak = (text: string) => text.replace(/[ \t]*\r?\n/g, '  \n')

/**
 * One stamped line, ready to append.
 *
 * The stamp says when the line was written, not "20 minutes ago". Relative
 * text is only true at the moment it is written and this body gets read back
 * weeks later. Writing into another day carries the date as well, since that
 * entry's own heading has stopped being the answer to when this was typed.
 */
export function logLine(
  text: string,
  at: Date,
  { date, today }: { date: string; today: string },
): string {
  const stamp =
    date === today
      ? formatClockWithSeconds(at)
      : `${formatMonthDay(at)}, ${formatClockWithSeconds(at)}`

  return `**${stamp}** · ${hardBreak(text)}`
}
