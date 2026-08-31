import { useQuery } from '@tanstack/react-query'
import { Download, FileQuestion } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Skeleton } from '#/components/ui/skeleton'
import { formatSize } from '#/lib/upload-limits'
import { type AttachmentRow, downloadUrl } from '#/server/attachments'

/**
 * Shows a file in place rather than sending it to the downloads folder.
 *
 * Everything renders from a signed URL with an inline content disposition.
 * Images use an img tag and the rest an iframe, both of which are plain
 * browser loads rather than fetches, so none of this needs a CORS GET rule on
 * the bucket.
 */
export function FileViewer({
  file,
  onOpenChange,
}: {
  file: AttachmentRow | null
  onOpenChange: (open: boolean) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['attachment-view', file?.id],
    queryFn: () =>
      downloadUrl({ data: { id: file?.id as number, disposition: 'inline' } }),
    enabled: file !== null,
    // Signed links last an hour, so there is no point holding one longer.
    staleTime: 50 * 60 * 1000,
  })

  const kind = viewerKind(file?.contentType ?? '')

  return (
    <Dialog onOpenChange={onOpenChange} open={file !== null}>
      <DialogContent className="max-h-[92dvh] gap-3 sm:max-w-4xl">
        <DialogHeader className="text-left">
          <DialogTitle className="truncate pr-8">{file?.filename}</DialogTitle>
          <DialogDescription>
            {file ? formatSize(file.size) : ''}
            {file?.contentType ? ` · ${file.contentType}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-64 overflow-hidden rounded-md border border-border bg-muted/30">
          {isLoading || !data ? (
            <Skeleton className="h-[70dvh] w-full" />
          ) : kind === 'image' ? (
            <img
              alt={file?.filename ?? ''}
              className="mx-auto max-h-[70dvh] w-auto object-contain"
              src={data.url}
            />
          ) : kind === 'frame' ? (
            <iframe
              className="h-[70dvh] w-full"
              src={data.url}
              title={file?.filename ?? 'File'}
            />
          ) : (
            <Unsupported url={data.url} />
          )}
        </div>

        {data && (
          <Button
            asChild
            className="min-h-11 w-full sm:w-auto"
            variant="secondary"
          >
            <a download={file?.filename} href={data.url}>
              <Download />
              Download
            </a>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Browsers render these natively, anything else gets a download instead. */
function viewerKind(contentType: string): 'image' | 'frame' | 'none' {
  if (contentType.startsWith('image/')) return 'image'
  if (contentType === 'application/pdf') return 'frame'
  if (contentType.startsWith('text/')) return 'frame'
  if (contentType === 'application/json') return 'frame'
  return 'none'
}

function Unsupported({ url }: { url: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 p-6 text-center">
      <FileQuestion
        aria-hidden="true"
        className="size-8 text-muted-foreground"
      />
      <p className="text-muted-foreground text-sm">
        No browser preview for this kind of file.
      </p>
      <Button asChild variant="secondary">
        <a href={url} rel="noopener" target="_blank">
          Open it anyway
        </a>
      </Button>
    </div>
  )
}
