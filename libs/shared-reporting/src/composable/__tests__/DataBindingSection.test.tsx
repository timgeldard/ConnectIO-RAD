/* eslint-disable jsdoc/require-jsdoc */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { QueryRegistry } from '../../data/queryRegistry'
import { DataBindingSection } from '../propertyForms/DataBindingSection'

const queryRegistry: QueryRegistry = {
  'kpi.query': {
    key: 'kpi.query',
    label: 'KPI Query',
    description: 'KPI test query',
    endpoint: '/api/kpi',
    compatibleWidgets: ['kpi'],
    params: [],
    fields: [
      { path: 'value', label: 'Value', type: 'number' },
      { path: 'delta', label: 'Delta', type: 'string' },
      { path: 'status', label: 'Status', type: 'string', semantic: 'status' },
      { path: 'progressBar', label: 'Progress', type: 'number', semantic: 'percentage' },
    ],
  },
  'trend.query': {
    key: 'trend.query',
    label: 'Trend Query',
    description: 'Trend test query',
    endpoint: '/api/trend',
    compatibleWidgets: ['trend'],
    params: [],
    fields: [
      { path: 'daily_history', label: 'Daily history', type: 'array', semantic: 'timeseries' },
    ],
  },
  'bar.query': {
    key: 'bar.query',
    label: 'Bar Query',
    description: 'Bar test query',
    endpoint: '/api/bar',
    compatibleWidgets: ['bar'],
    params: [],
    fields: [
      { path: 'categories', label: 'Categories', type: 'array' },
      { path: 'series', label: 'Series', type: 'array' },
    ],
  },
  'pareto.query': {
    key: 'pareto.query',
    label: 'Pareto Query',
    description: 'Pareto test query',
    endpoint: '/api/pareto',
    compatibleWidgets: ['pareto'],
    params: [],
    fields: [
      { path: 'items', label: 'Items', type: 'array' },
    ],
  },
  'table.query': {
    key: 'table.query',
    label: 'Table Query',
    description: 'Table test query',
    endpoint: '/api/table',
    compatibleWidgets: ['drill-down-table'],
    params: [],
    fields: [
      { path: 'rows', label: 'Rows', type: 'array' },
    ],
  },
  'spc.query': {
    key: 'spc.query',
    label: 'SPC Query',
    description: 'SPC test query',
    endpoint: '/api/spc',
    compatibleWidgets: ['spc-control'],
    params: [],
    fields: [
      { path: 'points', label: 'Points', type: 'array' },
      { path: 'summary.limits', label: 'Limits', type: 'object' },
    ],
  },
}

describe('DataBindingSection default mappings', () => {
  it('creates KPI default mappings when a query is selected', () => {
    const onDataChange = vi.fn()

    render(
      <DataBindingSection
        widgetType="kpi"
        onDataChange={onDataChange}
        queryRegistry={queryRegistry}
        dashboardParams={{}}
        mappingFields={['value', 'delta', 'subtext', 'progressBar']}
      />,
    )

    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'kpi.query' } })

    expect(onDataChange).toHaveBeenCalledWith({
      queryKey: 'kpi.query',
      params: {},
      mapping: {
        value: 'value',
        delta: 'delta',
        subtext: 'status',
        progressBar: 'progressBar',
      },
    })
  })

  it('creates trend defaults with a timeseries transform', () => {
    const onDataChange = vi.fn()

    render(
      <DataBindingSection
        widgetType="trend"
        onDataChange={onDataChange}
        queryRegistry={queryRegistry}
        dashboardParams={{}}
        mappingFields={['points']}
        defaultMappingTransforms={{ points: 'timeseriesPoints' }}
      />,
    )

    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'trend.query' } })

    expect(onDataChange).toHaveBeenCalledWith({
      queryKey: 'trend.query',
      params: {},
      mapping: {
        points: { path: 'daily_history', transform: 'timeseriesPoints' },
      },
    })
  })

  it('creates bar, pareto, table, and spc defaults using the expected transforms', () => {
    const onBarChange = vi.fn()
    const onParetoChange = vi.fn()
    const onTableChange = vi.fn()
    const onSpcChange = vi.fn()

    const { unmount: unmountBar } = render(
      <DataBindingSection
        widgetType="bar"
        onDataChange={onBarChange}
        queryRegistry={queryRegistry}
        dashboardParams={{}}
        mappingFields={['categories', 'series']}
        defaultMappingTransforms={{ series: 'barSeries' }}
      />,
    )
    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'bar.query' } })
    expect(onBarChange).toHaveBeenCalledWith({
      queryKey: 'bar.query',
      params: {},
      mapping: {
        categories: 'categories',
        series: { path: 'series', transform: 'barSeries' },
      },
    })
    unmountBar()

    const { unmount: unmountPareto } = render(
      <DataBindingSection
        widgetType="pareto"
        onDataChange={onParetoChange}
        queryRegistry={queryRegistry}
        dashboardParams={{}}
        mappingFields={['items']}
        defaultMappingTransforms={{ items: 'paretoItems' }}
      />,
    )
    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'pareto.query' } })
    expect(onParetoChange).toHaveBeenCalledWith({
      queryKey: 'pareto.query',
      params: {},
      mapping: {
        items: { path: 'items', transform: 'paretoItems' },
      },
    })
    unmountPareto()

    const { unmount: unmountTable } = render(
      <DataBindingSection
        widgetType="drill-down-table"
        onDataChange={onTableChange}
        queryRegistry={queryRegistry}
        dashboardParams={{}}
        mappingFields={['rows']}
        defaultMappingTransforms={{ rows: 'tableRows' }}
      />,
    )
    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'table.query' } })
    expect(onTableChange).toHaveBeenCalledWith({
      queryKey: 'table.query',
      params: {},
      mapping: {
        rows: { path: 'rows', transform: 'tableRows' },
      },
    })
    unmountTable()

    render(
      <DataBindingSection
        widgetType="spc-control"
        onDataChange={onSpcChange}
        queryRegistry={queryRegistry}
        dashboardParams={{}}
        mappingFields={['points', 'limits']}
        defaultMappingTransforms={{ points: 'spcPoints', limits: 'spcLimits' }}
      />,
    )
    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'spc.query' } })
    expect(onSpcChange).toHaveBeenCalledWith({
      queryKey: 'spc.query',
      params: {},
      mapping: {
        points: { path: 'points', transform: 'spcPoints' },
        limits: { path: 'summary.limits', transform: 'spcLimits' },
      },
    })
  })
})
