import { Icon } from '../components/Icon'
import type { CtxState } from './types'

interface ContextBarProps {
  ctx: CtxState
}

/** 40px global context bar — plant/material/batch selector and sync timestamp. */
export function ContextBar({ ctx }: ContextBarProps) {
  return (
    <div className="connectio-ctx">
      <div className="connectio-ctx-pin">
        <span className="live" /> Active context
      </div>
      <div className="connectio-ctx-field button">
        <span className="lbl">Plant</span>
        <span className="val">{ctx.plant}</span>
        <Icon name="chevron-right" size={11} />
      </div>
      <div className="connectio-ctx-field button">
        <span className="lbl">Material</span>
        <span className="val mono">{ctx.material}</span>
        <Icon name="chevron-right" size={11} />
      </div>
      <div className="connectio-ctx-field button">
        <span className="lbl">Batch</span>
        <span className="val alt mono">{ctx.batch}</span>
        <Icon name="chevron-right" size={11} />
      </div>
      <div className="connectio-ctx-spacer" />
      <div className="connectio-ctx-end">
        <button className="connectio-ctx-action"><Icon name="refresh" size={12} /> Refresh</button>
        <button className="connectio-ctx-action primary">
          <Icon name="flag" size={12} /> Open in workbench
        </button>
      </div>
    </div>
  )
}
