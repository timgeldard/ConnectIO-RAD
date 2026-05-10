import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWarehouseApiBase, resolveWarehouseApiPath } from '../apiBase'

const setPathname = (pathname: string) => {
  window.history.replaceState({}, '', pathname)
}

describe('warehouse API base resolution', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('keeps standalone routes on the local /api/wh360 prefix', () => {
    setPathname('/')

    expect(getWarehouseApiBase()).toBe('/api/wh360')
    expect(resolveWarehouseApiPath('/api/kpis')).toBe('/api/wh360/kpis')
    expect(resolveWarehouseApiPath('/api/plants')).toBe('/api/wh360/plants')
  })

  it('rewrites standalone API paths to the Platform Warehouse360 prefix when embedded', () => {
    setPathname('/warehouse360/')

    expect(getWarehouseApiBase()).toBe('/api/wh360')
    expect(resolveWarehouseApiPath('/api/kpis')).toBe('/api/wh360/kpis')
    expect(resolveWarehouseApiPath('/api/plants')).toBe('/api/wh360/plants')
  })

  it('does not double-prefix paths that already use the resolved base', () => {
    expect(resolveWarehouseApiPath('/api/wh360/kpis', '/api/wh360')).toBe('/api/wh360/kpis')
  })

  it('allows an explicit env override for deployment-specific bases', () => {
    vi.stubEnv('VITE_WAREHOUSE360_API_BASE', '/custom/warehouse/')
    setPathname('/')

    expect(getWarehouseApiBase()).toBe('/custom/warehouse')
    expect(resolveWarehouseApiPath('/api/inbound')).toBe('/custom/warehouse/inbound')
  })
})
