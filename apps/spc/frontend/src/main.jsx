import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from '@connectio/shared-ui'
import { I18nProvider, useI18n } from '@connectio/shared-frontend-i18n'
import '@connectio/shared-ui/styles/kerry-tokens.css'
import '@connectio/shared-ui/styles/kerry-app.css'
import './index.css'
import App, { loadSpcResource, spcI18nResources } from './App'
import { queryClient } from './queryClient'

function LocalizedRootBoundary({ children }) {
  const { t } = useI18n()
  return (
    <ErrorBoundary
      message={t('spc.errorBoundary.message')}
      description={t('spc.errorBoundary.description')}
      retryLabel={t('spc.errorBoundary.retry')}
    >
      {children}
    </ErrorBoundary>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider appName="spc" resources={spcI18nResources} loadResource={loadSpcResource}>
      {/* Root boundary protects app providers/shell while still using SPC translations. */}
      <LocalizedRootBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </LocalizedRootBoundary>
    </I18nProvider>
  </StrictMode>,
)
