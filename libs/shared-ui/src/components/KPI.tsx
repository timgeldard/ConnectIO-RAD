import { Sparkline } from './Sparkline'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import type { ReactNode } from 'react'

export type KPITone = 'ok' | 'warn' | 'risk' | 'neutral'

interface KPIProps {
  label: string
  value: string | number | ReactNode
  unit?: string
  tone?: KPITone
  icon?: IconName
  delta?: string
  trend?: 'up' | 'down'
  sparkline?: number[]
  progressBar?: number // 0-100
  subtext?: string
}

const TONE_COLOR: Record<KPITone, string> = {
  ok:      'var(--status-ok)',
  warn:    'var(--status-warn)',
  risk:    'var(--status-risk)',
  neutral: 'var(--valentia-slate)',
}

export function KPI({
  label,
  value,
  unit,
  tone = 'neutral',
  icon,
  delta,
  trend,
  sparkline,
  progressBar,
  subtext
}: KPIProps) {
  const color = TONE_COLOR[tone]

  return (
    <div className="card" style={{ padding: 18, position: 'relative', overflow: 'hidden', height: '100%' }}>
      {tone !== 'neutral' && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="eyebrow">{label}</div>
        {icon && <div style={{ color }}><Icon name={icon} size={14} /></div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{
          fontFamily: 'var(--font-impact)',
          fontWeight: 800,
          fontSize: 40,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          color: 'var(--text-1)',
        }}>
          {value}
        </div>
        {unit && <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>{unit}</div>}
      </div>

      {delta && (
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 10 }}>
          {trend && <Icon name={trend === 'up' ? 'trending-up' : 'trending-down'} size={12} style={{ color }} />}
          <span>{delta}</span>
        </div>
      )}
      {sparkline && (
        <div style={{ marginTop: delta ? 6 : 10 }}>
          <Sparkline values={sparkline} color={color} width={90} height={22} />
        </div>
      )}

      {progressBar != null && (
        <div style={{ height: 4, background: 'var(--surface-sunken)', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressBar}%`, background: color, transition: 'width 0.6s ease' }} />
        </div>
      )}

      {subtext && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>{subtext}</div>
      )}
    </div>
  )
}
