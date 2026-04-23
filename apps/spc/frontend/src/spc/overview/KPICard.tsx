import { Sparkline } from '../../components/ui/Sparkline'
import { Icon } from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/Icon'

export type KPITone = 'ok' | 'warn' | 'risk' | 'neutral'

interface KPICardProps {
  label: string
  value: string | number
  unit?: string
  tone?: KPITone
  icon?: IconName
  delta?: string
  trend?: 'up' | 'down'
  sparkline?: number[]
}

const TONE_COLOR: Record<KPITone, string> = {
  ok:      'var(--status-ok)',
  warn:    'var(--status-warn)',
  risk:    'var(--status-risk)',
  neutral: 'var(--valentia-slate)',
}

export default function KPICard({ label, value, unit, tone = 'neutral', icon, delta, trend, sparkline }: KPICardProps) {
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
        {delta ? (
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {trend && <Icon name={trend === 'up' ? 'trending-up' : 'trending-down'} size={12} style={{ color }} />}
            <span>{delta}</span>
          </div>
        ) : <div />}
        {sparkline && <Sparkline values={sparkline} color={color} width={90} height={22} />}
      </div>
    </div>
  )
}
