import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@connectio/shared-ui/styles/kerry-tokens.css'
import '@connectio/shared-ui/styles/kerry-app.css'
import '@connectio/shared-ui/shell/shell.css'
import './styles/colors_and_type.css'
import './styles/app.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>
)
