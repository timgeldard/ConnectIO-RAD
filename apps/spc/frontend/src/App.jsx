import { Suspense, lazy, useEffect, useState } from 'react'
import { useI18n } from '@connectio/shared-frontend-i18n'
import enResources from './i18n/locales/en.json'

const SPCPage = lazy(() => import('./spc/SPCPage'))

export const spcI18nResources = { en: enResources }

export const loadSpcResource = async (lang) => {
  const module = await import(`./i18n/locales/${lang}.json`)
  return module.default
}

function AppLoadingState() {
  const { t } = useI18n()
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-0)' }}>
      <div className="t-mono" style={{ color: 'var(--text-3)', fontSize: 13 }}>
        {t('spc.loading.workspace')}
      </div>
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
  return <SPCApp />
}
