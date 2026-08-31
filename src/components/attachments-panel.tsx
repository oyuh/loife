import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, FileText, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { FileViewer } from '#/components/file-viewer'
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from '#/components/kibo-ui/dropzone'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'
import { Progress } from '#/components/ui/progress'
import { formatSize, MAX_UPLOAD_BYTES } from '#/lib/upload-limits'
import {
  type AttachmentRow,
  listAttachments,
  recordUpload,
  removeAttachment,
  requestUpload,
} from '#/server/attachments'

type Owner =
  | { itemId: number; logEntryId?: never }
  | { itemId?: never; logEntryId: number }

export function AttachmentsPanel(owner: Owner) {
  const key = ['attachments', owner.itemId ?? null, owner.logEntryId ?? null]
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<number | null>(null)
  const [viewing, setViewing] = useState<AttachmentRow | null>(null)
  const [confirming, setConfirming] = useState<AttachmentRow | null>(null)

  const ownerIds = {
    itemId: owner.itemId ?? null,
    logEntryId: owner.logEntryId ?? null,
  }

  const { data: files = [] } = useQuery({
    queryKey: key,
    queryFn: () => listAttachments({ data: ownerIds }),
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      // The bytes go browser to R2 directly, so Railway never carries them.
      const { key: objectKey, url } = await requestUpload({
        data: {
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
        },
      })

      const response = await fetch(url, {
        method: 'PUT',
        // Must match what was signed, or R2 rejects it.
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      })

      if (!response.ok) {
        throw new Error(`Upload failed with ${response.status}`)
      }

      return recordUpload({
        data: {
          ...ownerIds,
          key: objectKey,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
        },
      })
    },
    onMutate: () => setProgress(10),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
      toast.success('Uploaded')
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Upload failed'),
    onSettled: () => setProgress(null),
  })

  const remove = useMutation({
    mutationFn: (id: number) => removeAttachment({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
      setConfirming(null)
      toast.success('Deleted')
    },
    onError: () => toast.error('Could not delete that'),
  })

  return (
    <div className="space-y-3">
      <Dropzone
        disabled={upload.isPending}
        maxSize={MAX_UPLOAD_BYTES}
        onDrop={(accepted, rejections) => {
          if (rejections.length > 0) {
            toast.error(
              rejections[0].errors[0]?.message ?? 'That file was rejected',
            )
            return
          }
          for (const file of accepted) upload.mutate(file)
        }}
        src={undefined}
      >
        <DropzoneEmptyState />
        <DropzoneContent />
      </Dropzone>

      {progress !== null && <Progress value={progress} />}

      {files.length > 0 && (
        <ul className="divide-y divide-border border-border border-y">
          {files.map((file: AttachmentRow) => (
            <li className="flex items-center gap-3 py-2" key={file.id}>
              <FileText
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{file.filename}</p>
                <p className="text-muted-foreground text-xs">
                  {formatSize(file.size)}
                </p>
              </div>

              <Button
                aria-label={`View ${file.filename}`}
                className="min-h-10"
                onClick={() => setViewing(file)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Eye />
              </Button>
              <Button
                aria-label={`Delete ${file.filename}`}
                className="min-h-10"
                onClick={() => setConfirming(file)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <FileViewer
        file={viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null)
        }}
      />

      {/* Deleting an upload cannot be undone, so it asks first. */}
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
        open={confirming !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.filename} is removed from storage as well, and there
              is no undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-background hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (confirming) remove.mutate(confirming.id)
              }}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
