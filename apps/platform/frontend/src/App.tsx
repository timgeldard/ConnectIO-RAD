import { useState, useEffect } from 'react'

interface CardStat {
  value: string
  label: string
  tone?: 'good' | 'warn' | 'bad'
}

interface ModuleCard {
  moduleId: string
  displayName: string
  tag: string
  desc: string
  color: string
  stats: CardStat[]
  /** Direct href — used for standalone apps. */
  href?: string
  /** App base path — combined with ?module=<moduleId> for platform-integrated apps. */
  appBase?: string
}

const QUALITY_CARDS: ModuleCard[] = [
  {
    moduleId: 'trace',
    displayName: 'Trace',
    tag: 'Batch traceability · 6 views',
    desc: 'Forward + reverse trace, mass balance, recall readiness, supplier risk and CoA across every batch in the gold layer.',
    color: '#005776',
    stats: [
      { value: '1,284', label: 'Active batches' },
      { value: '3',     label: 'Recall flags',   tone: 'bad' },
      { value: '99.2%', label: 'Trace coverage', tone: 'good' },
    ],
    appBase: '/cq',
  },
  {
    moduleId: 'envmon',
    displayName: 'EnvMon',
    tag: 'Environmental monitoring · 4 views',
    desc: 'Spatial heatmaps and time-lapse for MIC inspections, with SPC-driven early warnings and blast-radius vector swabbing.',
    color: '#289BA2',
    stats: [
      { value: '47', label: 'Sites' },
      { value: '12', label: 'Warnings',   tone: 'warn' },
      { value: '2',  label: 'Open fails', tone: 'bad' },
    ],
    appBase: '/cq',
  },
  {
    moduleId: 'spc',
    displayName: 'SPC',
    tag: 'Statistical process control · 5 views',
    desc: 'I-MR, X̄-R, EWMA, CUSUM, P-charts and Hotelling T². Capability indices with confidence intervals, WECO + Nelson rule detection.',
    color: '#F24A00',
    stats: [
      { value: '318',  label: 'Charts live' },
      { value: '5',    label: 'OOC signals', tone: 'warn' },
      { value: '1.41', label: 'Avg Cpk',     tone: 'good' },
    ],
    appBase: '/cq',
  },
  {
    moduleId: 'lab',
    displayName: 'Lab Board',
    tag: 'Quality lab wallboard',
    desc: 'Live lab results wallboard for in-process quality checks, finished-goods testing, and CoA status across all active batches.',
    color: '#143C5A',
    stats: [
      { value: '—', label: 'Samples today' },
      { value: '—', label: 'Pass rate' },
      { value: '—', label: 'Open holds' },
    ],
    appBase: '/cq',
  },
  {
    moduleId: 'enzymes',
    displayName: 'PEX·E·90 Optimiser',
    tag: 'Process order formula optimisation',
    desc: 'MILP-based formula optimiser for enzyme production batches. Adjust ingredient constraints, run the solver, compare optimised vs baseline, and accept to SAP.',
    color: '#44CF93',
    stats: [
      { value: '—', label: 'Active batches' },
      { value: '—', label: 'Avg cost saving' },
      { value: '—', label: 'Solver runs today' },
    ],
    href: '/enzymes/',
  },
]

const OPERATIONS_CARDS: ModuleCard[] = [
  {
    moduleId: 'order-list',
    displayName: 'Process Orders',
    tag: 'Process order management',
    desc: 'Full history of process orders with drill-through to Process Order Detail, quality checks, and yield data.',
    color: '#005776',
    stats: [
      { value: '—', label: 'Orders today' },
      { value: '—', label: 'In progress' },
      { value: '—', label: 'Completed' },
    ],
    appBase: '/poh',
  },
  {
    moduleId: 'planning-board',
    displayName: 'Planning',
    tag: 'Planning board',
    desc: 'Line-by-line production schedule with material availability, capacity, and changeover visibility.',
    color: '#289BA2',
    stats: [
      { value: '—', label: 'Lines active' },
      { value: '—', label: 'Material shorts' },
      { value: '—', label: 'Schedule adherence' },
    ],
    appBase: '/poh',
  },
  {
    moduleId: 'vessel-planning',
    displayName: 'Vessel Planning',
    tag: 'Vessel planning analytics',
    desc: 'Vessel scheduling, utilisation, and changeover analysis across all production lines.',
    color: '#143700',
    stats: [
      { value: '—', label: 'Vessels active' },
      { value: '—', label: 'Utilisation' },
      { value: '—', label: 'Changeovers' },
    ],
    appBase: '/poh',
  },
  {
    moduleId: 'pours',
    displayName: 'Pours',
    tag: 'Pour analytics',
    desc: 'Pour-level throughput, variance, and defect analysis across all lines and shifts.',
    color: '#F24A00',
    stats: [
      { value: '—', label: 'Pours today' },
      { value: '—', label: 'Defect rate' },
      { value: '—', label: 'OEE' },
    ],
    appBase: '/poh',
  },
  {
    moduleId: 'day-view',
    displayName: 'Day View',
    tag: 'Day-level operations view',
    desc: 'Hour-by-hour production timeline with order status, shift handover context, and line performance for a selected day.',
    color: '#289BA2',
    stats: [
      { value: '—', label: 'Orders today' },
      { value: '—', label: 'Lines running' },
      { value: '—', label: 'Shifts' },
    ],
    appBase: '/poh',
  },
  {
    moduleId: 'yield',
    displayName: 'Yield',
    tag: 'Yield analytics',
    desc: 'Material yield by product, line, and shift with variance attribution and trend detection.',
    color: '#44CF93',
    stats: [
      { value: '—', label: 'Avg yield' },
      { value: '—', label: 'Variance' },
      { value: '—', label: 'Losses' },
    ],
    appBase: '/poh',
  },
  {
    moduleId: 'quality-analytics',
    displayName: 'Quality',
    tag: 'Quality analytics',
    desc: 'In-process quality check results, inspection lot status, and quality-driven order holds across all process orders.',
    color: '#005776',
    stats: [
      { value: '—', label: 'Inspections' },
      { value: '—', label: 'Pass rate' },
      { value: '—', label: 'Open lots' },
    ],
    appBase: '/poh',
  },
  {
    moduleId: 'equipment-insights',
    displayName: 'Equipment Insights',
    tag: 'Equipment performance insights',
    desc: 'OEE, downtime attribution, and shift-level performance breakdowns for individual pieces of equipment.',
    color: '#289BA2',
    stats: [
      { value: '—', label: 'Equipment tracked' },
      { value: '—', label: 'Avg OEE' },
      { value: '—', label: 'Downtime events' },
    ],
    appBase: '/poh',
  },
  {
    moduleId: 'equipment-insights-2',
    displayName: 'Equipment Estate',
    tag: 'Equipment estate overview',
    desc: 'Four-tab estate view across all equipment — performance, availability, downtime, and trend summaries.',
    color: '#289BA2',
    stats: [
      { value: '—', label: 'Total equipment' },
      { value: '—', label: 'Active' },
      { value: '—', label: 'Alerts' },
    ],
    appBase: '/poh',
  },
  {
    moduleId: 'pi-sheet',
    displayName: 'Process Execution',
    tag: 'Electronic batch record · operator execution',
    desc: 'Operator-facing tablet UI for real-time batch execution. Step-by-step recipe guidance with tolerance checks, deviation capture, and EBR generation.',
    color: '#F9C20A',
    stats: [
      { value: '—', label: 'Orders in progress' },
      { value: '—', label: 'Steps completed' },
      { value: '—', label: 'Open deviations' },
    ],
    href: '/pi-sheet/',
  },
]

const WAREHOUSE_CARDS: ModuleCard[] = [
  {
    moduleId: 'process-orders',
    displayName: 'Warehouse Cockpit',
    tag: 'Warehouse operations · transfer requests',
    desc: 'Stock transfer planning and execution across facilities. Create transfer requests, sequence dispatch, track interim inventory states, and audit transactions.',
    color: '#289BA2',
    stats: [
      { value: '—', label: 'Open TRs' },
      { value: '—', label: 'In transit' },
      { value: '—', label: 'Stock accuracy' },
    ],
    appBase: '/warehouse360',
  },
  {
    moduleId: 'imwm',
    displayName: 'Inventory Cockpit',
    tag: 'IM/WM dual-system inventory visibility',
    desc: 'SAP IM and WM reconciliation workbench. Highlights stock discrepancies in real time, prioritises by severity and SLA, and provides aging, ABC/XYZ, and expiry-risk analytics.',
    color: '#F24A00',
    stats: [
      { value: '—', label: 'IM/WM mismatches' },
      { value: '—', label: 'Expiry at risk' },
      { value: '—', label: 'Slow movers' },
    ],
    href: '/imwm/',
  },
  {
    moduleId: 'tpm',
    displayName: 'TPM Cockpit',
    tag: 'Toll processing · 7-stage lifecycle',
    desc: 'End-to-end toll processing management from STO through manufacturing, quality receipt, and customer fulfilment — with lot-level traceability and exception SLA tracking.',
    color: '#005776',
    stats: [
      { value: '—', label: 'Active lots' },
      { value: '—', label: 'In transit' },
      { value: '—', label: 'P1 exceptions' },
    ],
    href: '/tpm/',
  },
  {
    moduleId: 'plant-maintenance',
    displayName: 'Plant Maintenance',
    tag: 'Maintenance planning · reliability · backlog',
    desc: 'Multi-persona maintenance hub: backlog prioritisation, asset reliability drills (MTBF, downtime trends), work order scheduling, and compliance governance.',
    color: '#143700',
    stats: [
      { value: '—', label: 'Open orders' },
      { value: '—', label: 'Overdue' },
      { value: '—', label: 'MTBF' },
    ],
    href: '/maintenance/',
  },
]

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function StatTile({ stat }: { stat: CardStat }) {
  return (
    <div className="cp-stat">
      <span className={'cp-stat-val' + (stat.tone ? ' ' + stat.tone : '')}>{stat.value}</span>
      <span className="cp-stat-label">{stat.label}</span>
    </div>
  )
}

function cardHref(card: ModuleCard): string {
  if (card.href) return card.href
  return `${card.appBase}/?module=${encodeURIComponent(card.moduleId)}`
}

function ModuleCardEl({ card, num }: { card: ModuleCard; num: number }) {
  const numStr = `Module ${String(num).padStart(2, '0')}`
  return (
    <a
      className="cp-card"
      href={cardHref(card)}
      style={{ '--card-accent': card.color } as React.CSSProperties}
    >
      <div className="cp-card-bar" />
      <div className="cp-card-body">
        <div className="cp-card-num">{numStr} <span style={{ float: 'right' }}>↗</span></div>
        <div className="cp-card-name">{card.displayName}</div>
        <div className="cp-card-tag">{card.tag}</div>
        <p className="cp-card-desc">{card.desc}</p>
        <div className="cp-card-stats">
          {card.stats.map((s, i) => <StatTile key={i} stat={s} />)}
        </div>
      </div>
      <div className="cp-card-enter">Open module ↗</div>
    </a>
  )
}

function Section({ title, cards }: { title: string; cards: ModuleCard[] }) {
  return (
    <section>
      <div className="cp-section-head">
        <span className="cp-section-label">{title}</span>
        <span className="cp-section-count">{cards.length} modules</span>
      </div>
      <div className="cp-grid">
        {cards.map((c, i) => <ModuleCardEl key={c.moduleId} card={c} num={i + 1} />)}
      </div>
    </section>
  )
}

export function App() {
  const now = useNow()
  const time = now.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="cp-header">
        <div className="cp-logo-wrap">
          <div>
            <span className="cp-logo">CONNECTIO</span>
            <span className="cp-logo-sub">Operations Platform · Kerry Group</span>
          </div>
        </div>
        <div className="cp-header-meta">
          <span className="cp-time">{time}</span>
          <span className="cp-date">{date}</span>
        </div>
      </header>

      <main className="cp-main" style={{ flex: 1 }}>
        <Section title="Quality Intelligence" cards={QUALITY_CARDS} />
        <Section title="Process Operations" cards={OPERATIONS_CARDS} />
        <Section title="Warehouse & Supply Chain" cards={WAREHOUSE_CARDS} />
      </main>

      <footer className="cp-footer">
        Kerry Group · ConnectIO Platform · UAT
      </footer>
    </div>
  )
}
