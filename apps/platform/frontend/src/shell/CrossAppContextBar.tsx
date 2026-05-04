import type { CrossAppContext } from '@connectio/shared-ui/shell'
import { MODULES } from './modules'

interface CrossAppContextBarProps {
  ctx: CrossAppContext
  onClear: () => void
}

/** 40px banner rendered in the shell context row when cross-app navigation params are present. */
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
