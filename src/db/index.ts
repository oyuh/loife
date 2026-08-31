import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { isProduction, requireEnv } from '#/lib/env'
import * as schema from './schema'

// Vite reloads server modules on edit, and each reload would otherwise open a
// fresh pool and leak the old one until Railway's connection limit complains.
const globalForDb = globalThis as unknown as {
  loifeClient?: ReturnType<typeof postgres>
}

const client =
  globalForDb.loifeClient ?? postgres(requireEnv('DATABASE_URL'), { max: 5 })

if (!isProduction) globalForDb.loifeClient = client

export const db = drizzle(client, { schema })
