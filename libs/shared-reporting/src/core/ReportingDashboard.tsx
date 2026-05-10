import type { CSSProperties } from 'react'
import { dashboardConfigSchema } from '../schema/config'
import type { DashboardConfig } from './types'
import type { WidgetRegistry } from './registry'

export interface ReportingDashboardProps {
  config: DashboardConfig
  registry: WidgetRegistry
  data?: Record<string, unknown>
}

/** Renders a responsive CSS grid dashboard from a declarative config. */
export function ReportingDashboard({ config, registry, data = {} }: ReportingDashboardProps) {
  const result = dashboardConfigSchema.safeParse(config)

  if (!result.success) {
    return (
      <section role="alert" aria-live="assertive">
        Invalid dashboard config: {result.error.issues.map(i => i.message).join('; ')}
      </section>
    )
  }

  const dashboard = result.data
  const { columns, gap, minColumnWidth } = dashboard.layout
  const gridTemplateColumns = minColumnWidth
    ? `repeat(auto-fit, minmax(${minColumnWidth}px, 1fr))`
    : `repeat(${columns}, minmax(0, 1fr))`

  return (
    <section
      aria-label={dashboard.title}
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap: `${gap}px`,
      }}
    >
      {dashboard.widgets.map((widget) => {
        const Widget = registry.get(widget.type)
        const colSpan = Math.min(widget.layout.colSpan ?? columns, columns)
        const style: CSSProperties = { gridColumn: `span ${colSpan}` }

        if (!Widget) {
          return (
            <article key={widget.id} style={style} role="status" aria-live="polite">
              Unknown widget type: {widget.type}
            </article>
          )
        }

        return (
          <article key={widget.id} style={style}>
            <Widget config={widget} props={widget.props} data={data[widget.id]} />
          </article>
        )
      })}
    </section>
  )
}
