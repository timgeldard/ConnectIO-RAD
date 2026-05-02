import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card } from '~/components/Card'
import { KPI } from '~/components/KPI'
import { Pill } from '~/components/Pill'
import { PageHead } from '~/components/PageHead'
import { GenericOverview } from '~/components/GenericOverview'

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
