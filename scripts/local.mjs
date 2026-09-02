/**
 * The local Docker stack.
 *
 *   pnpm local:up        start Postgres and the S3 stand-in, then push the schema
 *   pnpm local:down      stop them, keeping the data
 *   pnpm local:down --clean   stop them and throw the data away
 *   pnpm local:restart   down then up
 *   pnpm local:dev       vite dev against the containers
 *
 * These are wrappers rather than plain docker compose calls for one reason:
 * the local connection strings have to reach the child process without going
 * near .env, which points at Railway and Cloudflare. Prefixing a variable on
 * the command line is a shell feature, and this has to work in PowerShell too,
 * so the injection happens here.
 */

import { spawn } from 'node:child_process'
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'

/**
 * What the containers answer to. Fixed rather than configurable, because two
 * developers with different local ports is a problem this project will never
 * have, and every value here is worthless outside this machine.
 */
const LOCAL = {
  DATABASE_URL: 'postgresql://loife:loife@localhost:5433/loife',
  R2_ENDPOINT: 'http://localhost:9000',
  R2_ACCOUNT_ID: 'local',
  R2_ACCESS_KEY_ID: 'loife',
  R2_SECRET_ACCESS_KEY: 'loifelocal',
  R2_BUCKET: 'loife',
}

const CONSOLE_URL = 'http://localhost:9001'

/** Runs a command, inheriting stdio, and rejects on a non-zero exit. */
function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      // Windows resolves pnpm and docker through .cmd shims, which spawn only
      // finds with a shell.
      shell: process.platform === 'win32',
      env: { ...process.env, ...env },
    })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}`)),
    )
  })
}

const compose = (...args) => run('docker', ['compose', ...args])

/**
 * MinIO starts empty, and a presigned PUT to a bucket that does not exist
 * fails with a signature error rather than anything that names the real cause.
 */
async function ensureBucket() {
  const client = new S3Client({
    region: 'auto',
    endpoint: LOCAL.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: LOCAL.R2_ACCESS_KEY_ID,
      secretAccessKey: LOCAL.R2_SECRET_ACCESS_KEY,
    },
  })

  try {
    await client.send(new CreateBucketCommand({ Bucket: LOCAL.R2_BUCKET }))
    console.log(`  created bucket ${LOCAL.R2_BUCKET}`)
  } catch (error) {
    // Already there from a previous run, which is the normal case.
    const name = error?.name ?? ''
    if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') {
      throw error
    }
  }
}

async function up() {
  // --wait holds until both healthchecks pass, so nothing below races a
  // Postgres that is still starting up.
  await compose('up', '-d', '--wait')
  await ensureBucket()

  console.log('\n  pushing the schema')
  // drizzle-kit reads DATABASE_URL out of the environment before it falls back
  // to .env, so the containers get the schema and Railway is left alone.
  // --force because the container's data is disposable, so a prompt about
  // dropping a column has only one sensible answer here.
  await run('pnpm', ['db:push', '--force'], { DATABASE_URL: LOCAL.DATABASE_URL })

  console.log(`
  Postgres  ${LOCAL.DATABASE_URL}
  S3        ${LOCAL.R2_ENDPOINT}  (console ${CONSOLE_URL}, loife / loifelocal)

  pnpm local:dev    start the app against these
  pnpm local:down   stop them
`)
}

async function down(clean) {
  await compose('down', ...(clean ? ['--volumes'] : []))
  if (clean) console.log('\n  volumes dropped, so the next up starts empty')
}

const [command, ...flags] = process.argv.slice(2)

switch (command) {
  case 'up':
    await up()
    break

  case 'down':
    await down(flags.includes('--clean'))
    break

  case 'restart':
    await down(flags.includes('--clean'))
    await up()
    break

  case 'dev':
    // The app reads these from process.env, and an inherited value wins over
    // .env, so dev talks to the containers without .env being touched.
    await run('pnpm', ['dev'], LOCAL)
    break

  default:
    console.error(`Unknown command: ${command ?? '(none)'}
Use up, down, restart, or dev.`)
    process.exit(1)
}
