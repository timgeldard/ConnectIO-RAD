import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, describe, vi, beforeEach } from 'vitest'
import { PlantProvider, usePlantSelection } from '../index'

function TestComponent() {
  const { selectedPlantId, plants, setSelectedPlantId } = usePlantSelection()
  return (
    <div>
      <div data-testid="selected">{selectedPlantId}</div>
      <div data-testid="count">{plants.length}</div>
      <button onClick={() => setSelectedPlantId('P2')}>Select P2</button>
    </div>
  )
}

describe('PlantProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  test('fetches and provides plants', async () => {
    const mockPlants = [
      { plant_id: 'P1', plant_name: 'Plant 1' },
      { plant_id: 'P2', plant_name: 'Plant 2' },
    ]
    
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ plants: mockPlants }),
    }))

    render(
      <PlantProvider appName="test">
        <TestComponent />
      </PlantProvider>
    )

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'))
    expect(screen.getByTestId('selected')).toHaveTextContent('P1')
  })

  test('uses stored plant id from localStorage', async () => {
    window.localStorage.setItem('connectio:test:plant-id', 'P2')
    const mockPlants = [
      { plant_id: 'P1', plant_name: 'Plant 1' },
      { plant_id: 'P2', plant_name: 'Plant 2' },
    ]
    
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ plants: mockPlants }),
    }))

    render(
      <PlantProvider appName="test">
        <TestComponent />
      </PlantProvider>
    )

    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('P2'))
  })

  test('updates selection and persists to localStorage', async () => {
    const user = userEvent.setup()
    const mockPlants = [
      { plant_id: 'P1', plant_name: 'Plant 1' },
      { plant_id: 'P2', plant_name: 'Plant 2' },
    ]
    
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ plants: mockPlants }),
    }))

    render(
      <PlantProvider appName="test">
        <TestComponent />
      </PlantProvider>
    )

    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('P1'))
    
    await user.click(screen.getByText('Select P2'))
    
    expect(screen.getByTestId('selected')).toHaveTextContent('P2')
    expect(window.localStorage.getItem('connectio:test:plant-id')).toBe('P2')
  })
})
