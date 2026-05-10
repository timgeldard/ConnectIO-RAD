import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportingDashboard } from '../core/ReportingDashboard'
import { createDefaultReportingRegistry } from '../widgets/defaultRegistry'
import { dashboardConfigSchema } from '../schema/config'

describe('shared-reporting dashboard skeleton', () => {
  it('validates and renders a KPI widget from dashboard config', () => {
    const config = dashboardConfigSchema.parse({
      id: 'pilot',
      title: 'Pilot dashboard',
      widgets: [
        {
          id: 'orders',
          type: 'kpi',
          title: 'Orders running',
          props: { value: 12, tone: 'ok' },
          layout: { colSpan: 3 },
        },
      ],
    })

    render(<ReportingDashboard config={config} registry={createDefaultReportingRegistry()} />)

    expect(screen.getByText('Orders running')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
  })

  it('renders an error fallback when config fails validation', () => {
    render(
      <ReportingDashboard
        // @ts-expect-error intentionally invalid config for test
        config={{ id: '', title: '' }}
        registry={createDefaultReportingRegistry()}
      />,
    )

    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('renders an explicit placeholder for unknown widget types', () => {
    const config = dashboardConfigSchema.parse({
      id: 'pilot',
      title: 'Pilot dashboard',
      widgets: [{ id: 'missing', type: 'future-widget' }],
    })

    render(<ReportingDashboard config={config} registry={createDefaultReportingRegistry()} />)

    expect(screen.getByText('Unknown widget type: future-widget')).toBeTruthy()
  })

  it('uses auto-fit grid when minColumnWidth is set', () => {
    const config = dashboardConfigSchema.parse({
      id: 'responsive',
      title: 'Responsive dashboard',
      layout: { minColumnWidth: 200 },
      widgets: [{ id: 'w1', type: 'kpi', title: 'KPI', props: { value: 1 } }],
    })

    const { container } = render(
      <ReportingDashboard config={config} registry={createDefaultReportingRegistry()} />,
    )

    const section = container.querySelector('section[aria-label="Responsive dashboard"]')
    expect(section).toBeTruthy()
    expect((section as HTMLElement).style.gridTemplateColumns).toBe(
      'repeat(auto-fit, minmax(200px, 1fr))',
    )
  })
})
