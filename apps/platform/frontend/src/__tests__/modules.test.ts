import { describe, it, expect } from 'vitest'
import { MODULES } from '../shell/modules'

describe('MODULES manifest', () => {
  it('exports 21 modules', () => {
    expect(MODULES).toHaveLength(21)
  })

  it('every module has a non-empty moduleId', () => {
    for (const m of MODULES) {
      expect(m.moduleId, `moduleId missing on ${m.displayName}`).toBeTruthy()
    }
  })

  it('every module has a non-empty displayName', () => {
    for (const m of MODULES) {
      expect(m.displayName, `displayName missing on ${m.moduleId}`).toBeTruthy()
    }
  })

  it('every module has a non-empty shortName', () => {
    for (const m of MODULES) {
      expect(m.shortName, `shortName missing on ${m.moduleId}`).toBeTruthy()
    }
  })

  it('module IDs are unique', () => {
    const ids = MODULES.map((m) => m.moduleId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every module has a valid domain', () => {
    const validDomains = new Set(['quality', 'process-order', 'warehouse', 'platform'])
    for (const m of MODULES) {
      expect(validDomains.has(m.domain), `invalid domain '${m.domain}' on ${m.moduleId}`).toBe(true)
    }
  })

  it('every module has a valid icon name', () => {
    for (const m of MODULES) {
      expect(m.icon, `icon missing on ${m.moduleId}`).toBeTruthy()
    }
  })

  it('every module with tabs has a matching defaultTab', () => {
    for (const m of MODULES) {
      if (m.tabs.length > 0) {
        const tabIds = m.tabs.map((t) => t.id)
        expect(tabIds, `defaultTab '${m.defaultTab}' not in tabs for ${m.moduleId}`).toContain(m.defaultTab)
      }
    }
  })

  it('spc module has 5 tabs', () => {
    const spc = MODULES.find((m) => m.moduleId === 'spc')
    expect(spc?.tabs).toHaveLength(5)
  })

  it('trace module has 6 tabs', () => {
    const trace = MODULES.find((m) => m.moduleId === 'trace')
    expect(trace?.tabs).toHaveLength(6)
  })

  it('lineside-monitor is fullscreen layout', () => {
    const lm = MODULES.find((m) => m.moduleId === 'lineside-monitor')
    expect(lm?.layoutMode).toBe('fullscreen')
  })

  it('modules with appBase have a non-empty backendPrefix', () => {
    const integrated = MODULES.filter((m) => !m.routeBase.endsWith('/'))
    for (const m of integrated) {
      expect(m.backendPrefix, `backendPrefix missing on integrated module ${m.moduleId}`).toBeTruthy()
    }
  })
})
