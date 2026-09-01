import { createFileRoute, redirect } from '@tanstack/react-router'
import { buttonVariants } from '#/components/ui/button'
import { Wordmark } from '#/components/wordmark'
import { fetchCurrentUser } from '#/server/auth'

export const Route = createFileRoute('/signin')({
  beforeLoad: async () => {
    if (await fetchCurrentUser()) throw redirect({ to: '/' })
  },
  component: SignIn,
})

function SignIn() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-12">
      <header className="space-y-1">
        <h1>
          <Wordmark className="text-3xl" />
        </h1>
        <p className="text-sm text-muted-foreground">
          Courses, assignments, and a daily journal.
        </p>
      </header>

      <a
        href="/api/auth/github"
        className={buttonVariants({ className: 'min-h-11 w-full' })}
      >
        Sign in with GitHub
      </a>
    </main>
  )
}
