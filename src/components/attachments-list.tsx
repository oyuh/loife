import { useQuery } from '@tanstack/react-query'
import { Eye, FileText } from 'lucide-react'
import { useState } from 'react'
import { FileViewer } from '#/components/file-viewer'
import { Button } from '#/components/ui/button'
import { formatSize } from '#/lib/upload-limits'
import { type AttachmentRow, listAttachments } from '#/server/attachments'

export type AttachmentOwner =
  | { itemId: number; logEntryId?: never }
  | { itemId?: never; logEntryId: number }

export function attachmentsKey(owner: AttachmentOwner) {
  return ['attachments', owner.itemId ?? null, owner.logEntryId ?? null]
}

/**
 * Read-only view of what is attached, with an eye on each file.
 *
 * Separate from the panel that uploads, so a file can be opened without first
 * putting the thing it belongs to into edit mode.
 */
export function AttachmentsList({
  owner,
  className,
}: {
  owner: AttachmentOwner
  className?: string
}) {
  const [viewing, setViewing] = useState<AttachmentRow | null>(null)

  const ownerIds = {
    itemId: owner.itemId ?? null,
    logEntryId: owner.logEntryId ?? null,
  }

  const { data: files = [] } = useQuery({
    queryKey: attachmentsKey(owner),
    queryFn: () => listAttachments({ data: ownerIds }),
  })

  if (files.length === 0) return null

  return (
    <div className={className}>
      <ul className="divide-y divide-border border-border border-y">
        {files.map((file) => (
          <li className="flex items-center gap-3 py-2" key={file.id}>
            <FileText
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => setViewing(file)}
              type="button"
            >
              <span className="block truncate text-sm">{file.filename}</span>
              <span className="text-muted-foreground text-xs">
                {formatSize(file.size)}
              </span>
            </button>
            <Button
              aria-label={`View ${file.filename}`}
              className="min-h-10 shrink-0"
              onClick={() => setViewing(file)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Eye />
            </Button>
          </li>
        ))}
      </ul>

      <FileViewer
        file={viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null)
        }}
      />
    </div>
  )
}
