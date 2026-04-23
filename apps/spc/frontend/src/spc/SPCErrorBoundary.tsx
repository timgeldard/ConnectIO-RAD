import { Component, type ErrorInfo, type ReactNode } from 'react'

interface SPCErrorBoundaryProps {
  children: ReactNode
}

interface SPCErrorBoundaryState {
  hasError: boolean
}

export default class SPCErrorBoundary extends Component<SPCErrorBoundaryProps, SPCErrorBoundaryState> {
  state: SPCErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): SPCErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SPC tab render failed', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--status-risk)',
            borderRadius: 10,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--status-risk)', fontSize: '0.875rem' }}>
              Analysis view unavailable
            </p>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
              This tab hit an unexpected rendering error. Your filters and selections are still preserved, so you can retry without losing context.
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={this.handleRetry}>
            Retry tab
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
