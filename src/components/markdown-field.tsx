import { Eye, PencilLine } from 'lucide-react'
import { useState } from 'react'
import { Markdown } from '#/components/markdown'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils'

/**
 * A textarea that can flip to a rendered preview.
 *
 * Editing stays plain text, since a rich text editor fights with the markdown
 * people already type. The toggle is there for reading back a long entry.
 */
export function MarkdownField({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  rows = 3,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  rows?: number
}) {
  const [previewing, setPreviewing] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">Markdown works here</p>
        <Button
          className="h-8"
          disabled={disabled || !value.trim()}
          onClick={() => setPreviewing((previous) => !previous)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {previewing ? <PencilLine /> : <Eye />}
          {previewing ? 'Edit' : 'Preview'}
        </Button>
      </div>

      {previewing ? (
        <div
          className={cn(
            'min-h-24 rounded-md border border-input px-3 py-2',
            className,
          )}
        >
          <Markdown>{value}</Markdown>
        </div>
      ) : (
        <Textarea
          className={className}
          disabled={disabled}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          value={value}
        />
      )}
    </div>
  )
}
