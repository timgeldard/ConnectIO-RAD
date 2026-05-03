/** Preferences API — GET /api/me/preferences and POST /api/me/preferences. */

import { fetchJson, postJson } from './client'

export interface UserPreferences {
  /** null = no saved record → shell shows all modules (factory default). */
  pinnedModules: string[] | null
}

export async function fetchPreferences(appId: string): Promise<UserPreferences> {
  try {
    const data = await fetchJson<{ pinned_modules?: string[] | null }>(
      `/api/me/preferences?app_id=${encodeURIComponent(appId)}`,
    )
    return { pinnedModules: data.pinned_modules ?? null }
  } catch {
    return { pinnedModules: null }
  }
}

export async function savePreferences(appId: string, pinnedModules: string[]): Promise<void> {
  await postJson<void>('/api/me/preferences', { app_id: appId, pinned_modules: pinnedModules })
}
