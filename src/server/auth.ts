import { createServerFn } from '@tanstack/react-start'
import { getSessionUser } from '#/lib/session.server'

export const fetchCurrentUser = createServerFn({ method: 'GET' }).handler(() =>
  getSessionUser(),
)
