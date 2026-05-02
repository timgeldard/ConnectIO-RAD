export interface UserPreferences {
  pinnedModules: string[] | null
}

export async function fetchPreferences(appId: string): Promise<UserPreferences> {
  try {
    const res = await fetch(`/api/cq/me/preferences?app_id=${encodeURIComponent(appId)}`)
    if (!res.ok) return { pinnedModules: null }
    const data = await res.json()
    return { pinnedModules: data.pinned_modules ?? null }
  } catch {
    return { pinnedModules: null }
  }
}

export async function savePreferences(appId: string, pinnedModules: string[]): Promise<void> {
  await fetch('/api/cq/me/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, pinned_modules: pinnedModules }),
  })
}
