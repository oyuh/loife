import { defineConfig } from 'drizzle-kit'

// drizzle-kit runs as its own CLI, outside Vite, so it never sees Vite's .env
// loading. Node reads the file directly. On Railway there is no .env and the
// variables already live in the environment, so a miss is fine.
// Captured first, because the local Docker stack passes its own connection
// string through the environment and .env points at Railway. Whether
// loadEnvFile overwrites an existing value is not worth depending on, so the
// precedence is spelled out below instead.
const fromShell = process.env.DATABASE_URL

try {
  process.loadEnvFile('.env')
} catch {
  // No .env file, so the platform supplies the environment.
}

export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: fromShell ?? process.env.DATABASE_URL ?? '',
  },
})
