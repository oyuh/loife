import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '#/lib/utils'

/**
 * Renders note and journal text as markdown.
 *
 * react-markdown builds React elements rather than setting innerHTML, so raw
 * HTML in the source is never executed. GFM adds tables, strikethrough, and
 * task lists, which is what people actually write in notes.
 */
export function Markdown({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'prose prose-sm prose-invert max-w-none',
        // The prose plugin sizes headings for articles, which is too loud for
        // a note sitting inside a dialog.
        'prose-headings:font-semibold prose-headings:text-base',
        'prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0',
        'prose-pre:bg-muted prose-pre:text-foreground',
        'prose-a:text-primary prose-a:underline-offset-4',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
