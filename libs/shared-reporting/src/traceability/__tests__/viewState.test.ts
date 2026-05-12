import { describe, expect, test } from 'vitest'

import {
  parseTraceViewState,
  serialiseTraceViewState,
  __INTERNAL,
} from '../viewState'

const { DEFAULT_STATE } = __INTERNAL

describe('parseTraceViewState', () => {
  test('returns defaults for an empty search string', () => {
    expect(parseTraceViewState('')).toEqual(DEFAULT_STATE)
  })

  test('reads recognised values', () => {
    const state = parseTraceViewState('?tv=advanced&td=upstream&du=3&dd=2&ts=NODE-7')
    expect(state).toEqual({
      view: 'advanced',
      direction: 'upstream',
      depthUpstream: 3,
      depthDownstream: 2,
      selectedId: 'NODE-7',
    })
  })

  test('rejects unknown enum values and falls back to defaults', () => {
    const state = parseTraceViewState('?tv=cosmic&td=sideways')
    expect(state.view).toBe(DEFAULT_STATE.view)
    expect(state.direction).toBe(DEFAULT_STATE.direction)
  })

  test('clamps depth values to [0, 99] and ignores garbage input', () => {
    expect(parseTraceViewState('?du=300').depthUpstream).toBe(99)
    expect(parseTraceViewState('?du=-5').depthUpstream).toBe(DEFAULT_STATE.depthUpstream)
    expect(parseTraceViewState('?du=banana').depthUpstream).toBe(
      DEFAULT_STATE.depthUpstream,
    )
  })
})

describe('serialiseTraceViewState', () => {
  test('omits keys whose value matches the default', () => {
    const params = serialiseTraceViewState(DEFAULT_STATE)
    expect(params.toString()).toBe('')
  })

  test('round-trips a non-default state', () => {
    const start = {
      view: 'advanced' as const,
      direction: 'downstream' as const,
      depthUpstream: 2,
      depthDownstream: 4,
      selectedId: 'BATCH-9',
    }
    const params = serialiseTraceViewState(start)
    expect(parseTraceViewState(`?${params.toString()}`)).toEqual(start)
  })

  test('drops selectedId when null', () => {
    const params = serialiseTraceViewState({
      ...DEFAULT_STATE,
      view: 'advanced',
      selectedId: null,
    })
    expect(params.has('ts')).toBe(false)
    expect(params.get('tv')).toBe('advanced')
  })
})
