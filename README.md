# loife

A personal school and life dashboard. Courses, assignments, a daily journal, and file attachments, with due dates pushed to Google Calendar so they show up in Notion Calendar.

See [PLAN.md](./PLAN.md) for the architecture and the phase list.

## Stack

TanStack Start v1 on Vite, React 19, TypeScript, Tailwind v4, shadcn/ui, Biome. Postgres through Drizzle lands in phase 2.

## Running locally

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The app runs at `http://localhost:3000`.

Fill `.env` before signing in. `SESSION_SECRET` needs at least 32 characters:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Your GitHub OAuth app needs its callback URL set to `http://localhost:3000/api/auth/callback` for local work, and to `https://your_app_name_here.up.railway.app/api/auth/callback` once deployed. An OAuth app holds one callback URL at a time, so keep two apps if you want both at once.

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Dev server on port 3000 |
| `pnpm build` | Production build into `.output` |
| `pnpm start` | Run the built server |
| `pnpm check` | Biome lint and format check |
| `pnpm generate-routes` | Regenerate `routeTree.gen.ts` |
| `pnpm local:up` | Start the local Docker stack, described below |

## Auth

One user. The GitHub callback compares the numeric account ID against `ALLOWED_GITHUB_ID` and answers 403 for anything else. The ID is used rather than the username, because GitHub lets a username be changed and then claimed by someone else.

Sessions are sealed cookies from TanStack Start's `useSession`, which handles encryption and signing.

## Deploying to Railway

1. In Railway, create a project and pick **Deploy from GitHub repo**, then `oyuh/loife`.
2. Railway detects pnpm and runs `pnpm build`, then `pnpm start`. No Dockerfile needed.
3. Under **Settings → Networking**, add the custom domain and point a CNAME at the target Railway gives you. Wait for the certificate to issue before signing in, because the session cookie sets `Secure` in production and will not survive plain HTTP.
4. Add every variable from `.env.example` under **Variables**, generating a `SESSION_SECRET` different from the local one.
5. Set `PUBLIC_URL` to the custom domain with no trailing slash, for example `https://loife.example.com`. It drives the OAuth redirect URI, so the Railway subdomain will not work here once the custom domain is live.
6. Set your GitHub OAuth app callback to `https://your_domain_here/api/auth/callback`.

An OAuth app holds one callback URL at a time. Keep a second OAuth app pointed at `http://localhost:3000/api/auth/callback` so local development keeps working, and give each environment its own `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

### Migrations on deploy

The `start` script runs [scripts/migrate.mjs](./scripts/migrate.mjs) before the server boots:

```
node scripts/migrate.mjs && node .output/server/index.mjs
```

Migrations therefore apply inside Railway's private network, where `DATABASE_URL` resolves, so Postgres needs no public TCP proxy. A failed migration stops the boot rather than serving traffic against a schema that does not match the code.

The script uses drizzle-orm's migrator rather than the drizzle-kit CLI, because drizzle-kit is a devDependency and a production image may prune it.

Railway's `railway.json` pre-deploy command was the first approach and it never executed, so it was dropped. That also sidesteps the deprecation of config-as-code on 2026-12-01. Chaining into `start` is host agnostic and needs no platform config.

This assumes one replica, which is the current setup. Running several would have them race to migrate on boot, so move this back to a single pre-deploy step before scaling up.

## Local stack

Docker runs Postgres and a MinIO container that stands in for Cloudflare R2:

```bash
pnpm local:up
```

That starts both containers, waits for their healthchecks, creates the bucket, and applies migrations. Then start the app against them:

```bash
pnpm local:dev
```

| Command | Does |
|---|---|
| `pnpm local:up` | Start the containers and migrate |
| `pnpm local:dev` | Run the dev server against the containers |
| `pnpm local:down` | Stop the containers, keeping the data |
| `pnpm local:down --clean` | Stop them and drop the volumes |
| `pnpm local:restart` | Down, then up |

`local:dev` passes the container connection strings through the environment and never reads `.env`. Keep your Railway and Cloudflare credentials in `.env` for `pnpm dev`, and reach for `local:dev` when you want a session that cannot touch either.

Postgres listens on 5433, because an installed Postgres already holds 5432. Browse the bucket at `http://localhost:9001` with `loife` / `loifelocal`.

Fill the database with something to look at:

```bash
pnpm db:seed
```

That writes three courses and ten items spread across overdue, today, this week, and later, so the Today view has every bucket to render. It refuses to run against any host other than localhost.

`TZ` belongs in `.env` too. Day boundaries come from the host timezone, so a machine on UTC files an 11pm assignment under tomorrow.

## Checks

```bash
pnpm db:check       # migrations apply and constraints reject bad rows
pnpm check:dates    # Today view bucketing, ordering, and grace periods
pnpm check:time     # reads a typed time six ways
pnpm check          # Biome lint and format
```

`db:check` runs against an in-process Postgres, so it needs neither Docker nor a database.

The other check scripts are `check:plan`, `check:search`, `check:syllabus`, and `check:time`. None of them need a database either.
