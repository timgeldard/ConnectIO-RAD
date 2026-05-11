/* eslint-disable jsdoc/require-jsdoc */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TrendChartWidget } from '../widgets/TrendChartWidget'

vi.mock('echarts-for-react/lib/core', () => ({
  default: ({ option }: { option: unknown }) => (
    <div data-testid="echarts-core">{JSON.stringify(option)}</div>
  ),
}))

describe('TrendChartWidget', () => {
  it('renders trend data through the shared EChart wrapper', () => {
    const props = {
      valueLabel: 'Yield',
      points: [
        { label: 'Jan', value: 92 },
        { label: 'Feb', value: 95 },
      ],
    }

    render(
      <TrendChartWidget
        config={{
          id: 'yield-trend',
          type: 'trend',
          title: 'Yield trend',
          props,
          interactions: [],
          layout: {},
        }}
        props={props}
      />,
    )

    expect(screen.getByText('Yield trend')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Yield trend' })).toBeTruthy()
    expect(screen.getByTestId('echarts-core').textContent).toContain('Jan')
    expect(screen.getByTestId('echarts-core').textContent).toContain('95')
  })

  it('renders an empty state when no points are available', () => {
    render(
      <TrendChartWidget
        config={{
          id: 'yield-trend',
          type: 'trend',
          title: 'Yield trend',
          props: {},
          interactions: [],
          layout: {},
        }}
        props={{}}
      />,
    )

    expect(screen.getByRole('status').textContent).toBe('No trend data available.')
  })
})
