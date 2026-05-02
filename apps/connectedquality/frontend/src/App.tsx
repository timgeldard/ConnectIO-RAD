import { useState } from 'react'
import { PlatformShell, ContextBar, type CtxState } from '@connectio/shared-ui'
import { CQ_MODULES, CQ_COMPOSITION } from '~/manifest'

// Pages
import { Home } from '~/pages/Home'
import { TraceOverview } from '~/pages/trace/TraceOverview'
import { TraceRecall } from '~/pages/trace/TraceRecall'
import { TraceLineage } from '~/pages/trace/TraceLineage'
import { TraceMassBalance } from '~/pages/trace/TraceMassBalance'
import { TraceQuality } from '~/pages/trace/TraceQuality'
import { TraceCoA } from '~/pages/trace/TraceCoA'
import { EnvOverview } from '~/pages/envmon/EnvOverview'
import { EnvGlobal } from '~/pages/envmon/EnvGlobal'
import { EnvFloor } from '~/pages/envmon/EnvFloor'
import { EnvHistory } from '~/pages/envmon/EnvHistory'
import { SPCOverview } from '~/pages/spc/SPCOverview'
import { SPCFlow } from '~/pages/spc/SPCFlow'
import { SPCCharts } from '~/pages/spc/SPCCharts'
import { SPCScorecard } from '~/pages/spc/SPCScorecard'
import { SPCAdvanced } from '~/pages/spc/SPCAdvanced'
import { LabBoard } from '~/pages/lab/LabBoard'
import { Alarms } from '~/pages/Alarms'
import { Admin } from '~/pages/Admin'
import { GenericOverview } from '~/components/GenericOverview'

const DEFAULT_CTX: CtxState = {
  plant: 'Charleville · IE',
  material: '20582002 · WPC-80',
  batch: '0008898869',
}

/** Resolves the correct page component for the active module and tab. */
function ActivePage({
  mod,
  tabState,
  onOpen,
}: {
  mod: string
  tabState: Record<string, string>
  onOpen: (id: string) => void
}) {
  const tab = tabState[mod] ?? ''

  if (mod === 'home')   return <Home onOpen={onOpen} />
  if (mod === 'lab')    return <LabBoard />
  if (mod === 'alarms') return <Alarms />
  if (mod === 'admin')  return <Admin />

  if (mod === 'trace') {
    switch (tab) {
      case 'overview':     return <TraceOverview />
      case 'recall':       return <TraceRecall />
      case 'lineage':      return <TraceLineage />
      case 'mass_balance': return <TraceMassBalance />
      case 'quality':      return <TraceQuality />
      case 'coa':          return <TraceCoA />
      default:             return <TraceOverview />
    }
  }

  if (mod === 'envmon') {
    switch (tab) {
      case 'global':  return <EnvGlobal />
      case 'site':    return <EnvOverview />
      case 'floor':   return <EnvFloor />
      case 'history': return <EnvHistory />
      default:        return <EnvGlobal />
    }
  }

  if (mod === 'spc') {
    switch (tab) {
      case 'overview':  return <SPCOverview />
      case 'flow':      return <SPCFlow />
      case 'charts':    return <SPCCharts />
      case 'scorecard': return <SPCScorecard />
      case 'advanced':  return <SPCAdvanced />
      default:          return <SPCOverview />
    }
  }

  return <GenericOverview title="Coming Soon" eyebrow="" desc="" kpis={[]} panels={[]} />
}

/** Root application — drives the platform shell from the CQ manifest. */
export function App() {
  const [activeModule, setActiveModule] = useState(CQ_COMPOSITION.defaultModule)
  const [tabState, setTabState] = useState<Record<string, string>>({})

  const handleTabChange = (moduleId: string, tabId: string) => {
    setTabState((prev) => ({ ...prev, [moduleId]: tabId }))
  }

  const activeModDef = CQ_MODULES.find((m) => m.moduleId === activeModule)
  const contextBar = activeModDef?.contextBarSlot ? <ContextBar ctx={DEFAULT_CTX} /> : undefined

  return (
    <PlatformShell
      composition={CQ_COMPOSITION}
      modules={CQ_MODULES}
      activeModule={activeModule}
      tabState={tabState}
      onModuleChange={setActiveModule}
      onTabChange={handleTabChange}
      contextBar={contextBar}
      userInitials="SK"
      userName="Sarah Keane"
      userRole="QA · Charleville"
      badgeMap={{ alarms: 7 }}
    >
      <ActivePage mod={activeModule} tabState={tabState} onOpen={setActiveModule} />
    </PlatformShell>
  )
}
