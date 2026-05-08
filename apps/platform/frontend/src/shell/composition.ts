import type { AppComposition } from '@connectio/shared-ui/shell'
import { MODULES } from './modules'

export const COMPOSITION: AppComposition = {
  appId: 'platform',
  appDisplayName: 'ConnectIO',
  appTagline: 'Operations Platform',
  databricksAppName: 'connectio-platform',
  enabledModules: MODULES.map((m) => m.moduleId),
  mandatoryModules: [],
  defaultModule: 'home',
  sidebarBranding: {
    appTag: 'Platform',
  },
  sidebarBottomItems: [
    {
      id: 'settings',
      icon: 'settings',
      iconSet: 'shared-ui',
      tooltip: 'Settings',
      action: 'modal',
      target: '',
    },
  ],
  landingConfig: {
    greetingPrefix: 'Welcome to',
    operatingConsoleLabel: 'ConnectIO Platform',
    showInbox: false,
    showPlantHealth: false,
    showPinned: true,
    inboxTitle: 'Inbox',
    plantHealthTitle: 'Plant Health',
    pinnedTitle: 'Pinned Modules',
  },
  featureFlags: {},
  requiredEnvVars: [],
  backendRouters: [],
}
