import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SPCFilterBar from '../SPCFilterBar'
import type { SPCState } from '../types'

let mockState: Pick<
  SPCState,
  | 'selectedMaterial'
  | 'selectedPlant'
  | 'selectedMIC'
  | 'selectedMultivariateMicIds'
  | 'processFlowUpstreamDepth'
  | 'processFlowDownstreamDepth'
  | 'dateFrom'
  | 'dateTo'
  | 'stratifyBy'
>

const dispatch = vi.fn()

vi.mock('../SPCContext', () => ({
  shallowEqual: (a: unknown, b: unknown) => a === b,
  useSPCDispatch: () => dispatch,
  useSPCSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}))

vi.mock('../hooks/useMaterials', () => ({
  useValidateMaterial: () => ({
    validateMaterial: vi.fn(),
    clearError: vi.fn(),
    validating: false,
    error: null,
  }),
}))

vi.mock('../hooks/usePlants', () => ({
  usePlants: () => ({
    plants: [
      { plant_id: 'PLANT-1', plant_name: 'Plant 1' },
      { plant_id: 'PLANT-2', plant_name: 'Plant 2' },
      { plant_id: 'PLANT-3', plant_name: 'Plant 3' },
    ],
    loading: false,
  }),
}))

vi.mock('../hooks/useCharacteristics', () => ({
  useCharacteristics: () => ({
    characteristics: [
      { mic_id: 'MIC-1', mic_name: 'Moisture', chart_type: 'imr', operation_id: 'OP-1' },
      { mic_id: 'MIC-2', mic_name: 'Temperature', chart_type: 'imr', operation_id: 'OP-2' },
    ],
    attrCharacteristics: [],
    loading: false,
  }),
}))

vi.mock('../hooks/useRecentMaterials', () => ({
  getRecentMaterials: () => [],
  addRecentMaterial: vi.fn(),
}))

vi.mock('../components/FieldHelp', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('SPCFilterBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    dispatch.mockReset()
    mockState = {
      selectedMaterial: { material_id: 'MAT-1', material_name: 'Material 1' },
      selectedPlant: { plant_id: 'PLANT-1', plant_name: 'Plant 1' },
      selectedMIC: null,
      selectedMultivariateMicIds: [],
      processFlowUpstreamDepth: 4,
      processFlowDownstreamDepth: 3,
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      stratifyBy: null,
    }
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('commits plant selection immediately', () => {
    render(<SPCFilterBar embedded />)
    dispatch.mockClear()

    fireEvent.change(screen.getByLabelText('Plant'), { target: { value: 'PLANT-2' } })

    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_PLANT',
      payload: { plant_id: 'PLANT-2', plant_name: 'Plant 2' },
    })
  })

  it('keeps only the last selected plant in immediate commit mode', () => {
    render(<SPCFilterBar embedded />)
    dispatch.mockClear()

    const plantSelect = screen.getByLabelText('Plant')
    fireEvent.change(plantSelect, { target: { value: 'PLANT-2' } })
    fireEvent.change(plantSelect, { target: { value: 'PLANT-3' } })

    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'SET_PLANT',
      payload: { plant_id: 'PLANT-3', plant_name: 'Plant 3' },
    })
  })

  it('debounces date changes before dispatching', () => {
    render(<SPCFilterBar embedded />)
    dispatch.mockClear()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-02-01' } })

    expect(dispatch).not.toHaveBeenCalled()

    vi.advanceTimersByTime(299)
    expect(dispatch).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_DATE_FROM',
      payload: '2026-02-01',
    })
  })

  it('filters the MIC options with the search box', () => {
    render(<SPCFilterBar embedded />)

    fireEvent.change(screen.getByLabelText('Filter characteristics'), { target: { value: 'temp' } })

    expect(screen.getByRole('option', { name: /temperature/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /moisture/i })).not.toBeInTheDocument()
  })
})
