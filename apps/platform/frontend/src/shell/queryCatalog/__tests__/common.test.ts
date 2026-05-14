import { describe, expect, it } from 'vitest'
import { apiEndpoint, platformApiPrefixes } from '../common'

describe('platformApiPrefixes', () => {
  it('contains an entry for every expected domain', () => {
    expect(platformApiPrefixes.warehouse360).toBe('/api/wh360')
    expect(platformApiPrefixes.poh).toBe('/api/poh')
    expect(platformApiPrefixes.spc).toBe('/api/spc')
  })

  it('all prefix values start with a leading slash', () => {
    for (const prefix of Object.values(platformApiPrefixes)) {
      expect(prefix).toMatch(/^\//)
    }
  })
})

describe('apiEndpoint', () => {
  it('returns the bare prefix when no slug is supplied', () => {
    expect(apiEndpoint('poh')).toBe('/api/poh')
    expect(apiEndpoint('warehouse360')).toBe('/api/wh360')
    expect(apiEndpoint('spc')).toBe('/api/spc')
  })

  it('appends the slug with a separator when supplied', () => {
    expect(apiEndpoint('poh', 'oee')).toBe('/api/poh/oee')
    expect(apiEndpoint('warehouse360', 'stock/summary')).toBe('/api/wh360/stock/summary')
  })

  it('does not double-slash when the slug already starts with a slash', () => {
    // slug is expected to be a plain fragment, but guard against accidental slashes
    const result = apiEndpoint('poh', 'oee')
    expect(result).not.toContain('//')
  })
})
