/** Current authenticated user, resolved server-side via current_user(). */
export interface CurrentUser {
  name: string
  initials: string
  email: string
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await fetch('/api/me')
  if (!res.ok) throw new Error(`/api/me failed (${res.status})`)
  return res.json() as Promise<CurrentUser>
}
