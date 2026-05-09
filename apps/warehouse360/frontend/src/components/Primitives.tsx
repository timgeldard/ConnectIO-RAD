import React from 'react'
import { Icon as SharedIcon, StatusPill as SharedStatusPill } from '@connectio/shared-ui'

/** Props for the Icon component. */
interface IconProps {
  name: string
  size?: number
  style?: React.CSSProperties
}

/** SVG icon library (Lucide-style line icons, 24px grid, 1.75 stroke). */
const Icon = ({ name, size = 18, style }: IconProps) => {
  const mapping: Record<string, string> = {
    dashboard: 'grid',
    factory: 'factory',
    truckIn: 'truck',
    truckOut: 'truck',
    boxes: 'package',
    scale: 'scale',
    alert: 'alert-triangle',
    chart: 'bar-chart',
    search: 'search',
    bell: 'bell',
    filter: 'filter',
    close: 'x',
    chevronRight: 'chevron-right',
    chevronDown: 'chevron-down',
    arrowUp: 'arrow-up',
    arrowDown: 'arrow-down',
    arrowRight: 'arrow-right',
    check: 'check',
    clock: 'clock',
    pin: 'pin',
    user: 'user',
    settings: 'settings',
    menu: 'menu',
    layers: 'layers',
    pallet: 'package',
    barcode: 'barcode',
    download: 'download',
    refresh: 'refresh',
    plus: 'plus',
    minus: 'minus',
    chat: 'message-square',
    external: 'external-link',
    qr: 'qr-code',
    eye: 'eye',
    lightning: 'zap',
    trend: 'trending-up',
    mobile: 'tablet',
    flag: 'flag',
    link: 'link',
    thermometer: 'thermometer',
  }
  return <SharedIcon name={mapping[name] || name} size={size} style={style} />
}


/** Props for the Pill component. */
interface PillProps {
  tone?: string
  children?: React.ReactNode
  noDot?: boolean
}

/** Status pill / badge with optional dot indicator. */
const Pill = ({ tone = 'grey', children, noDot }: PillProps) => {
  const mapping: Record<string, string> = {
    green: 'ok',
    slate: 'neutral',
    amber: 'warn',
    red: 'risk',
    grey: 'neutral',
  }
  return <SharedStatusPill status={mapping[tone] || tone} label={children} compact={noDot} />
}


/** Props for the Progress bar component. */
interface ProgressProps {
  pct: number
  tone?: string
  w?: string | number
}

/** Thin horizontal progress bar. */
const Progress = ({ pct, tone, w }: ProgressProps) => (
  <div className="progress" style={{ width: w ?? '100%' }}>
    <div className={`progress-fill${tone ? ' is-' + tone : ''}`} style={{ width: Math.max(0, Math.min(100, pct)) + '%' }}/>
  </div>
);


/** Props for the RiskDot component. */
interface RiskDotProps {
  risk?: string
}

/** Coloured dot conveying risk level (red / amber / green). */
const RiskDot = ({ risk }: RiskDotProps) => <span className={`risk-dot ${risk === 'green' ? '' : (risk ?? '')}`}/>

/** Returns a human-readable risk label string. */
const riskLabel = (r: string) => r === 'red' ? 'Critical' : r === 'amber' ? 'At risk' : r === 'green' ? 'On track' : '—';
/** Maps a risk string to its Pill tone. */
const riskTone = (r: string) => r === 'red' ? 'red' : r === 'amber' ? 'amber' : 'green';

/** Props for the Donut chart component. */
interface DonutProps {
  pct: number
  colour?: string
  label?: string
  sub?: string
}

/** Small circular donut chart. */
const Donut = ({ pct, colour = 'var(--valentia-slate)', label, sub }: DonutProps) => {
  const r = 54, c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="donut-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--stone)" strokeWidth="12"/>
        <circle cx="70" cy="70" r={r} fill="none" stroke={colour} strokeWidth="12"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform="rotate(-90 70 70)"/>
      </svg>
      <div className="donut-center">
        <div className="big">{label ?? pct + '%'}</div>
        {sub && <div className="small">{sub}</div>}
      </div>
    </div>
  );
};


/** Props for the Hbar component. */
interface HbarProps {
  label?: string
  value: number
  max: number
  tone?: string
}

/** Horizontal bar metric row. */
const Hbar = ({ label, value, max, tone = '' }: HbarProps) => (
  <div className="hbar">
    <div className="hbar-label">{label}</div>
    <div className="hbar-track"><div className={`hbar-fill ${tone}`} style={{ width: Math.min(100, (value / max) * 100) + '%' }}/></div>
    <div className="hbar-value">{value}</div>
  </div>
);


/** Props for the SparkBars component. */
interface SparkBarsProps {
  data: number[]
  tone?: 'slate' | 'jade' | 'sunset' | 'sunrise' | 'sage' | 'forest'
  height?: number
}

/** Mini bar sparkline for KPI trends. */
const SparkBars = ({ data, tone = 'slate', height = 36 }: SparkBarsProps) => {
  const max = Math.max(...data);
  const toneColor = { slate: 'var(--valentia-slate)', jade: 'var(--jade)', sunset: 'var(--sunset)', sunrise: 'var(--sunrise)', sage: 'var(--sage)', forest: 'var(--forest)' }[tone];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: (v / max) * height, background: toneColor,
          borderRadius: 2, opacity: 0.4 + 0.6 * (v / max),
        }}/>
      ))}
    </div>
  );
};


export { Icon, Pill, Progress, RiskDot, riskLabel, riskTone, Donut, Hbar, SparkBars }
