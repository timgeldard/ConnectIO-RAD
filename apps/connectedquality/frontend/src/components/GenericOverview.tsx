import { Card } from '~/components/Card'
import { KPI } from '~/components/KPI'
import { PageHead } from '~/components/PageHead'
import { Icon } from '~/components/Icon'
import type { KpiTone } from '~/components/KPI'

interface KpiSpec {
  label: string
  value: string
  unit?: string
  tone?: KpiTone
  sub?: string
}

interface PanelSpec {
  num: string
  title: string
  meta: string
  body: string
}

interface GenericOverviewProps {
  eyebrow: string
  title: string
  desc: string
  kpis: KpiSpec[]
  panels: PanelSpec[]
}

/**
 * Reusable placeholder layout for module pages not yet fully implemented.
 * Renders KPI row + two text panels so the page is immediately useful as
 * a structural scaffold rather than an empty screen.
 */
export function GenericOverview({ eyebrow, title, desc, kpis, panels }: GenericOverviewProps) {
  return (
    <div className="cq-page">
      <PageHead
        eyebrow={eyebrow}
        title={title}
        desc={desc}
        actions={
          <button className="cq-btn"><Icon name="dl" size={12} /> Export</button>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 10, marginBottom: 14 }}>
        {kpis.map((k, i) => (
          <KPI key={i} label={k.label} value={k.value} unit={k.unit} tone={k.tone} sub={k.sub} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {panels.map((p, i) => (
          <Card key={i} title={p.title} num={p.num} meta={p.meta}>
            <div style={{ fontSize: 12.5, color: 'var(--cq-fg-2)', lineHeight: 1.55, fontFamily: 'var(--font-serif)' }}>
              {p.body}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
