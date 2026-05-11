/* eslint-disable jsdoc/require-jsdoc */
import { describe, expect, it } from 'vitest'
import { parseFiltersFromSearchParams, serializeFiltersToSearchParams } from '../hooks/filters'

describe('shared-reporting filter URL helpers', () => {
  it('round-trips dashboard filters through URL search params', () => {
    const params = serializeFiltersToSearchParams({
      plant: 'CHV',
      status: ['running', 'blocked'],
      time: { from: '2026-05-10', to: '2026-05-11' },
      empty: null,
    })

    expect(parseFiltersFromSearchParams(params)).toEqual({
      plant: 'CHV',
      status: ['running', 'blocked'],
      time: { from: '2026-05-10', to: '2026-05-11' },
    })
  })
})
