import { describe, expect, it } from 'vitest'
import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import { getPlatformModules } from '../shell/moduleManifest'

describe('getPlatformModules', () => {
  it('preserves static modules when manifest is empty', () => {
    const modules: ConnectIOModule[] = [
      {
        moduleId: 'spc',
        displayName: 'SPC',
        shortName: 'SPC',
        tagline: 'Statistical process control',
        domain: 'quality',
        iconSet: 'shared-ui',
        icon: 'spc',
        color: '#F24A00',
        sidebarGroup: 'quality',
        sidebarOrder: 3,
        defaultTab: 'charts',
        tabs: [],
        landingCard: { tag: 'SPC', desc: 'SPC', stats: [] },
        contextBarSlot: false,
        routeBase: '/spc/',
        i18nNamespace: 'spc',
        isUserSelectable: true,
        isPinnedByDefault: true,
        isMandatory: false,
        backendPrefix: '/api/spc',
      },
    ]

    expect(getPlatformModules(modules).map((module) => module.moduleId)).toContain('spc')
  })
})
