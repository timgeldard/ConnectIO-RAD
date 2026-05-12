/* eslint-disable jsdoc/require-jsdoc */
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
 * Returns string[] once the user has customised the rail.
 *
 * @param selectableModuleIds  All user-selectable, non-mandatory module IDs
 *   currently enabled. Used to seed the initial pin set when the user
 *   removes a module for the first time (from the "show all" null state).
 */
export function usePinnedModules(selectableModuleIds: string[]): [string[] | null, (moduleId: string, pin: boolean) => void] {
  const [pinned, setPinned] = useState<string[] | null>(readPinned)

  const onPinToggle = useCallback((moduleId: string, pin: boolean) => {
    setPinned((prev) => {
      // When no preferences exist yet, seed from the full selectable list so
      // that "unpin" from the default state actually removes the item rather
      // than being a no-op (filtering an empty array returns an empty array).
      const current = prev ?? selectableModuleIds
      const next = pin
        ? current.includes(moduleId) ? current : [...current, moduleId]
        : current.filter((id) => id !== moduleId)
      writePinned(next.length > 0 ? next : null)
      return next.length > 0 ? next : null
    })
  }, [selectableModuleIds])

  return [pinned, onPinToggle]
}
