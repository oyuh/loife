import { createFileRoute } from '@tanstack/react-router'
import { CalendarStatus } from '#/components/calendar-status'
import { DayWindow, Preferences } from '#/components/preferences'

export const Route = createFileRoute('/_app/settings')({ component: Settings })

function Settings() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-5 py-8">
      <header className="mb-2">
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
      </header>

      <CalendarStatus />
      <Preferences />
      <DayWindow />
    </div>
  )
}
