import type { CrossAppContext } from '@connectio/shared-ui/shell'
import { MODULES } from './modules'

/** Props for the CrossAppContextBar component. */
interface CrossAppContextBarProps {
  /** The cross-app context state (entity, IDs, originating app). */
  ctx: CrossAppContext
  /** Callback to clear the active context and remove it from the URL. */
  onClear: () => void
}

/**
 * 40px banner rendered in the shell context row when cross-app navigation params are present.
 * Provides visibility into what entity is being viewed and where the user navigated from.
 */
export function CrossAppContextBar({ ctx, onClear }: CrossAppContextBarProps) {
  const fromModule = MODULES.find((m) => m.moduleId === ctx.from)
  const fromLabel = fromModule?.displayName ?? ctx.from ?? 'another module'

  const entityLabel =
    ctx.entity === 'processOrder'
      ? `Process Order ${ctx.processOrderId ?? ''}`
      : ctx.entity === 'pourAnalytics'
        ? 'Pour Analytics'
        : ctx.entity

  return (
    <div className="connectio-ctx plat-ctx-bar">
      <div className="connectio-ctx-pin">
        <span className="live" /> Cross-app context
      </div>
      <div className="connectio-ctx-field">
        <span className="lbl">From</span>
        <span className="val">{fromLabel}</span>
      </div>
      <div className="connectio-ctx-field">
        <span className="lbl">Viewing</span>
        <span className="val mono">{entityLabel}</span>
      </div>
      <div className="connectio-ctx-spacer" />
      <div className="connectio-ctx-end">
        <button className="connectio-ctx-action" onClick={onClear}>
          Clear context ×
        </button>
      </div>
    </div>
  )
}
