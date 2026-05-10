import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CodexDashboard } from '../core/CodexDashboard'
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

    render(<CodexDashboard config={config} registry={createDefaultReportingRegistry()} />)

    expect(screen.getByText('Orders running')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
  })

  it('renders an explicit placeholder for unknown widget types', () => {
    const config = dashboardConfigSchema.parse({
      id: 'pilot',
      title: 'Pilot dashboard',
      widgets: [{ id: 'missing', type: 'future-widget' }],
    })

    render(<CodexDashboard config={config} registry={createDefaultReportingRegistry()} />)

    expect(screen.getByText('Unknown widget type: future-widget')).toBeTruthy()
  })
})
