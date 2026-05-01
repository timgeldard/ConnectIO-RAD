import { memo, useState } from 'react'
import { SparklineMini } from '@connectio/shared-ui'
import NodeTooltip from './NodeTooltip'
import type { ProcessFlowNodeData } from '../types'

const STATUS = {
  green: { dot: 'var(--status-ok)',   text: 'var(--status-ok)',   bg: 'var(--status-ok-bg)',   border: 'var(--status-ok)',   label: 'Low rejection rate'      },
  amber: { dot: 'var(--status-warn)', text: 'var(--status-warn)', bg: 'var(--status-warn-bg)', border: 'var(--status-warn)', label: 'Elevated rejection rate' },
  red:   { dot: 'var(--status-risk)', text: 'var(--status-risk)', bg: 'var(--status-risk-bg)', border: 'var(--status-risk)', label: 'High rejection rate'      },
  grey:  { dot: 'var(--text-4)',      text: 'var(--text-3)',      bg: 'var(--surface-2)',      border: 'var(--line-1)',      label: 'Insufficient data'        },
} as const

type ProcessNodeStatus = keyof typeof STATUS

export interface ProcessNodeProps {
  data: ProcessFlowNodeData
  selected?: boolean
  onClick?: () => void
  highlighted?: boolean
  hasSelection?: boolean
}

function ProcessNode({
  data,
  selected = false,
  onClick,
  highlighted = true,
  hasSelection = false,
}: ProcessNodeProps) {
  const statusKey = (data.status ?? 'grey') as ProcessNodeStatus
  const s = STATUS[statusKey] ?? STATUS.grey
  const rejectionRate = data.rejection_rate_pct
  const hasSignal = Boolean(data.has_ooc_signal || data.last_ooc)
  const [hovered, setHovered] = useState(false)

  const shortName = data.material_name && data.material_name.length > 22
    ? data.material_name.substring(0, 21) + '…'
    : (data.material_name || data.material_id)

  const fullName = data.material_name || String(data.material_id)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${fullName} — ${s.label}${data.is_root ? ' (root node)' : ''}`}
      data-flow-node="true"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        background: s.bg,
        border: `1.5px solid ${selected ? s.dot : s.border}`,
        borderRadius: 18,
        width: 184,
        boxShadow: hasSignal
          ? '0 14px 32px rgba(109,40,217,0.18)'
          : selected
            ? `0 0 0 3px ${s.dot}40`
            : '0 10px 24px rgba(15,23,42,0.08)',
        position: 'relative',
        padding: '12px 14px 10px',
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
        transform: selected ? 'translateY(-1px)' : 'none',
        opacity: hasSelection && !highlighted ? 0.35 : 1,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Status dot */}
      <div
        role="img"
        aria-label={s.label}
        title={s.label}
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 8, height: 8, borderRadius: '50%',
          background: s.dot, boxShadow: `0 0 0 2px ${s.dot}30`,
        }}
      />

      {/* Material name */}
      <div
        style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-1)', paddingRight: 20, lineHeight: 1.3 }}
        title={fullName}
      >
        {shortName}
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
        {data.plant_name && (
          <span style={{
            background: 'var(--surface-sunken)', borderRadius: 4,
            padding: '1px 5px', fontSize: '0.625rem', fontWeight: 500, color: 'var(--text-3)',
          }}>
            {data.plant_name}
          </span>
        )}
        {data.is_root && (
          <span style={{
            background: 'var(--surface-inverse)', borderRadius: 4,
            padding: '1px 5px', fontSize: '0.625rem', fontWeight: 700, color: '#F4F4E8',
          }}>
            ROOT
          </span>
        )}
        {hasSignal && (
          <span style={{
            borderRadius: 999, padding: '1px 6px', fontSize: '0.625rem', fontWeight: 700,
            color: 'var(--status-risk)', background: 'var(--status-risk-bg)',
            border: '1px solid var(--status-risk)',
          }}>
            OOC
          </span>
        )}
      </div>

      {/* Sparkline */}
      <div style={{ margin: '6px 0 4px' }}>
        <SparklineMini values={data.sparkline_values ?? []} width={156} height={30} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        {data.estimated_cpk != null && (
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, color: s.text,
            background: 'var(--surface-sunken)', borderRadius: 4, padding: '1px 5px',
          }}>
            Cpk {data.estimated_cpk.toFixed(2)}
          </span>
        )}
        <span style={{ fontSize: '0.65rem', color: 'var(--text-4)', marginLeft: 'auto' }}>
          {data.total_batches ?? 0}b
          {(data.rejected_batches ?? 0) > 0 && (
            <span style={{ color: 'var(--status-risk)', marginLeft: 3 }}>·{data.rejected_batches}r</span>
          )}
        </span>
      </div>

      {rejectionRate != null && (
        <div style={{ marginTop: 5, fontSize: '0.68rem', fontWeight: 600, color: s.text }}>
          Rejection {rejectionRate.toFixed(1)}%
        </div>
      )}

      <NodeTooltip
        label={fullName}
        plantName={data.plant_name}
        rejectionRate={rejectionRate}
        cpk={data.estimated_cpk}
        totalBatches={data.total_batches}
        rejectedBatches={data.rejected_batches}
        lastOoc={data.last_ooc}
        hasSignal={hasSignal}
        visible={hovered}
      />
    </div>
  )
}

export default memo(ProcessNode)
