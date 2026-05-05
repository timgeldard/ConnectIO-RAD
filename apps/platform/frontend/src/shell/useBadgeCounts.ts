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

/**
 * Hook for polling and retrieving badge counts for platform modules.
 *
 * This hook initiates an immediate fetch on mount and then polls the
 * `/api/badges` endpoint every 60 seconds to keep notification indicators
 * updated in the shell's navigation rail.
 *
 * @returns A record mapping moduleId to attention-signal counts.
 */
export function useBadgeCounts(): Record<string, number> {
  const [badges, setBadges] = useState<Record<string, number>>({})

  useEffect(() => {
    let active = true
    const load = async () => {
      const data = await fetchBadges()
      if (active) setBadges(data)
    }

    load()
    const timer = setInterval(load, POLL_INTERVAL_MS)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  return badges
}
