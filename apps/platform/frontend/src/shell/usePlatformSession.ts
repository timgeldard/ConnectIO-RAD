/* eslint-disable jsdoc/require-jsdoc */
import { useEffect, useState } from 'react'

export interface PlatformSession {
  /** Stable user identifier from the platform identity proxy. */
  userId?: string
  /** User email address when available from identity headers. */
  email?: string
  /** Friendly display name for shell greetings. */
  name?: string
  /** Identity groups used for manifest permission filtering. */
  groups: string[]
}

/**
 * Loads the shell-owned identity context used for greeting and permission filtering.
 *
 * @returns Current platform session, falling back to an anonymous group set.
 */
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
