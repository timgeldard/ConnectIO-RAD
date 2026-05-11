/* eslint-disable jsdoc/require-jsdoc */
import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import App from '../App'
import React from 'react'

// Mock API
vi.mock('../data/api', () => ({
  fetchBatchHeader: vi.fn(() => Promise.resolve({
    batch: {
      material_id: 'M1',
      material_name: 'Material 1',
      material_desc40: 'Material 1',
      batch_id: 'B1',
      process_order: 'PO1',
      plant_id: 'P1',
      plant_name: 'Plant 1',
      manufacture_date: '01 Jan 2026',
      expiry_date: '01 Jan 2027',
      days_to_expiry: 365,
      shelf_life_status: 'OK',
      batch_status: 'UNRESTRICTED',
      uom: 'KG',
      qty_produced: 100,
      qty_shipped: 0,
      qty_consumed: 0,
      qty_adjusted: 0,
      current_stock: 100,
      variance: 0,
      mass_balance_kg: 100,
      unrestricted: 100,
      blocked: 0,
      qi: 0,
      transit: 0,
      restricted: 0,
      customers_affected: 0,
      countries_affected: 0,
      total_shipped_kg: 0,
      total_deliveries: 0,
      total_consumed: 0,
      consuming_pos: 0,
    },
  }))
}))

// Mock sub-pages to avoid massive dependency chain
vi.mock('../pages/Overview', () => ({ PageOverview: () => <div data-testid="page-overview" /> }))
vi.mock('../pages/SupplierRisk', () => ({ PageSupplierRisk: () => <div data-testid="page-suppliers" /> }))

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/?demo=1')
  })

  it('renders and allows navigation', async () => {
    render(<App />)
    
    // Default page
    expect(await screen.findByTestId('page-overview')).toBeInTheDocument()
    
    // Click Suppliers in sidebar
    fireEvent.click(screen.getByText('Suppliers'))
    expect(screen.getByTestId('page-suppliers')).toBeInTheDocument()
  })

  it('does not render demo trace data without an explicit demo flag or live context', () => {
    window.history.replaceState({}, '', '/')

    render(<App />)

    expect(screen.getByText('Select a live batch')).toBeInTheDocument()
    expect(screen.queryByTestId('page-overview')).not.toBeInTheDocument()
  })
})
