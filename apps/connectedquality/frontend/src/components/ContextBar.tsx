import { Icon } from '~/components/Icon'

export interface CtxState {
  plant: string
  material: string
  batch: string
}

interface ContextBarProps {
  ctx: CtxState
}

/** 40px global context bar — plant/material/batch selector and timestamp. */
export function ContextBar({ ctx }: ContextBarProps) {
  return (
    <div className="cq-ctx">
      <div className="cq-ctx-pin">
        <span className="live" /> Active context
      </div>
      <div className="cq-ctx-field button">
        <span className="lbl">Plant</span>
        <span className="val">{ctx.plant}</span>
        <Icon name="chev" size={11} />
      </div>
      <div className="cq-ctx-field button">
        <span className="lbl">Material</span>
        <span className="val mono">{ctx.material}</span>
        <Icon name="chev" size={11} />
      </div>
      <div className="cq-ctx-field button">
        <span className="lbl">Batch</span>
        <span className="val alt mono">{ctx.batch}</span>
        <Icon name="chev" size={11} />
      </div>
      <div className="cq-ctx-field">
        <span className="lbl">Status</span>
        <span className="cq-pill warn"><span className="dot" /> QI · IN HOLD</span>
      </div>
      <div className="cq-ctx-field">
        <span className="lbl">Mfg</span>
        <span className="val mono">2026-04-12</span>
      </div>
      <div className="cq-ctx-field">
        <span className="lbl">Exp</span>
        <span className="val mono">2027-04-12</span>
      </div>
      <div className="cq-ctx-field">
        <span className="lbl">Window</span>
        <span className="val mono">90D · 2026-02-01 → 05-01</span>
      </div>
      <div className="cq-ctx-spacer" />
      <div className="cq-ctx-end">
        <div className="ts"><span className="dim">Synced</span>2 s ago · 14:08:21Z</div>
        <button className="cq-ctx-action"><Icon name="refresh" size={12} /> Refresh</button>
        <button className="cq-ctx-action primary">
          <Icon name="flag" size={12} /> Open in workbench
        </button>
      </div>
    </div>
  )
}
