import type { AppComposition } from '@connectio/shared-ui/shell'
import { MODULES } from './modules'

export const COMPOSITION: AppComposition = {
  appId: 'platform',
  appDisplayName: 'ConnectIO',
  appTagline: 'Operations Platform',
  databricksAppName: 'connectio-platform',
  enabledModules: MODULES.map((m) => m.moduleId),
  mandatoryModules: [],
  defaultModule: 'trace',
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
    {
      id: 'help',
      icon: 'help',
      iconSet: 'shared-ui',
      tooltip: 'Help & documentation',
      action: 'external',
      target: 'https://confluence.kerry.com/connectio',
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
