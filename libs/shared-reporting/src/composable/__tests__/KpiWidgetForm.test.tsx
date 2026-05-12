/* eslint-disable jsdoc/require-jsdoc */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { KpiWidgetForm } from '../propertyForms/KpiWidgetForm'
import type { QueryRegistry } from '../../data/queryRegistry'

const mockRegistry: QueryRegistry = {
  'q1': {
    key: 'q1',
    label: 'Query 1',
    endpoint: '/api/q1',
    compatibleWidgets: ['kpi'],
    params: [
      { key: 'p1', label: 'Param 1', type: 'string', defaultValue: 'def' },
    ],
    fields: [
      { path: 'f1', label: 'Field 1', type: 'number' },
    ],
  },
}

describe('KpiWidgetForm Binding', () => {
  it('switches between static and data binding tabs', () => {
    const onDataChange = vi.fn()
    render(
      <KpiWidgetForm
        widgetId="w1"
        props={{ label: 'Static' }}
        data={null}
        onChange={vi.fn()}
        onDataChange={onDataChange}
        queryRegistry={mockRegistry}
      />
    )

    expect(screen.getByText('Static')).toHaveStyle('background: var(--surface-1)')
    
    fireEvent.click(screen.getByText('Data Binding'))
    expect(screen.getByText('Query')).toBeTruthy()
  })

  it('updates data binding when a query is selected', () => {
    const onDataChange = vi.fn()
    render(
      <KpiWidgetForm
        widgetId="w1"
        props={{}}
        data={null}
        onChange={vi.fn()}
        onDataChange={onDataChange}
        queryRegistry={mockRegistry}
      />
    )

    fireEvent.click(screen.getByText('Data Binding'))
    
    const querySelect = screen.getByLabelText('Query')
    fireEvent.change(querySelect, { target: { value: 'q1' } })

    expect(onDataChange).toHaveBeenCalledWith({
      queryKey: 'q1',
      params: { p1: { value: 'def' } },
      mapping: {},
    })
  })

  it('updates mapping when a field is selected', () => {
    const onDataChange = vi.fn()
    const existingData = {
      queryKey: 'q1',
      params: {},
      mapping: {},
    }

    render(
      <KpiWidgetForm
        widgetId="w1"
        props={{}}
        data={existingData}
        onChange={vi.fn()}
        onDataChange={onDataChange}
        queryRegistry={mockRegistry}
      />
    )

    // Should already be on data tab because data is present
    const valueMappingSelect = screen.getByLabelText('value')
    fireEvent.change(valueMappingSelect, { target: { value: 'f1' } })

    expect(onDataChange).toHaveBeenCalledWith({
      ...existingData,
      mapping: { value: 'f1' },
    })
  })
})
