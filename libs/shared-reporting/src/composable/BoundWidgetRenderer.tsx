import type { ReactNode } from 'react'
import type { ComposableWidget } from './types'
import type { QueryRegistry } from '../data/queryRegistry'
import { useWidgetDataBinding } from '../data/useWidgetDataBinding'
import type { WidgetDataBinding } from '../data/types'

/** Props for the BoundWidgetRenderer component. */
export interface BoundWidgetRendererProps {
  /** The widget instance to render. */
  widget: ComposableWidget
  /** Optional registry to resolve queries for data binding. */
  queryRegistry?: QueryRegistry
  /** Optional global parameters to pass to the query. */
  dashboardParams?: Record<string, unknown>
  /** Callback to render the actual widget component once props are resolved. */
  renderWidget: (widget: ComposableWidget, data?: any) => ReactNode
}

/**
 * Wraps a widget to provide live data binding if configured.
 * If no binding is present, it renders the widget normally with static props.
 * 
 * @param props - Component properties
 * @returns React element
 */
export function BoundWidgetRenderer({
  widget,
  queryRegistry,
  dashboardParams,
  renderWidget,
}: BoundWidgetRendererProps) {
  const binding = widget.data as WidgetDataBinding | undefined
  
  // Only call hook if we have a registry and binding
  const { mappedProps, isLoading, error } = useWidgetDataBinding({
    binding,
    queryRegistry: queryRegistry ?? {},
    dashboardParams,
    enabled: !!queryRegistry && !!binding,
  })

  // Merge mapped props over static props
  const resolvedWidget: ComposableWidget = {
    ...widget,
    props: {
      ...widget.props,
      ...mappedProps,
    },
  }

  if (error) {
    // Note: In a real app we'd use a structured logger here.
    // For this prototype we'll keep the error in console but structured.
    console.error(`[DataBinding] Error for widget ${widget.id} (${widget.type}):`, {
      message: error.message,
      queryKey: binding?.queryKey,
      widgetId: widget.id,
    })
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {renderWidget(resolvedWidget)}
      {isLoading && (
        <div
          style={loadingOverlayStyle}
          aria-busy="true"
          role="status"
          aria-live="polite"
          aria-label="Loading widget data"
        >
          <span style={spinnerStyle} aria-hidden="true" />
        </div>
      )}
    </div>
  )
}

const spinnerStyle: React.CSSProperties = {
  display: 'block',
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: '2px solid var(--border-subtle, rgba(255,255,255,0.12))',
  borderTopColor: 'var(--text-3, rgba(255,255,255,0.5))',
}

const loadingOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  zIndex: 10,
  padding: 4,
}
