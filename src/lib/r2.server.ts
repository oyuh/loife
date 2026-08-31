import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireEnv } from './env'
import { MAX_UPLOAD_BYTES } from './upload-limits'

/**
 * Cloudflare R2 through the S3 API.
 *
 * The bucket is private. Nothing here makes an object public, because homework
 * and journal attachments are personal, so every read goes out as a short
 * lived signed link instead.
 */

export { MAX_UPLOAD_BYTES }

const UPLOAD_URL_TTL_SECONDS = 300
const DOWNLOAD_URL_TTL_SECONDS = 3600

let client: S3Client | null = null

function r2(): S3Client {
  if (client) return client

  client = new S3Client({
    region: 'auto',
    endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  })
  return client
}

/**
 * A URL the browser can PUT straight to, so the bytes never pass through
 * Railway.
 *
 * `ContentLength` is part of the signature, so an upload that lies about its
 * size is rejected by R2 rather than quietly filling the bucket. The client
 * has to send exactly this length and content type.
 */
export function presignUpload(input: {
  key: string
  contentType: string
  contentLength: number
}): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: requireEnv('R2_BUCKET'),
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  )
}

export function presignDownload(input: {
  key: string
  filename: string
  /** `inline` lets the browser render it in place, `attachment` saves it. */
  disposition?: 'inline' | 'attachment'
}): Promise<string> {
  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: requireEnv('R2_BUCKET'),
      Key: input.key,
      // Makes the browser save it under its real name rather than the UUID key.
      ResponseContentDisposition: `${input.disposition ?? 'attachment'}; filename="${input.filename.replace(/"/g, '')}"`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  )
}

export async function deleteObject(key: string): Promise<void> {
  await r2().send(
    new DeleteObjectCommand({
      Bucket: requireEnv('R2_BUCKET'),
      Key: key,
    }),
  )
}
