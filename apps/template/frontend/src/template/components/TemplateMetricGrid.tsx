import type { Metric } from '../types'

interface TemplateMetricGridProps {
  metrics: Metric[]
}

/** Metric grid for Template Module. */
export function TemplateMetricGrid({ metrics }: TemplateMetricGridProps) {
  return (
    <section className="rad-metric-grid" aria-label="Template Module metrics" data-testid="template-metric-grid">
      {metrics.map((metric) => (
        <article className="rad-metric" key={metric.name} data-testid="template-metric-card">
          <span>{metric.name.replaceAll('_', ' ')}</span>
          <strong data-testid="template-metric-value">{metric.value}</strong>
          <small>{metric.unit}</small>
        </article>
      ))}
    </section>
  )
}
