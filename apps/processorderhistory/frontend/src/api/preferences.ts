/** Preferences API — GET /api/me/preferences and POST /api/me/preferences. */

export interface UserPreferences {
  /** null = no saved record → shell shows all modules (factory default). */
  pinnedModules: string[] | null
}

export async function fetchPreferences(appId: string): Promise<UserPreferences> {
  try {
    const res = await fetch(`/api/me/preferences?app_id=${encodeURIComponent(appId)}`)
    if (!res.ok) return { pinnedModules: null }
    const data = await res.json()
    return { pinnedModules: data.pinned_modules ?? null }
  } catch {
    return { pinnedModules: null }
  }
}

export async function savePreferences(appId: string, pinnedModules: string[]): Promise<void> {
  await fetch('/api/me/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, pinned_modules: pinnedModules }),
  })
}
