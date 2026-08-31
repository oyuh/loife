import { FileText, X } from 'lucide-react'
import { Dropzone, DropzoneEmptyState } from '#/components/kibo-ui/dropzone'
import { Button } from '#/components/ui/button'
import { formatSize, MAX_UPLOAD_BYTES } from '#/lib/upload-limits'

/**
 * Files chosen before the thing they belong to exists.
 *
 * An attachment row needs an item id, so a brand new item has nothing to hang
 * one off yet. These are held until the save returns an id and then uploaded,
 * which is what lets a file be attached from the add form rather than only
 * after reopening it.
 */
export function StagedFiles({
  files,
  onChange,
  disabled,
}: {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <Dropzone
        disabled={disabled}
        maxSize={MAX_UPLOAD_BYTES}
        onDrop={(accepted) => onChange([...files, ...accepted])}
        src={undefined}
      >
        <DropzoneEmptyState />
      </Dropzone>

      {files.length > 0 && (
        <ul className="divide-y divide-border border-border border-y">
          {files.map((file, index) => (
            <li
              className="flex items-center gap-3 py-2"
              key={`${file.name}-${file.size}-${file.lastModified}`}
            >
              <FileText
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{file.name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatSize(file.size)} · uploads when you save
                </p>
              </div>
              <Button
                aria-label={`Remove ${file.name}`}
                className="min-h-10 shrink-0"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
