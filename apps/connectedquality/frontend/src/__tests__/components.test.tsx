import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LeftRail } from '~/components/LeftRail'
import { TopBar } from '~/components/TopBar'
import { ContextBar } from '~/components/ContextBar'
import { SubNav } from '~/components/SubNav'
import { Card } from '~/components/Card'
import { KPI } from '~/components/KPI'
import { Pill } from '~/components/Pill'
import { Spark } from '~/components/Spark'
import { PageHead } from '~/components/PageHead'
import { GenericOverview } from '~/components/GenericOverview'
import { TRACE_TABS } from '~/constants'

describe('LeftRail', () => {
  it('renders all module buttons', () => {
    render(<LeftRail active="home" onPick={vi.fn()} />)
    expect(screen.getByTitle('Home')).toBeInTheDocument()
    expect(screen.getByTitle('Trace')).toBeInTheDocument()
    expect(screen.getByTitle('Alarms')).toBeInTheDocument()
  })

  it('marks active module with active class', () => {
    render(<LeftRail active="trace" onPick={vi.fn()} />)
    const btn = screen.getByTitle('Trace')
    expect(btn.className).toContain('active')
  })

  it('calls onPick when a module button is clicked', () => {
    const onPick = vi.fn()
    render(<LeftRail active="home" onPick={onPick} />)
    fireEvent.click(screen.getByTitle('Trace'))
    expect(onPick).toHaveBeenCalledWith('trace')
  })

  it('shows badge on Alarms module', () => {
    render(<LeftRail active="home" onPick={vi.fn()} />)
    // Alarms badge value is 7 from constants
    expect(screen.getByText('7')).toBeInTheDocument()
  })
})

describe('TopBar', () => {
  it('renders product name', () => {
    render(<TopBar breadcrumb={['Home']} onAlarms={vi.fn()} />)
    expect(screen.getByText('CONNECTED')).toBeInTheDocument()
  })

  it('renders breadcrumb segments', () => {
    render(<TopBar breadcrumb={['Trace', 'Recall Readiness']} onAlarms={vi.fn()} />)
    expect(screen.getByText('Trace')).toBeInTheDocument()
    expect(screen.getByText('Recall Readiness')).toBeInTheDocument()
  })

  it('calls onAlarms when bell button is clicked', () => {
    const onAlarms = vi.fn()
    render(<TopBar breadcrumb={['Home']} onAlarms={onAlarms} />)
    fireEvent.click(screen.getByTitle('Alarms'))
    expect(onAlarms).toHaveBeenCalledOnce()
  })
})

describe('ContextBar', () => {
  const ctx = { plant: 'Charleville', material: '20582002', batch: '0008898869' }

  it('renders plant, material, batch from ctx', () => {
    render(<ContextBar ctx={ctx} />)
    expect(screen.getByText('Charleville')).toBeInTheDocument()
    expect(screen.getByText('20582002')).toBeInTheDocument()
    expect(screen.getByText('0008898869')).toBeInTheDocument()
  })

  it('shows the hold status pill', () => {
    render(<ContextBar ctx={ctx} />)
    expect(screen.getByText(/QI · IN HOLD/i)).toBeInTheDocument()
  })
})

describe('SubNav', () => {
  it('renders all tab labels', () => {
    render(<SubNav tabs={TRACE_TABS} active="overview" onPick={vi.fn()} />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Recall Readiness')).toBeInTheDocument()
    expect(screen.getByText('Lineage')).toBeInTheDocument()
  })

  it('applies active class to the current tab', () => {
    render(<SubNav tabs={TRACE_TABS} active="recall" onPick={vi.fn()} />)
    const recallBtn = screen.getByText('Recall Readiness').closest('button')!
    expect(recallBtn.className).toContain('active')
  })

  it('calls onPick with tab id when clicked', () => {
    const onPick = vi.fn()
    render(<SubNav tabs={TRACE_TABS} active="overview" onPick={onPick} />)
    fireEvent.click(screen.getByText('Lineage'))
    expect(onPick).toHaveBeenCalledWith('lineage')
  })

  it('renders pip indicator on tabs that have pip=true', () => {
    render(<SubNav tabs={TRACE_TABS} active="overview" onPick={vi.fn()} />)
    // recall tab has pip: true — pip span is rendered inside that button
    const recallBtn = screen.getByText('Recall Readiness').closest('button')!
    expect(recallBtn.querySelector('.pip')).toBeInTheDocument()
  })
})

describe('Card', () => {
  it('renders title and children', () => {
    render(<Card title="Test Card"><span>body content</span></Card>)
    expect(screen.getByText('Test Card')).toBeInTheDocument()
    expect(screen.getByText('body content')).toBeInTheDocument()
  })

  it('renders num and meta when provided', () => {
    render(<Card title="Test" num="01" meta="META TEXT"><span /></Card>)
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('META TEXT')).toBeInTheDocument()
  })
})

describe('KPI', () => {
  it('renders label and value', () => {
    render(<KPI label="Batches" value="100" />)
    expect(screen.getByText('Batches')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('renders unit when provided', () => {
    render(<KPI label="Rate" value="3.2" unit="%" />)
    expect(screen.getByText('%')).toBeInTheDocument()
  })

  it('renders sub text when provided', () => {
    render(<KPI label="Cpk" value="1.41" sub="rolling 90D" />)
    expect(screen.getByText('rolling 90D')).toBeInTheDocument()
  })

  it('applies tone class on the kpi container', () => {
    const { container } = render(<KPI label="Fails" value="3" tone="bad" />)
    expect(container.querySelector('.cq-kpi.bad')).toBeInTheDocument()
  })
})

describe('Pill', () => {
  it('renders children', () => {
    render(<Pill kind="good">In control</Pill>)
    expect(screen.getByText('In control')).toBeInTheDocument()
  })

  it('applies kind class on the pill span', () => {
    const { container } = render(<Pill kind="warn">Warning</Pill>)
    expect(container.querySelector('.cq-pill.warn')).toBeInTheDocument()
  })
})

describe('Spark', () => {
  it('renders an svg polyline', () => {
    const { container } = render(<Spark data={[1, 2, 3, 4, 5]} />)
    expect(container.querySelector('polyline')).toBeInTheDocument()
  })
})

describe('PageHead', () => {
  it('renders eyebrow, title, and desc', () => {
    render(<PageHead eyebrow="MODULE 01" title="TRACE" desc="Batch traceability." />)
    expect(screen.getByText('MODULE 01')).toBeInTheDocument()
    expect(screen.getByText('TRACE')).toBeInTheDocument()
    expect(screen.getByText('Batch traceability.')).toBeInTheDocument()
  })

  it('renders action slot when provided', () => {
    render(
      <PageHead eyebrow="" title="T" desc="" actions={<button>Export</button>} />
    )
    expect(screen.getByText('Export')).toBeInTheDocument()
  })
})

describe('GenericOverview', () => {
  const props = {
    eyebrow: 'MODULE 01 · PAGE 01',
    title: 'OVERVIEW',
    desc: 'Placeholder overview.',
    kpis: [
      { label: 'Total', value: '100', tone: 'good' as const },
      { label: 'Fails', value: '3', tone: 'bad' as const },
    ],
    panels: [
      { num: '01', title: 'Panel A', meta: 'META', body: 'Panel body text.' },
      { num: '02', title: 'Panel B', meta: 'META2', body: 'Second panel text.' },
    ],
  }

  it('renders all KPI labels', () => {
    render(<GenericOverview {...props} />)
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('Fails')).toBeInTheDocument()
  })

  it('renders panel titles and body', () => {
    render(<GenericOverview {...props} />)
    expect(screen.getByText('Panel A')).toBeInTheDocument()
    expect(screen.getByText('Panel body text.')).toBeInTheDocument()
  })

  it('renders with empty kpis and panels without crashing', () => {
    render(<GenericOverview eyebrow="" title="T" desc="" kpis={[]} panels={[]} />)
    expect(screen.getByText('T')).toBeInTheDocument()
  })
})
