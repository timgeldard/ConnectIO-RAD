import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from '../App'
import React from 'react'

// Mock API
vi.mock('../data/api', () => ({
  fetchBatchHeader: vi.fn(() => Promise.resolve({ material_id: 'M1', batch_id: 'B1' }))
}))

// Mock sub-pages to avoid massive dependency chain
vi.mock('../pages/Overview', () => ({ PageOverview: () => <div data-testid="page-overview" /> }))
vi.mock('../pages/SupplierRisk', () => ({ PageSupplierRisk: () => <div data-testid="page-suppliers" /> }))

describe('App', () => {
  it('renders and allows navigation', async () => {
    render(<App />)
    
    // Default page
    expect(await screen.findByTestId('page-overview')).toBeInTheDocument()
    
    // Click Suppliers in sidebar
    fireEvent.click(screen.getByText('Suppliers'))
    expect(screen.getByTestId('page-suppliers')).toBeInTheDocument()
  })
})
