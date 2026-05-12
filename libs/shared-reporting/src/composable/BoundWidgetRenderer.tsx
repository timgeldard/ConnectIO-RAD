import type { ReactNode } from 'react';
import type { ComposableWidget } from './types';
import type { QueryRegistry } from '../data/queryRegistry';
import { useWidgetDataBinding } from '../data/useWidgetDataBinding';
import type { WidgetDataBinding } from '../data/types';

interface BoundWidgetRendererProps {
  widget: ComposableWidget;
  queryRegistry?: QueryRegistry;
  dashboardParams?: Record<string, unknown>;
  renderWidget: (widget: ComposableWidget, data?: any) => ReactNode;
}

/**
 * Wraps a widget to provide live data binding if configured.
 * If no binding is present, it renders the widget normally with static props.
 */
export function BoundWidgetRenderer({
  widget,
  queryRegistry,
  dashboardParams,
  renderWidget,
}: BoundWidgetRendererProps) {
  const binding = widget.data as WidgetDataBinding | undefined;
  
  // Only call hook if we have a registry and binding
  const { mappedProps, isLoading, error } = useWidgetDataBinding({
    binding,
    queryRegistry: queryRegistry ?? {},
    dashboardParams,
    enabled: !!queryRegistry && !!binding,
  });

  // Merge mapped props over static props
  const resolvedWidget: ComposableWidget = {
    ...widget,
    props: {
      ...widget.props,
      ...mappedProps,
    },
  };

  // While loading, we might want to show a loading state on the widget
  // but for now we just pass through and let the widget handle it via '...' etc.
  // unless there's an error.
  
  if (error) {
    console.error(`Data binding error for widget ${widget.id}:`, error);
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {renderWidget(resolvedWidget)}
      {isLoading && (
        <div style={loadingOverlayStyle} aria-busy="true">
          <div style={spinnerStyle} />
        </div>
      )}
    </div>
  );
}

const loadingOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  zIndex: 10,
  padding: 4,
};

const spinnerStyle: React.CSSProperties = {
  width: 12,
  height: 12,
  border: '2px solid var(--border-subtle)',
  borderTop: '2px solid var(--status-info)',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

// Note: Ensure @keyframes spin { to { transform: rotate(360deg); } } is in global CSS
