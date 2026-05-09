import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  message?: string
  description?: string
  retryLabel?: string
  onRetry?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Shared ErrorBoundary to catch rendering crashes in components/pages.
 * Provides a standard Kerry-themed error state with optional retry.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--status-risk)',
            borderRadius: 10,
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            margin: '1rem 0',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--status-risk)', fontSize: '1rem' }}>
              {this.props.message || 'Something went wrong'}
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
              {this.props.description || (this.state.error?.message ? `Error: ${this.state.error.message}` : 'A rendering error occurred in this section of the application.')}
            </p>
          </div>
          <button 
            className="btn btn-ghost btn-sm" 
            style={{ 
              alignSelf: 'flex-start',
              padding: '6px 12px',
              background: 'var(--status-risk)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500
            }} 
            onClick={this.handleRetry}
          >
            {this.props.retryLabel || 'Retry'}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
