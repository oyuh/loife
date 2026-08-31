import { defineConfig } from 'drizzle-kit'

// drizzle-kit runs as its own CLI, outside Vite, so it never sees Vite's .env
// loading. Node reads the file directly. On Railway there is no .env and the
// variables already live in the environment, so a miss is fine.
try {
  process.loadEnvFile('.env')
} catch {
  // No .env file, so the platform supplies the environment.
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
})
