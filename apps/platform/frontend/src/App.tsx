import { useCallback, useMemo, useState } from 'react'
import { I18nProvider } from '@connectio/shared-frontend-i18n'
import { PlantProvider } from '@connectio/shared-app-context'
import { PlatformShell } from '@connectio/shared-ui/shell'
import { COMPOSITION } from './shell/composition'
import { MODULES } from './shell/modules'
import { useShellState } from './shell/useShellState'
import { usePinnedModules } from './shell/usePinnedModules'
import { useBadgeCounts } from './shell/useBadgeCounts'
import { ModuleContentPanel } from './shell/ModuleContentPanel'
import { CrossAppContextBar } from './shell/CrossAppContextBar'
import { GenieDrawer } from './genie/GenieDrawer'
import type { PlatformGenieContext } from './genie/api'
import './genie/genie.css'

export function App() {
  const [state, handlers] = useShellState()
  // ... rest of App logic
}

export function Root() {
  return (
    <I18nProvider appName="platform">
      <PlantProvider appName="platform">
        <App />
      </PlantProvider>
    </I18nProvider>
  )
}

