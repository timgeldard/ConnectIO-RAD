import { describe, expect, it } from 'vitest'
import { dashboardQueryRegistry } from '../../dashboardQueryRegistry'

const supportedWidgets = new Set([
  'kpi',
  'trend',
  'bar',
  'pareto',
  'spc-control',
  'drill-down-table',
])

describe('dashboardQueryRegistry', () => {
  it('is not empty and preserves key registry invariants', () => {
    const entries = Object.entries(dashboardQueryRegistry)

    expect(entries.length).toBeGreaterThan(0)
    expect(new Set(entries.map(([key]) => key)).size).toBe(entries.length)
    expect(dashboardQueryRegistry['poh.oeeAnalytics']).toBeDefined()
    expect(dashboardQueryRegistry['spc.qualityControl']).toBeDefined()
  })

  it('keeps each query key aligned with its object key and required metadata', () => {
    for (const [queryKey, entry] of Object.entries(dashboardQueryRegistry)) {
      expect(entry.key).toBe(queryKey)
      expect(entry.label).toBeTruthy()
      expect(entry.description).toBeTruthy()
      expect(entry.endpoint).toBeTruthy()
      expect(entry.compatibleWidgets.length).toBeGreaterThan(0)
      expect(entry.fields.length).toBeGreaterThan(0)
      expect(entry.sampleResponse).toBeDefined()

      for (const widget of entry.compatibleWidgets) {
        expect(supportedWidgets.has(widget)).toBe(true)
      }

      for (const field of entry.fields) {
        expect(field.path).toBeTruthy()
        expect(field.label).toBeTruthy()
        expect(field.type).toBeTruthy()
      }
    }
  })

  // ---------------------------------------------------------------------------
  // Prefix guardrails — catch stale or misrouted endpoints at CI time
  // ---------------------------------------------------------------------------

  it('routes all wm.* and inventory.* queries to /api/wh360 (not /api/wh)', () => {
    for (const [key, entry] of Object.entries(dashboardQueryRegistry)) {
      if (key.startsWith('wm.') || key.startsWith('inventory.')) {
        expect(entry.endpoint, `${key}: endpoint must start with /api/wh360/`).toMatch(/^\/api\/wh360\//)
        expect(entry.endpoint, `${key}: old /api/wh/ prefix detected`).not.toMatch(/^\/api\/wh\//)
      }
    }
  })

  it('routes all poh.* queries to /api/poh (not bare /api)', () => {
    for (const [key, entry] of Object.entries(dashboardQueryRegistry)) {
      if (key.startsWith('poh.')) {
        expect(entry.endpoint, `${key}: endpoint must start with /api/poh/`).toMatch(/^\/api\/poh\//)
        // Reject the historical bare /api/<slug> pattern
        expect(entry.endpoint, `${key}: bare /api/ root path detected`).not.toMatch(/^\/api\/(?!poh\/)/)
      }
    }
  })

  it('routes all quality.* queries to /api/poh/quality (not bare /api/quality)', () => {
    for (const [key, entry] of Object.entries(dashboardQueryRegistry)) {
      if (key.startsWith('quality.')) {
        expect(entry.endpoint, `${key}: endpoint must start with /api/poh/`).toMatch(/^\/api\/poh\//)
        expect(entry.endpoint, `${key}: bare /api/quality/ path detected`).not.toMatch(/^\/api\/quality\//)
      }
    }
  })

  it('routes all spc.* queries to /api/spc', () => {
    for (const [key, entry] of Object.entries(dashboardQueryRegistry)) {
      if (key.startsWith('spc.')) {
        expect(entry.endpoint, `${key}: endpoint must start with /api/spc/`).toMatch(/^\/api\/spc\//)
      }
    }
  })

  it('routes all procurement.* and sales.* queries to /api/wh360', () => {
    for (const [key, entry] of Object.entries(dashboardQueryRegistry)) {
      if (key.startsWith('procurement.') || key.startsWith('sales.')) {
        expect(entry.endpoint, `${key}: endpoint must start with /api/wh360/`).toMatch(/^\/api\/wh360\//)
      }
    }
  })
})
