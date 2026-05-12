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
vi.mock('../pages/Overview', () => ({
  // Expose openGenie via a button so we can exercise the App-level
  // seeded-open + close flow without mounting the full lineage graph.
  PageOverview: ({ openGenie }: { openGenie?: (opts: { prompt: string; pageContext: unknown }) => void }) => (
    <div data-testid="page-overview">
      <button
        type="button"
        data-testid="trigger-explain"
        onClick={() =>
          openGenie?.({
            prompt: 'Explain transfer X',
            pageContext: {
              mode: 'lineage_transfer',
              view: 'overview',
              focal: { material_id: 'M1', material: 'Material 1', batch_id: 'B1', plant: 'Plant 1' },
              selected: {
                material_id: 'M2',
                material: 'Upstream',
                batch_id: 'B2',
                plant: 'P2',
                link: 'INPUT_OF',
                side: 'upstream',
                flow_qty: 10,
                qty: 10,
                uom: 'KG',
              },
            },
          })
        }
      >
        explain
      </button>
    </div>
  ),
}))
vi.mock('../pages/SupplierRisk', () => ({ PageSupplierRisk: () => <div data-testid="page-suppliers" /> }))

// Mock the conversation hook so the drawer doesn't try to talk to a
// backend during the test.
vi.mock('../genie/useGenieConversation', () => ({
  useGenieConversation: () => ({
    turns: [],
    thinking: false,
    error: null,
    ask: vi.fn(),
    reset: vi.fn(),
  }),
}))

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

  it('openGenie opens the drawer with a seeded prompt; handleGenieClose closes it', async () => {
    render(<App />)

    // Wait for the Overview page (which now hosts the explain trigger).
    const trigger = await screen.findByTestId('trigger-explain')

    // Drawer is closed at startup.
    expect(screen.queryByTestId('trace2-genie-drawer')).not.toBeInTheDocument()

    // Fire the openGenie callback from a deep child — App's openGenie()
    // must set the seed prompt + override context and open the drawer.
    // We observe the seed by reading the textarea: the drawer's
    // open-with-initialPrompt effect hydrates it.
    fireEvent.click(trigger)
    expect(await screen.findByTestId('trace2-genie-drawer')).toBeInTheDocument()
    const textarea = (await screen.findByPlaceholderText(/ask about this batch/i)) as HTMLTextAreaElement
    expect(textarea.value).toBe('Explain transfer X')

    // Close the drawer via the dedicated Close button — App's
    // handleGenieClose() must hide the drawer (it also clears seed +
    // override, but that side-effect is non-observable here because
    // GenieDrawer preserves textarea drafts across close/reopen).
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByTestId('trace2-genie-drawer')).not.toBeInTheDocument()
  })

  it('does not render demo trace data without an explicit demo flag or live context', () => {
    window.history.replaceState({}, '', '/')

    render(<App />)

    expect(screen.getByText('Select a live batch')).toBeInTheDocument()
    expect(screen.queryByTestId('page-overview')).not.toBeInTheDocument()
  })
})
