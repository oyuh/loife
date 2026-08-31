import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/journal')({ component: Journal })

function Journal() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Journal</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The inline log and the day view arrive in phase 7.
      </p>
    </div>
  )
}
