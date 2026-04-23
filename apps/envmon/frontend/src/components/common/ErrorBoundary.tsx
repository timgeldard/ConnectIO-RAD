import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'var(--font-mono, monospace)', background: 'color-mix(in srgb, #F24A00 10%, white)', border: '1px solid #F24A00', borderRadius: 8, margin: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#F24A00', marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: '#143700', marginBottom: 16 }}>
            {this.state.error?.message || 'A frontend error occurred.'}
          </div>
          <button
            style={{ padding: '8px 16px', background: '#F24A00', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
