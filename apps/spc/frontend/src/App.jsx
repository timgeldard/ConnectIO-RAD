import { Suspense, lazy, useEffect, useState } from 'react'
import { I18nProvider, useI18n } from '@connectio/shared-frontend-i18n'
import resources from './i18n/resources.json'

const SPCPage = lazy(() => import('./spc/SPCPage'))

function AppLoadingState() {
  const { t } = useI18n()
  return (
    <div className="spc-page-shell__loading">
      {t('spc.loading.workspace')}
    </div>
  )
}

function SPCApp() {
  const [dark, setDark] = useState(
    () => localStorage.getItem('theme') === 'dark'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', dark)
    document.body.classList.add('kerry')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <Suspense fallback={<AppLoadingState />}>
      <SPCPage dark={dark} onToggleDark={() => setDark(d => !d)} />
    </Suspense>
  )
}

export default function App() {
  return (
    <I18nProvider appName="spc" resources={resources}>
      <SPCApp />
    </I18nProvider>
  )
}
