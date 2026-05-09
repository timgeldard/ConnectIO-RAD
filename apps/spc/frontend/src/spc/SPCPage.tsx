import { Suspense, lazy, type ComponentType, type LazyExoticComponent, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppShell } from '../components/layout'
import { PlantProvider, usePlantSelection } from '@connectio/shared-app-context'
import { ErrorBoundary } from '@connectio/shared-ui'
import { fetchPlants } from '../api/spc'
import { SPCProvider, useSPCSelector, useSPCDispatch } from './SPCContext'
import { useSPCUrlSync } from './hooks/useSPCUrlSync'
import { useSPCPreferences } from './hooks/useSPCPreferences'
import type { SPCState } from './types'

type TabId = SPCState['activeTab']

const SPCFilterBar = lazy(() => import('./SPCFilterBar'))
const SPCPageHeader = lazy(() => import('./SPCPageHeader'))
const OverviewPage = lazy(() => import('./overview/OverviewPage'))
const ProcessFlowView = lazy(() => import('./flow/ProcessFlowView'))
const ControlChartsView = lazy(() => import('./charts/ControlChartsView'))
const ScorecardView = lazy(() => import('./scorecard/ScorecardView'))
const AdvancedTabView = lazy(() => import('./AdvancedTabView'))

const PRIMARY_TAB_COMPONENTS: Record<Extract<TabId, 'overview' | 'flow' | 'charts' | 'scorecard'>, LazyExoticComponent<ComponentType>> = {
  overview: OverviewPage,
  flow: ProcessFlowView,
  charts: ControlChartsView,
  scorecard: ScorecardView,
}

function isAdvancedTab(tabId: TabId): tabId is Extract<TabId, 'compare' | 'msa' | 'correlation' | 'multivariate' | 'genie'> {
  return tabId === 'compare' || tabId === 'msa' || tabId === 'correlation' || tabId === 'multivariate' || tabId === 'genie'
}

function TabLoadingState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '16rem', padding: '2rem', color: 'var(--text-3)', fontSize: 13 }}>
      Loading…
    </div>
  )
}

function FilterBarLoadingState() {
  return null
}

function HeaderLoadingState() {
  return null
}

interface SPCPageProps {
  dark?: boolean
  onToggleDark?: () => void
}

function SPCContent({ dark = false, onToggleDark }: SPCPageProps) {
  const activeTab = useSPCSelector(state => state.activeTab)
  const selectedMaterial = useSPCSelector(state => state.selectedMaterial)
  const spcSelectedPlant = useSPCSelector(state => state.selectedPlant)
  const dispatch = useSPCDispatch()
  const { selectedPlant, setSelectedPlantId } = usePlantSelection()

  useSPCUrlSync()
  useSPCPreferences()

  // Sync shared PlantProvider -> SPCContext
  useEffect(() => {
    if (selectedPlant && selectedPlant.plant_id !== spcSelectedPlant?.plant_id) {
      dispatch({ type: 'SET_PLANT', payload: selectedPlant })
    }
  }, [selectedPlant, spcSelectedPlant?.plant_id, dispatch])

  // Sync SPCContext -> shared PlantProvider (on manual selection in SPC)
  useEffect(() => {
    if (spcSelectedPlant && spcSelectedPlant.plant_id !== selectedPlant?.plant_id) {
      setSelectedPlantId(spcSelectedPlant.plant_id)
    }
  }, [spcSelectedPlant, selectedPlant?.plant_id, setSelectedPlantId])

  const isAdvanced = isAdvancedTab(activeTab)
  const ActivePrimaryView = isAdvanced ? null : PRIMARY_TAB_COMPONENTS[activeTab]
  const filterBar = (
    <Suspense fallback={<FilterBarLoadingState />}>
      <SPCFilterBar embedded />
    </Suspense>
  )

  return (
    <AppShell dark={dark} onToggleDark={onToggleDark} filterBar={filterBar}>
      <Suspense fallback={<HeaderLoadingState />}>
        <SPCPageHeader />
      </Suspense>
      <ErrorBoundary key={activeTab}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Suspense fallback={<TabLoadingState />}>
              {isAdvanced ? (
                <AdvancedTabView tabId={activeTab} />
              ) : ActivePrimaryView ? (
                <ActivePrimaryView />
              ) : null}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </ErrorBoundary>
    </AppShell>
  )
}

function SPCPlantProvider({ children, materialId }: { children: React.ReactNode, materialId: string | null }) {
  const fetcher = useCallback((signal: AbortSignal) => {
    if (!materialId) return Promise.resolve([])
    return fetchPlants(materialId, signal)
  }, [materialId])

  return (
    <PlantProvider appName="spc" fetcher={fetcher}>
      {children}
    </PlantProvider>
  )
}

export default function SPCPage({ dark = false, onToggleDark }: SPCPageProps) {
  return (
    <SPCProvider>
      <useSPCSelector.MaterialConsumer>
        {materialId => (
          <SPCPlantProvider materialId={materialId}>
            <SPCContent dark={dark} onToggleDark={onToggleDark} />
          </SPCPlantProvider>
        )}
      </useSPCSelector.MaterialConsumer>
    </SPCProvider>
  )
}

// Helper to access materialId from SPCProvider
useSPCSelector.MaterialConsumer = ({ children }: { children: (materialId: string | null) => React.ReactNode }) => {
  const materialId = useSPCSelector(state => state.selectedMaterial?.material_id ?? null)
  return <>{children(materialId)}</>
}

