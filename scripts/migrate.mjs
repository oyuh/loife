/**
 * Applies pending migrations. Runs as Railway's pre-deploy command, inside the
 * private network where DATABASE_URL resolves, so Postgres needs no public
 * TCP proxy.
 *
 * Uses drizzle-orm's migrator rather than the drizzle-kit CLI, because
 * drizzle-kit is a devDependency and may be pruned from a production image.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set, so there is nothing to migrate against.')
  process.exit(1)
}

// max: 1 because a migration runs its statements in order on one connection.
const client = postgres(url, {
  max: 1,
  // Every re-run notices that the migrations table is already there and says
  // so at length. Anything that actually went wrong arrives as an error.
  onnotice: () => {},
})

try {
  await migrate(drizzle(client), { migrationsFolder: 'drizzle' })
  console.log('migrations up to date')
} finally {
  await client.end()
}
