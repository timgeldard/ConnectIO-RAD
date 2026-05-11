import { useEffect, useMemo, useState } from 'react'
import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import {
  getLocalPlatformManifest,
  getPlatformModules,
  type PlatformManifest,
} from './moduleManifest'

export interface PlatformRegistryState {
  manifest: PlatformManifest
  modules: ReturnType<typeof getPlatformModules>
  source: 'local' | 'backend'
}

/** Load backend-served module registration, falling back to the bundled manifest. */
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
