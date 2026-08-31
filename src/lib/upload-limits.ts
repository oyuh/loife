/**
 * Shared between the browser and the server, so it lives outside r2.server.ts.
 * Importing a constant from that module would pull the S3 client into the
 * client bundle along with it.
 */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
