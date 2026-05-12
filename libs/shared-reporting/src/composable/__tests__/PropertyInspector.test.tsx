/* eslint-disable jsdoc/require-jsdoc */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { PropertyInspector } from '../PropertyInspector'
import { useDashboardEditStore } from '../store'

// Mock the store
vi.mock('../store', () => ({
  useDashboardEditStore: vi.fn(),
}))

describe('PropertyInspector', () => {
  const mockUpdateWidgetTitle = vi.fn()
  const mockUpdateWidgetProps = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks();
    (useDashboardEditStore as any).mockReturnValue({
      updateWidgetTitle: mockUpdateWidgetTitle,
      updateWidgetProps: mockUpdateWidgetProps,
    })
  })

  it('renders title input and updates title', () => {
    const widget = {
      id: 'w1',
      type: 'kpi',
      title: 'Initial Title',
      layout: { x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
      props: {},
    }

    render(<PropertyInspector widget={widget} />)

    const titleInput = screen.getByLabelText('Widget title')
    expect(titleInput).toHaveValue('Initial Title')

    fireEvent.change(titleInput, { target: { value: 'New Title' } })
    expect(mockUpdateWidgetTitle).toHaveBeenCalledWith('w1', 'New Title')
  })

  it('renders KPI form for kpi widget type', () => {
    const widget = {
      id: 'w1',
      type: 'kpi',
      title: 'KPI',
      layout: { x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
      props: { label: 'Metric A', value: 100 },
    }

    render(<PropertyInspector widget={widget} />)

    // Check if KPI form fields are present
    expect(screen.getByText('Label')).toBeTruthy()
    expect(screen.getByText('Value')).toBeTruthy()
    expect(screen.getByDisplayValue('Metric A')).toBeTruthy()
    expect(screen.getByDisplayValue('100')).toBeTruthy()
  })

  it('updates props when KPI form fields change', () => {
    const widget = {
      id: 'w1',
      type: 'kpi',
      title: 'KPI',
      layout: { x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
      props: { label: 'Old Label' },
    }

    render(<PropertyInspector widget={widget} />)

    const labelInput = screen.getByDisplayValue('Old Label')
    fireEvent.change(labelInput, { target: { value: 'New Label' } })

    expect(mockUpdateWidgetProps).toHaveBeenCalledWith('w1', { label: 'New Label' })
  })

  it('shows advanced JSON editor when toggled', () => {
    const widget = {
      id: 'w1',
      type: 'kpi',
      title: 'KPI',
      layout: { x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
      props: { custom: 'value' },
    }

    render(<PropertyInspector widget={widget} />)

    // Advanced should be hidden by default
    expect(screen.queryByLabelText('Widget props JSON')).toBeNull()

    const toggle = screen.getByText(/Show Advanced/)
    fireEvent.click(toggle)

    const jsonEditor = screen.getByLabelText('Widget props JSON') as HTMLTextAreaElement
    expect(jsonEditor).toBeTruthy()
    expect(jsonEditor.value).toContain('"custom": "value"')
  })

  it('displays message for unsupported widget types in visual editor', () => {
    const widget = {
      id: 'w1',
      type: 'unknown',
      title: 'Unknown',
      layout: { x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
      props: {},
    }

    render(<PropertyInspector widget={widget} />)

    expect(screen.getByText(/Visual editor for/)).toBeInTheDocument()
    // The type 'unknown' is inside a <code> tag, so we use a custom matcher
    expect(screen.getByText((content, element) => {
      const hasText = (node: Element | null) => node?.textContent === 'Visual editor for unknown coming soon. Use Advanced mode below.'
      const nodeHasText = hasText(element)
      const childrenDontHaveText = Array.from(element?.children || []).every(child => !hasText(child as Element))
      return nodeHasText && childrenDontHaveText
    })).toBeInTheDocument()
  })
})
