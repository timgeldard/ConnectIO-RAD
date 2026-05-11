/* eslint-disable jsdoc/require-jsdoc */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@connectio/shared-ui'
import { App } from '~/App'
import '~/styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
