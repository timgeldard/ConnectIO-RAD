/* eslint-disable jsdoc/require-jsdoc */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@connectio/shared-ui/styles/kerry-tokens.css'
import '@connectio/shared-ui/styles/kerry-app.css'
import '@connectio/shared-ui/shell/shell.css'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './home.css'
import './shell/shell-platform.css'
import { Root } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
