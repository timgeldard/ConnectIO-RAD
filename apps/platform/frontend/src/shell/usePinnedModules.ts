import { useState, useCallback } from 'react'

const STORAGE_KEY = 'connectio.pinnedModules'

function readPinned(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : null
  } catch {
    return null
  }
}

function writePinned(pins: string[] | null): void {
  try {
    if (pins === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pins))
    }
  } catch {
    // localStorage unavailable (e.g. private browsing) — fail silently
  }
}

/**
 * Reads and writes the user's pinned module list from localStorage.
 *
 * Returns null when no preferences are saved (show all enabled modules).
 * Returns string[] once the user has pinned at least one module.
 * Exposes onPinToggle(moduleId, pin) to add/remove pins.
 */
export function usePinnedModules(): [string[] | null, (moduleId: string, pin: boolean) => void] {
  const [pinned, setPinned] = useState<string[] | null>(readPinned)

  const onPinToggle = useCallback((moduleId: string, pin: boolean) => {
    setPinned((prev) => {
      const current = prev ?? []
      const next = pin
        ? current.includes(moduleId) ? current : [...current, moduleId]
        : current.filter((id) => id !== moduleId)
      writePinned(next.length > 0 ? next : null)
      return next.length > 0 ? next : null
    })
  }, [])

  return [pinned, onPinToggle]
}
