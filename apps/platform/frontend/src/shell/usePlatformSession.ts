import { useEffect, useState } from 'react'

export interface PlatformSession {
  userId?: string
  email?: string
  name?: string
  groups: string[]
}

/** Load the shell-owned identity context used for greeting and permission filtering. */
export function usePlatformSession(): PlatformSession {
  const [session, setSession] = useState<PlatformSession>({ groups: [] })

  useEffect(() => {
    let cancelled = false
    fetch('/api/platform/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: PlatformSession | null) => {
        if (cancelled || !data) return
        setSession({
          userId: data.userId,
          email: data.email,
          name: data.name,
          groups: Array.isArray(data.groups) ? data.groups : [],
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return session
}
