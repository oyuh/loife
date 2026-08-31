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

1. Push this repo to GitHub.
2. In Railway, create a project and pick **Deploy from GitHub repo**.
3. Railway detects pnpm and runs `pnpm build`, then `pnpm start`. No Dockerfile needed.
4. Add every variable from `.env.example` under **Variables**. Use a different `SESSION_SECRET` than your local one.
5. Set `PUBLIC_URL` to the Railway domain, with no trailing slash.
6. Add that same domain plus `/api/auth/callback` to your GitHub OAuth app.
