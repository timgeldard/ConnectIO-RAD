import type { Metric } from '../types'

interface TemplateMetricGridProps {
  metrics: Metric[]
}

/** Metric grid for Template Module. */
export function TemplateMetricGrid({ metrics }: TemplateMetricGridProps) {
  return (
    <section className="rad-metric-grid" aria-label="Template Module metrics">
      {metrics.map((metric) => (
        <article className="rad-metric" key={metric.name}>
          <span>{metric.name.replaceAll('_', ' ')}</span>
          <strong>{metric.value}</strong>
          <small>{metric.unit}</small>
        </article>
      ))}
    </section>
  )
}
