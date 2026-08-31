import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/courses')({ component: Courses })

function Courses() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The course list and the add class modal arrive in phase 6.
      </p>
    </div>
  )
}
