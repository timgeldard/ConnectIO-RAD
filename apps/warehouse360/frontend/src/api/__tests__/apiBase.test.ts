import { describe, expect, it, vi } from 'vitest'
import { getWarehouseApiBase, resolveWarehouseApiPath } from '../apiBase'

const setPathname = (pathname: string) => {
  window.history.replaceState({}, '', pathname)
}

describe('warehouse API base resolution', () => {
  it('keeps standalone routes on the local /api prefix', () => {
    setPathname('/')

    expect(getWarehouseApiBase()).toBe('/api')
    expect(resolveWarehouseApiPath('/api/kpis')).toBe('/api/kpis')
    expect(resolveWarehouseApiPath('/api/plants')).toBe('/api/plants')
  })

  it('rewrites standalone API paths to the Platform Warehouse360 prefix when embedded', () => {
    setPathname('/warehouse360/')

    expect(getWarehouseApiBase()).toBe('/api/wh')
    expect(resolveWarehouseApiPath('/api/kpis')).toBe('/api/wh/kpis')
    expect(resolveWarehouseApiPath('/api/plants')).toBe('/api/wh/plants')
  })

  it('does not double-prefix paths that already use the resolved base', () => {
    expect(resolveWarehouseApiPath('/api/wh/kpis', '/api/wh')).toBe('/api/wh/kpis')
  })

  it('allows an explicit env override for deployment-specific bases', () => {
    vi.stubEnv('VITE_WAREHOUSE360_API_BASE', '/custom/warehouse/')
    setPathname('/')

    expect(getWarehouseApiBase()).toBe('/custom/warehouse')
    expect(resolveWarehouseApiPath('/api/inbound')).toBe('/custom/warehouse/inbound')

    vi.unstubAllEnvs()
  })
})
