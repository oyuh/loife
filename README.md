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

`railway.json` sets a pre-deploy command that runs [scripts/migrate.mjs](./scripts/migrate.mjs) before each new deployment goes live. It runs inside Railway's private network, so `DATABASE_URL` resolves and Postgres never needs a public TCP proxy.

The script uses drizzle-orm's migrator rather than the drizzle-kit CLI, because drizzle-kit is a devDependency and a production image may prune it.

**Deadline: 2026-12-01.** Railway deprecated `railway.json` in favour of `.railway/railway.ts`. Running `railway config migrate` today turns `preDeployCommand` into a comment rather than a real property, so the new format cannot express it yet and migrating would silently drop the setting. Recheck before that date. If the new format still lacks it, set the pre-deploy command in the service settings instead and delete `railway.json`.

## Checking the schema

```bash
pnpm db:check
```

Applies the migrations to an in-process Postgres and asserts the constraints reject bad rows. No Docker and no database required.
