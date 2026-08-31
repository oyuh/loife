import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#/db'
import { attachments } from '#/db/schema'
import { deleteObject, presignDownload, presignUpload } from '#/lib/r2.server'
import { requireUser } from '#/lib/session.server'
import { MAX_UPLOAD_BYTES } from '#/lib/upload-limits'

export interface AttachmentRow {
  id: number
  key: string
  filename: string
  contentType: string
  size: number
  createdAt: Date
}

/** Exactly one owner, which the database also enforces with a CHECK. */
const owner = z
  .object({
    itemId: z.number().int().positive().nullable(),
    logEntryId: z.number().int().positive().nullable(),
  })
  .refine(
    (value) => (value.itemId === null) !== (value.logEntryId === null),
    'An attachment belongs to exactly one item or one log entry',
  )

export const listAttachments = createServerFn({ method: 'GET' })
  .validator(owner)
  .handler(async ({ data }): Promise<AttachmentRow[]> => {
    await requireUser()

    return db
      .select({
        id: attachments.id,
        key: attachments.key,
        filename: attachments.filename,
        contentType: attachments.contentType,
        size: attachments.size,
        createdAt: attachments.createdAt,
      })
      .from(attachments)
      .where(
        data.itemId
          ? eq(attachments.itemId, data.itemId)
          : eq(attachments.logEntryId, data.logEntryId as number),
      )
      .orderBy(desc(attachments.createdAt))
  })

const uploadRequest = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
})

/**
 * Hands back a URL the browser uploads to directly, plus the key to report
 * back afterwards. The size is checked here and again inside the signature,
 * so a client cannot talk its way past the cap.
 */
export const requestUpload = createServerFn({ method: 'POST' })
  .validator(uploadRequest)
  .handler(async ({ data }) => {
    await requireUser()

    // A UUID rather than the filename, so two uploads never collide and no
    // path escaping is needed. The real name lives in its own column.
    const key = crypto.randomUUID()

    const url = await presignUpload({
      key,
      contentType: data.contentType,
      contentLength: data.size,
    })

    return { key, url }
  })

const recordRequest = uploadRequest.extend({
  key: z.string().uuid(),
  itemId: z.number().int().positive().nullable(),
  logEntryId: z.number().int().positive().nullable(),
})

/** Called once the browser's PUT succeeds. */
export const recordUpload = createServerFn({ method: 'POST' })
  .validator(recordRequest)
  .handler(async ({ data }) => {
    await requireUser()

    const [row] = await db
      .insert(attachments)
      .values({
        itemId: data.itemId,
        logEntryId: data.logEntryId,
        key: data.key,
        filename: data.filename,
        contentType: data.contentType,
        size: data.size,
      })
      .returning({ id: attachments.id })

    return row
  })

export const downloadUrl = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.number().int().positive(),
      // `inline` is what the viewer uses, so the browser renders the file
      // rather than saving it.
      disposition: z.enum(['inline', 'attachment']).default('attachment'),
    }),
  )
  .handler(async ({ data }) => {
    await requireUser()

    const [row] = await db
      .select({
        key: attachments.key,
        filename: attachments.filename,
        contentType: attachments.contentType,
      })
      .from(attachments)
      .where(eq(attachments.id, data.id))

    if (!row) throw new Error('That attachment is gone')

    return {
      url: await presignDownload({ ...row, disposition: data.disposition }),
      contentType: row.contentType,
      filename: row.filename,
    }
  })

export const removeAttachment = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    await requireUser()

    const [row] = await db
      .delete(attachments)
      .where(eq(attachments.id, data.id))
      .returning({ key: attachments.key })

    // The row goes first. An orphaned object costs a fraction of a cent, while
    // a row pointing at a missing object is a broken download.
    if (row) {
      try {
        await deleteObject(row.key)
      } catch (error) {
        console.error('R2 delete failed, object orphaned:', error)
      }
    }
  })
