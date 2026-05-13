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
})
