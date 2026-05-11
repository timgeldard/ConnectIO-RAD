/* eslint-disable jsdoc/require-jsdoc */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from '../App'

// Mock context and shared components
vi.mock('~/context/PlantContext', () => ({
  PlantProvider: ({ children }: any) => <div>{children}</div>,
  usePlantSelection: () => ({
    plants: [{ plant_id: 'P1', plant_name: 'Plant 1' }],
    selectedPlantId: 'P1',
    setSelectedPlantId: vi.fn(),
    loading: false,
  })
}))

vi.mock('@connectio/shared-ui', async () => {
  const actual = await vi.importActual('@connectio/shared-ui')
  return {
    ...actual,
    PlatformShell: ({ children, onModuleChange }: any) => (
      <div>
        <button onClick={() => onModuleChange('imwm')}>IMWM</button>
        {children}
      </div>
    )
  }
})

// Mock sub-pages
vi.mock('../components/ControlTower', () => ({
  ControlTower: ({ onNav }: any) => (
    <div>
      <div data-testid="page-today">Control Tower</div>
      <button onClick={() => onNav('staging')}>Go Staging</button>
    </div>
  )
}))
vi.mock('../components/ProductionStaging', () => ({
  ProductionStaging: () => <div data-testid="page-staging">Production Staging</div>
}))
vi.mock('../components/IMWMCockpit', () => ({
  IMWMCockpit: () => <div data-testid="page-imwm">IMWM Cockpit</div>
}))

describe('Warehouse360 App', () => {
  it('renders Control Tower by default', () => {
    render(<App />)
    expect(screen.getByTestId('page-today')).toBeDefined()
  })

  it('navigates to staging when handleNav is called', () => {
    render(<App />)
    const btn = screen.getByText('Go Staging')
    fireEvent.click(btn)
    expect(screen.getByTestId('page-staging')).toBeDefined()
  })

  it('changes module when sidebar is used', () => {
    render(<App />)
    
    // Simulate sidebar module change (PlatformShell calls onModuleChange)
    // We need to find the sidebar button for IMWM
    const imwmBtn = screen.getByText('IMWM', { selector: 'button' })
    fireEvent.click(imwmBtn)
    
    expect(screen.getByTestId('page-imwm')).toBeDefined()
  })
})
