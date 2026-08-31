import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getSessionUser } from '#/lib/session'

const fetchCurrentUser = createServerFn({ method: 'GET' }).handler(() =>
  getSessionUser(),
)

export const Route = createFileRoute('/')({
  component: Home,
  loader: () => fetchCurrentUser(),
})

function Home() {
  const user = Route.useLoaderData()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">loife</h1>
        <p className="text-sm text-muted-foreground">
          Courses, assignments, and a daily journal.
        </p>
      </header>

      {user ? <SignedIn user={user} /> : <SignedOut />}
    </main>
  )
}

function SignedIn({
  user,
}: {
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
        <img
          src={user.avatarUrl}
          alt=""
          width={44}
          height={44}
          className="size-11 rounded-full"
        />
        <div className="min-w-0">
          <p className="truncate font-medium">{user.name ?? user.login}</p>
          <p className="truncate text-sm text-muted-foreground">
            @{user.login} · id {user.githubId}
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Phase 1 is working. Session cookie is sealed, and the allowlist matched.
      </p>

      <form method="post" action="/api/auth/logout">
        <button
          type="submit"
          className="min-h-11 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Sign out
        </button>
      </form>
    </section>
  )
}

function SignedOut() {
  return (
    <a
      href="/api/auth/github"
      className="flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 font-medium text-primary-foreground"
    >
      Sign in with GitHub
    </a>
  )
}
