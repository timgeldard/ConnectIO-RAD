/** Current authenticated user, resolved server-side via current_user(). */
import { fetchJson } from './client'

export interface CurrentUser {
  name: string
  initials: string
  email: string
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  return fetchJson<CurrentUser>('/api/me', { credentials: 'include' })
}
