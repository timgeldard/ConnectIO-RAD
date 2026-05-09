import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@connectio/shared-ui/shell/shell.css'
import './home.css'
import './shell/shell-platform.css'
import { Root } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
