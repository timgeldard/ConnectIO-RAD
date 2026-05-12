import { describe, expect, it } from 'vitest'
import {
  makeKpiConfig,
  makeTrendConfig,
  makeBarConfig,
  makeParetoConfig,
  makeSpcConfig,
  makeTableConfig,
  deltaPct,
  mapTone,
} from '../helpers'

// ---------------------------------------------------------------------------
// Widget factories
// ---------------------------------------------------------------------------

describe('makeKpiConfig', () => {
  it('sets type to kpi', () => {
    expect(makeKpiConfig('w1', 'Orders').type).toBe('kpi')
  })

  it('passes id and title through', () => {
    const cfg = makeKpiConfig('my-id', 'My KPI')
    expect(cfg.id).toBe('my-id')
    expect(cfg.title).toBe('My KPI')
  })

  it('defaults to empty layout', () => {
    expect(makeKpiConfig('w1', 'T').layout).toEqual({})
  })

  it('accepts a layout override', () => {
    const cfg = makeKpiConfig('w1', 'T', { colSpan: 3 })
    expect(cfg.layout).toEqual({ colSpan: 3 })
  })

  it('always sets empty props and interactions', () => {
    const cfg = makeKpiConfig('w1', 'T')
    expect(cfg.props).toEqual({})
    expect(cfg.interactions).toEqual([])
  })
})

describe.each([
  ['makeTrendConfig', makeTrendConfig, 'trend'],
  ['makeBarConfig', makeBarConfig, 'bar'],
  ['makeParetoConfig', makeParetoConfig, 'pareto'],
  ['makeSpcConfig', makeSpcConfig, 'spc-control'],
  ['makeTableConfig', makeTableConfig, 'drill-down-table'],
] as const)('%s', (_, factory, expectedType) => {
  it(`sets type to ${expectedType}`, () => {
    expect(factory('w1', 'T').type).toBe(expectedType)
  })

  it('accepts a layout override', () => {
    expect(factory('w1', 'T', { colSpan: 6 }).layout).toEqual({ colSpan: 6 })
  })
})

// ---------------------------------------------------------------------------
// deltaPct
// ---------------------------------------------------------------------------

describe('deltaPct', () => {
  it('returns empty object when current is null', () => {
    expect(deltaPct(null, 100)).toEqual({})
  })

  it('returns empty object when prior is null', () => {
    expect(deltaPct(100, null)).toEqual({})
  })

  it('returns empty object when prior is zero', () => {
    expect(deltaPct(50, 0)).toEqual({})
  })

  it('returns positive delta and up trend', () => {
    const result = deltaPct(110, 100)
    expect(result.delta).toBe('+10.0%')
    expect(result.trend).toBe('up')
  })

  it('returns negative delta and down trend', () => {
    const result = deltaPct(90, 100)
    expect(result.delta).toBe('-10.0%')
    expect(result.trend).toBe('down')
  })

  it('returns up trend when values are equal', () => {
    const result = deltaPct(100, 100)
    expect(result.delta).toBe('+0.0%')
    expect(result.trend).toBe('up')
  })
})

// ---------------------------------------------------------------------------
// mapTone
// ---------------------------------------------------------------------------

describe('mapTone', () => {
  it("maps 'good' to 'ok'", () => {
    expect(mapTone('good')).toBe('ok')
  })

  it("maps 'ok' to 'warn'", () => {
    expect(mapTone('ok')).toBe('warn')
  })

  it("maps 'bad' to 'risk'", () => {
    expect(mapTone('bad')).toBe('risk')
  })

  it('maps unknown strings to neutral', () => {
    expect(mapTone('unknown')).toBe('neutral')
    expect(mapTone('')).toBe('neutral')
  })
})
