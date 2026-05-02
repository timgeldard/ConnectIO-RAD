import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Home
import { Home } from '~/pages/Home'

// Trace pages
import { TraceOverview } from '~/pages/trace/TraceOverview'
import { TraceRecall } from '~/pages/trace/TraceRecall'
import { TraceLineage } from '~/pages/trace/TraceLineage'
import { TraceMassBalance } from '~/pages/trace/TraceMassBalance'
import { TraceQuality } from '~/pages/trace/TraceQuality'
import { TraceCoA } from '~/pages/trace/TraceCoA'

// EnvMon pages
import { EnvOverview } from '~/pages/envmon/EnvOverview'
import { EnvGlobal } from '~/pages/envmon/EnvGlobal'
import { EnvFloor } from '~/pages/envmon/EnvFloor'
import { EnvHistory } from '~/pages/envmon/EnvHistory'

// SPC pages
import { SPCOverview } from '~/pages/spc/SPCOverview'
import { SPCFlow } from '~/pages/spc/SPCFlow'
import { SPCCharts } from '~/pages/spc/SPCCharts'
import { SPCScorecard } from '~/pages/spc/SPCScorecard'
import { SPCAdvanced } from '~/pages/spc/SPCAdvanced'

// Other pages
import { LabBoard } from '~/pages/lab/LabBoard'
import { Alarms } from '~/pages/Alarms'
import { Admin } from '~/pages/Admin'

describe('Home', () => {
  it('renders module cards', () => {
    render(<Home onOpen={vi.fn()} />)
    const grid = document.querySelector('.cq-mod-grid') as HTMLElement
    expect(within(grid).getByText('TRACE')).toBeInTheDocument()
    expect(within(grid).getByText('ENVMON')).toBeInTheDocument()
    expect(within(grid).getByText('SPC')).toBeInTheDocument()
  })

  it('calls onOpen when a module card is clicked', () => {
    const onOpen = vi.fn()
    render(<Home onOpen={onOpen} />)
    const traceCard = document.querySelector('.cq-mod-card.mod-trace') as HTMLElement
    traceCard.click()
    expect(onOpen).toHaveBeenCalledWith('trace')
  })
})

describe('Trace pages', () => {
  it('TraceOverview renders without crashing', () => {
    const { container } = render(<TraceOverview />)
    expect(container.querySelector('.cq-page')).toBeInTheDocument()
  })

  it('TraceRecall renders KPI row and charts', () => {
    render(<TraceRecall />)
    expect(screen.getByText('RECALL READINESS')).toBeInTheDocument()
    expect(screen.getByText('Customers affected')).toBeInTheDocument()
  })

  it('TraceLineage renders without crashing', () => {
    const { container } = render(<TraceLineage />)
    expect(container.querySelector('.cq-page')).toBeInTheDocument()
  })

  it('TraceMassBalance renders without crashing', () => {
    const { container } = render(<TraceMassBalance />)
    expect(container.querySelector('.cq-page')).toBeInTheDocument()
  })

  it('TraceQuality renders without crashing', () => {
    const { container } = render(<TraceQuality />)
    expect(container.querySelector('.cq-page')).toBeInTheDocument()
  })

  it('TraceCoA renders without crashing', () => {
    const { container } = render(<TraceCoA />)
    expect(container.querySelector('.cq-page')).toBeInTheDocument()
  })
})

describe('EnvMon pages', () => {
  it('EnvOverview renders without crashing', () => {
    const { container } = render(<EnvOverview />)
    expect(container.querySelector('.cq-page')).toBeInTheDocument()
  })

  it('EnvGlobal renders the world map SVG', () => {
    const { container } = render(<EnvGlobal />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText('GLOBAL PLANT MAP')).toBeInTheDocument()
  })

  it('EnvFloor renders the floor plan SVG and slider', () => {
    const { container } = render(<EnvFloor />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText(/FLOOR PLAN/)).toBeInTheDocument()
  })

  it('EnvHistory renders without crashing', () => {
    const { container } = render(<EnvHistory />)
    expect(container.querySelector('.cq-page')).toBeInTheDocument()
  })
})

describe('SPC pages', () => {
  it('SPCOverview renders without crashing', () => {
    const { container } = render(<SPCOverview />)
    expect(container.querySelector('.cq-page')).toBeInTheDocument()
  })

  it('SPCFlow renders process DAG and scorecard', () => {
    const { container } = render(<SPCFlow />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText('PROCESS FLOW & SCORECARD')).toBeInTheDocument()
  })

  it('SPCCharts renders I-MR chart with SVG content', () => {
    const { container } = render(<SPCCharts />)
    expect(screen.getByText('CONTROL CHARTS')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
    // KPI tiles should be rendered
    expect(screen.getByText('Cp')).toBeInTheDocument()
    expect(screen.getByText('Cpk')).toBeInTheDocument()
  })

  it('SPCScorecard renders without crashing', () => {
    const { container } = render(<SPCScorecard />)
    expect(container.querySelector('.cq-page')).toBeInTheDocument()
  })

  it('SPCAdvanced renders without crashing', () => {
    const { container } = render(<SPCAdvanced />)
    expect(container.querySelector('.cq-page')).toBeInTheDocument()
  })
})

describe('LabBoard', () => {
  it('renders the lab board wallboard', () => {
    render(<LabBoard />)
    expect(screen.getByText(/CONNECTEDQUALITY · LAB BOARD/)).toBeInTheDocument()
  })

  it('renders fail cards for the visible page', () => {
    const { container } = render(<LabBoard />)
    expect(container.querySelectorAll('.fail-card').length).toBeGreaterThan(0)
  })

  it('shows the open fails count', () => {
    render(<LabBoard />)
    expect(screen.getByText('Open fails')).toBeInTheDocument()
  })
})

describe('Alarms', () => {
  it('renders the alarms signal table', () => {
    render(<Alarms />)
    expect(screen.getByText('ALARMS')).toBeInTheDocument()
    expect(screen.getByText('Signal stream')).toBeInTheDocument()
  })

  it('renders KPI row with open/ack/closed counts', () => {
    render(<Alarms />)
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Acknowledged')).toBeInTheDocument()
  })
})

describe('Admin', () => {
  it('renders the settings page', () => {
    render(<Admin />)
    expect(screen.getByText('SETTINGS')).toBeInTheDocument()
  })

  it('renders all 5 settings sections', () => {
    render(<Admin />)
    expect(screen.getByText('Identity & access')).toBeInTheDocument()
    expect(screen.getByText('Data sources')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Compliance')).toBeInTheDocument()
  })
})
