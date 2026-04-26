import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { I18nProvider } from '@connectio/shared-frontend-i18n'
import { AnimatePresence, motion } from 'framer-motion'
import { AppShell } from '../components/layout'
import { SPCProvider, useSPCSelector } from './SPCContext'
import SPCErrorBoundary from './SPCErrorBoundary'
import { useSPCUrlSync } from './hooks/useSPCUrlSync'
import { useSPCPreferences } from './hooks/useSPCPreferences'
import type { SPCState } from './types'
import resources from '../i18n/resources.json'

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
  useSPCUrlSync()
  useSPCPreferences()
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
      <SPCErrorBoundary key={activeTab}>
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
      </SPCErrorBoundary>
    </AppShell>
  )
}

export default function SPCPage({ dark = false, onToggleDark }: SPCPageProps) {
  return (
    <I18nProvider appName="spc" resources={resources}>
      <SPCProvider>
        <SPCContent dark={dark} onToggleDark={onToggleDark} />
      </SPCProvider>
    </I18nProvider>
  )
}
