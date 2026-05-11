/* eslint-disable jsdoc/require-jsdoc */
import { describe, expect, it } from 'vitest'
import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import {
  canViewModule,
  getPlatformModules,
  isModuleEnabled,
  moduleSearchText,
  type PlatformModuleRegistration,
} from '../shell/moduleManifest'

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

  it('filters generated modules by permissions and feature flags', () => {
    const generated: PlatformModuleRegistration = {
      moduleId: 'supplier-quality',
      displayName: 'Supplier Quality',
      shortName: 'SUPQUAL',
      tagline: 'Supplier quality workflows',
      domain: 'quality',
      iconSet: 'shared-ui',
      icon: 'chart',
      color: '#289BA2',
      sidebarGroup: 'quality',
      sidebarOrder: 90,
      defaultTab: 'overview',
      tabs: [],
      landingCard: { tag: 'Supplier', desc: 'Supplier quality', stats: [] },
      contextBarSlot: false,
      routeBase: '/supplier-quality/',
      i18nNamespace: 'supplier-quality',
      isUserSelectable: true,
      isPinnedByDefault: false,
      isMandatory: false,
      backendPrefix: '/api/supplier-quality',
      permissions: ['quality.engineer'],
      featureFlags: { 'supplier-quality.enabled': true },
    }

    const hidden = getPlatformModules([], {
      manifest: {
        modules: [generated],
        featureFlags: { 'supplier-quality.enabled': false },
      },
      userPermissions: ['quality.engineer'],
    })
    const denied = getPlatformModules([], {
      manifest: { modules: [generated] },
      userPermissions: ['warehouse.viewer'],
    })
    const visible = getPlatformModules([], {
      manifest: { modules: [generated] },
      userPermissions: ['quality.engineer'],
    })

    expect(hidden).toHaveLength(0)
    expect(denied).toHaveLength(0)
    expect(visible.map((module) => module.moduleId)).toEqual(['supplier-quality'])
  })

  it('builds searchable text from manifest metadata', () => {
    const module = {
      moduleId: 'supplier-quality',
      displayName: 'Supplier Quality',
      shortName: 'SUPQUAL',
      tagline: 'Supplier quality workflows',
      domain: 'quality',
      iconSet: 'shared-ui',
      icon: 'chart',
      color: '#289BA2',
      sidebarGroup: 'quality',
      sidebarOrder: 90,
      defaultTab: 'overview',
      tabs: [],
      contextBarSlot: false,
      routeBase: '/supplier-quality/',
      i18nNamespace: 'supplier-quality',
      isUserSelectable: true,
      isPinnedByDefault: false,
      isMandatory: false,
      backendPrefix: '/api/supplier-quality',
      searchKeywords: ['vendor scorecard'],
    } satisfies PlatformModuleRegistration

    expect(canViewModule(module)).toBe(true)
    expect(isModuleEnabled(module)).toBe(true)
    expect(moduleSearchText(module)).toContain('vendor scorecard')
  })
})
