import type { CSSProperties } from 'react'
import { dashboardConfigSchema } from '../schema/config'
import type { DashboardConfig } from './types'
import type { WidgetRegistry } from './registry'

/**
 * Props for the CodexDashboard layout component.
 * @property config - Declarative dashboard configuration (layout, widgets, filters).
 * @property registry - Widget registry mapping type keys to renderable components.
 * @property data - Per-widget data payload keyed by widget id.
 */
export interface CodexDashboardProps {
  config: DashboardConfig
  registry: WidgetRegistry
  data?: Record<string, unknown>
}

/**
 * Renders a responsive CSS grid dashboard from a declarative config, resolving
 * each widget type against the provided registry.
 * @returns A grid section with one article per widget; unknown types render a
 *          live-region fallback rather than throwing.
 */
export function CodexDashboard({ config, registry, data = {} }: CodexDashboardProps) {
  const dashboard = dashboardConfigSchema.parse(config)
  const columns = dashboard.layout.columns

  return (
    <section
      aria-label={dashboard.title}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: dashboard.layout.gap,
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
