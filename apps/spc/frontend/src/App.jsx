import { Suspense, lazy, useEffect, useState } from 'react'

const SPCPage = lazy(() => import('./spc/SPCPage'))

function AppLoadingState() {
  return (
    <div className="spc-page-shell__loading">
      Loading SPC workspace…
    </div>
  )
}

export default function App() {
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
