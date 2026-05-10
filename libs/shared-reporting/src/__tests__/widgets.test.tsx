import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createWidgetRegistry } from '../core/registry'
import { BarChartWidget } from '../widgets/BarChartWidget'
import { ParetoChartWidget } from '../widgets/ParetoChartWidget'
import { SPCControlChartWidget } from '../widgets/SPCControlChartWidget'
import { DrillDownTableWidget } from '../widgets/DrillDownTableWidget'
import { dashboardConfigSchema, widgetConfigSchema } from '../schema/config'
import { ReportingDashboard } from '../core/ReportingDashboard'

const makeConfig = (overrides: { id?: string; type?: string; title?: string } = {}) =>
  widgetConfigSchema.parse({ id: 'w1', type: 'x', ...overrides })

describe('BarChartWidget', () => {
  it('renders empty state when no data', () => {
    render(<BarChartWidget config={makeConfig()} props={{}} />)
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('renders chart when categories and series are provided', () => {
    render(
      <BarChartWidget
        config={makeConfig({ title: 'Defects by line' })}
        props={{
          categories: ['Line A', 'Line B'],
          series: [{ name: 'Defects', data: [10, 20] }],
        }}
      />,
    )
    expect(screen.getByText('Defects by line')).toBeTruthy()
  })
})

describe('ParetoChartWidget', () => {
  it('renders empty state when no items', () => {
    render(<ParetoChartWidget config={makeConfig()} props={{}} />)
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('renders chart with sorted items', () => {
    render(
      <ParetoChartWidget
        config={makeConfig({ title: 'Top defects' })}
        props={{
          items: [
            { label: 'Minor', value: 5 },
            { label: 'Major', value: 40 },
            { label: 'Critical', value: 15 },
          ],
        }}
      />,
    )
    expect(screen.getByText('Top defects')).toBeTruthy()
  })
})

describe('SPCControlChartWidget', () => {
  it('renders empty state when no points', () => {
    render(<SPCControlChartWidget config={makeConfig()} props={{}} />)
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('renders chart when points and limits are provided', () => {
    render(
      <SPCControlChartWidget
        config={makeConfig({ title: 'Moisture %' })}
        props={{
          points: [
            { label: 'B001', value: 2.1 },
            { label: 'B002', value: 2.4, signal: true },
            { label: 'B003', value: 1.9 },
          ],
          limits: { ucl: 3.0, cl: 2.0, lcl: 1.0 },
        }}
      />,
    )
    expect(screen.getByText('Moisture %')).toBeTruthy()
  })
})

describe('DrillDownTableWidget', () => {
  it('renders empty state when no rows', () => {
    render(
      <DrillDownTableWidget
        config={makeConfig()}
        props={{ columns: [{ key: 'id', label: 'ID' }], rows: [] }}
      />,
    )
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('renders table rows and column headers', () => {
    render(
      <DrillDownTableWidget
        config={makeConfig({ title: 'Batches' })}
        props={{
          columns: [
            { key: 'batch', label: 'Batch' },
            { key: 'result', label: 'Result', align: 'right' },
          ],
          rows: [
            { batch: 'B001', result: 'Pass' },
            { batch: 'B002', result: 'Fail' },
          ],
        }}
      />,
    )
    expect(screen.getByText('Batch')).toBeTruthy()
    expect(screen.getByText('B001')).toBeTruthy()
    expect(screen.getByText('Fail')).toBeTruthy()
  })
})

describe('ReportingDashboard with new widgets', () => {
  it('renders bar and drill-down-table widgets via registry', () => {
    const registry = createWidgetRegistry({
      bar: BarChartWidget,
      'drill-down-table': DrillDownTableWidget,
    })
    const config = dashboardConfigSchema.parse({
      id: 'test',
      title: 'Test dashboard',
      widgets: [
        {
          id: 'w-bar',
          type: 'bar',
          title: 'Bar chart',
          props: {
            categories: ['A', 'B'],
            series: [{ name: 'Count', data: [3, 7] }],
          },
          layout: { colSpan: 6 },
        },
        {
          id: 'w-table',
          type: 'drill-down-table',
          title: 'Table',
          props: {
            columns: [{ key: 'name', label: 'Name' }],
            rows: [{ name: 'Row 1' }],
          },
          layout: { colSpan: 6 },
        },
      ],
    })

    render(<ReportingDashboard config={config} registry={registry} />)
    expect(screen.getByText('Bar chart')).toBeTruthy()
    expect(screen.getByText('Table')).toBeTruthy()
    expect(screen.getByText('Row 1')).toBeTruthy()
  })
})
