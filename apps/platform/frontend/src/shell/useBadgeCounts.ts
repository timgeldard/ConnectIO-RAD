import { useState, useEffect } from 'react'

const POLL_INTERVAL_MS = 60_000

/**
 * Fetches current badge counts from the backend API.
 * @returns A record mapping module IDs to their respective badge counts.
 */
async function fetchBadges(): Promise<Record<string, number>> {
  try {
    const res = await fetch('/api/badges')
    if (!res.ok) return {}
    return (await res.json()) as Record<string, number>
  } catch {
    return {}
  }
}

/** Polls /api/badges every 60 s and returns the current badge map. */
export function useBadgeCounts(): Record<string, number> {
  const [badges, setBadges] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const counts = await fetchBadges()
      if (!cancelled) setBadges(counts)
    }
    void load()
    const id = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return badges
}
