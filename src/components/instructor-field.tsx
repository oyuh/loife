import { useQuery } from '@tanstack/react-query'
import { Mail, UserRound } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxCreateNew,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '#/components/kibo-ui/combobox'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { coursesQuery } from '#/lib/queries'

/**
 * Who teaches the course, picked rather than retyped.
 *
 * The same professor turns up on two or three classes a term and the email is
 * the part that gets typed wrong, so the name is a combobox over everyone
 * already recorded on another course, and choosing one brings their address
 * with it. Typing a name that is not in the list is the other half of it — the
 * first course of a term has nothing to pick from.
 */
export function InstructorField({
  name,
  email,
  onNameChange,
  onEmailChange,
  /** Excluded from the suggestions, so a course cannot suggest itself. */
  excludeCourseId,
}: {
  name: string
  email: string
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  excludeCourseId?: number
}) {
  const emailId = useId()
  const [open, setOpen] = useState(false)
  const { data: courses = [] } = useQuery(coursesQuery)

  /**
   * One entry per instructor, newest address winning. Two courses taught by
   * the same person are one suggestion, not two, and if only one of them
   * recorded an email that is the one that gets carried over.
   */
  const known = useMemo(() => {
    const byName = new Map<string, { name: string; email: string }>()

    for (const course of courses) {
      if (course.id === excludeCourseId) continue
      const person = course.instructor?.trim()
      if (!person) continue

      const existing = byName.get(person.toLowerCase())
      byName.set(person.toLowerCase(), {
        name: person,
        email: course.instructorEmail ?? existing?.email ?? '',
      })
    }

    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [courses, excludeCourseId])

  const choose = (value: string) => {
    const match = known.find(
      (person) => person.name.toLowerCase() === value.toLowerCase(),
    )
    onNameChange(match?.name ?? value)
    // Only fills a blank. Someone who has already typed an address meant it,
    // even if it disagrees with what another course has recorded.
    if (match?.email && !email.trim()) onEmailChange(match.email)
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field className="min-w-0">
        <FieldLabel>
          Instructor
          <span className="ml-1 font-normal text-muted-foreground">
            optional
          </span>
        </FieldLabel>

        {known.length === 0 ? (
          // Nothing to pick from on the first course of a term, so a dropdown
          // with one empty list in it would only be in the way.
          <div className="relative">
            <UserRound
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Instructor"
              className="h-11 pl-9"
              maxLength={200}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Dr Nguyen"
              value={name}
            />
          </div>
        ) : (
          <Combobox
            data={known.map((person) => ({
              label: person.name,
              value: person.name,
            }))}
            onOpenChange={setOpen}
            onValueChange={choose}
            open={open}
            type="instructor"
            value={name}
          >
            <ComboboxTrigger aria-label="Instructor" className="h-11 w-full">
              <UserRound
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="truncate">
                {name || (
                  <span className="text-muted-foreground">Pick or type</span>
                )}
              </span>
            </ComboboxTrigger>

            <ComboboxContent>
              <ComboboxInput placeholder="Search or type a name" />
              <ComboboxList>
                <ComboboxEmpty>No one recorded yet.</ComboboxEmpty>
                <ComboboxGroup>
                  {known.map((person) => (
                    <ComboboxItem key={person.name} value={person.name}>
                      <span className="truncate">{person.name}</span>
                      {person.email && (
                        <span className="ml-auto truncate text-muted-foreground text-xs">
                          {person.email}
                        </span>
                      )}
                    </ComboboxItem>
                  ))}
                </ComboboxGroup>
                <ComboboxCreateNew onCreateNew={choose} />
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        )}
      </Field>

      <Field className="min-w-0">
        <FieldLabel htmlFor={emailId}>
          Email
          <span className="ml-1 font-normal text-muted-foreground">
            optional
          </span>
        </FieldLabel>
        <div className="relative">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            autoComplete="email"
            className="h-11 pl-9"
            id={emailId}
            inputMode="email"
            maxLength={320}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="nguyen@utdallas.edu"
            type="email"
            value={email}
          />
        </div>
      </Field>
    </div>
  )
}
