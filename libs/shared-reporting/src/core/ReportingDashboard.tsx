import type { CSSProperties } from 'react'
import { dashboardConfigSchema } from '../schema/config'
import type { DashboardConfig } from './types'
import type { WidgetRegistry } from './registry'

/** Props for the ReportingDashboard grid renderer. */
export interface ReportingDashboardProps {
  /** Validated dashboard configuration including layout and widget list. */
  config: DashboardConfig
  /** Widget registry mapping type keys to render components. */
  registry: WidgetRegistry
  /** Keyed data bag passed to individual widgets by their `id`. */
  data?: Record<string, unknown>
}

/**
 * Renders a validated `DashboardConfig` as a responsive CSS-grid dashboard.
 * Uses `safeParse` to surface invalid config as an inline error rather than throwing.
 */
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
