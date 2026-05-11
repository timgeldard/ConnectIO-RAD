/* eslint-disable jsdoc/require-jsdoc */
import { useEffect, useMemo, useState } from 'react'
import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import {
  getLocalPlatformManifest,
  getPlatformModules,
  type PlatformManifest,
} from './moduleManifest'

export interface PlatformRegistryState {
  /** Manifest currently driving shell registration. */
  manifest: PlatformManifest
  /** Modules after static merge, feature-flag filtering, and permission filtering. */
  modules: ReturnType<typeof getPlatformModules>
  /** Whether the registry came from the backend endpoint or bundled fallback. */
  source: 'local' | 'backend'
}

/**
 * Loads backend-served module registration, falling back to the bundled manifest.
 *
 * @param staticModules Mature modules declared directly by the platform shell.
 * @param userPermissions Identity groups granted to the current platform user.
 * @returns Manifest source and visible module registrations for shell rendering.
 */
export function usePlatformRegistry(
  staticModules: ConnectIOModule[],
  userPermissions: string[],
): PlatformRegistryState {
  const [remoteManifest, setRemoteManifest] = useState<PlatformManifest | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/platform/apps/manifest')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: PlatformManifest | null) => {
        if (!cancelled && data?.modules) setRemoteManifest(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return useMemo(() => {
    const manifest = remoteManifest ?? getLocalPlatformManifest()
    return {
      manifest,
      modules: getPlatformModules(staticModules, { manifest, userPermissions }),
      source: remoteManifest ? 'backend' : 'local',
    }
  }, [remoteManifest, staticModules, userPermissions])
}
