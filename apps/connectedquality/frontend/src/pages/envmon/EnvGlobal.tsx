import { useMemo } from 'react'
import { Card } from '~/components/Card'
import { KPI } from '~/components/KPI'
import { Pill } from '~/components/Pill'
import { PageHead } from '~/components/PageHead'
import { Icon } from '~/components/Icon'

const PLANTS = [
  { id: 'CHV', n: 'Charleville', x: 488, y: 162, s: 'good', v: 0, swabs: 612 },
  { id: 'LIS', n: 'Listowel', x: 481, y: 168, s: 'warn', v: 4, swabs: 488 },
  { id: 'CRG', n: 'Carrigaline', x: 486, y: 175, s: 'bad', v: 6, swabs: 510 },
  { id: 'HAM', n: 'Hamburg', x: 552, y: 158, s: 'good', v: 1, swabs: 720 },
  { id: 'ROT', n: 'Rotterdam', x: 538, y: 160, s: 'good', v: 0, swabs: 460 },
  { id: 'BAR', n: 'Barcelona', x: 520, y: 195, s: 'warn', v: 2, swabs: 305 },
  { id: 'MIL', n: 'Milan', x: 548, y: 188, s: 'good', v: 0, swabs: 270 },
  { id: 'BEL', n: 'Beloit', x: 245, y: 178, s: 'good', v: 0, swabs: 818 },
  { id: 'ROC', n: 'Rochester', x: 268, y: 172, s: 'warn', v: 3, swabs: 590 },
  { id: 'JAC', n: 'Jacksonville', x: 254, y: 220, s: 'good', v: 1, swabs: 410 },
  { id: 'MEX', n: 'Toluca', x: 218, y: 235, s: 'good', v: 0, swabs: 280 },
  { id: 'SAO', n: 'São Paulo', x: 360, y: 322, s: 'warn', v: 2, swabs: 340 },
  { id: 'JOH', n: 'Johannesburg', x: 583, y: 332, s: 'good', v: 0, swabs: 220 },
  { id: 'DUB', n: 'Dubai', x: 660, y: 220, s: 'good', v: 1, swabs: 240 },
  { id: 'SHA', n: 'Shanghai', x: 870, y: 215, s: 'warn', v: 3, swabs: 510 },
  { id: 'SIN', n: 'Singapore', x: 838, y: 280, s: 'good', v: 0, swabs: 360 },
  { id: 'MEL', n: 'Melbourne', x: 920, y: 360, s: 'good', v: 0, swabs: 290 },
]

const dotColor = (s: string) =>
  s === 'bad' ? 'var(--cq-bad)' : s === 'warn' ? 'var(--cq-warn)' : 'var(--cq-good)'

/** EnvMon Global Map — world map with plant risk dots. */
export function EnvGlobal() {
  const sorted = useMemo(() => [...PLANTS].sort((a, b) => b.v - a.v).slice(0, 10), [])

  return (
    <div className="cq-page">
      <PageHead
        eyebrow="ENVMON · MODULE 02 · PAGE 01"
        title="GLOBAL PLANT MAP"
        desc="Spatial overview of environmental compliance across all sites. Continuous-mode risk scores, decayed by organism."
        actions={
          <>
            <span className="cq-chip active">Continuous</span>
            <span className="cq-chip">Deterministic</span>
            <button className="cq-btn ghost"><Icon name="refresh" size={12} /> Refresh</button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        <KPI label="Plants tracked" value="47" />
        <KPI label="Swabs · last 90D" value="14,820" />
        <KPI label="Open warnings" value="12" tone="warn" sub="3 sites" />
        <KPI label="Open fails" value="2" tone="bad" sub="Carrigaline · Listowel" />
        <KPI label="Compliance" value="96.4" unit="%" tone="good" sub="+0.6 vs prior 90D" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>
        <Card title="World map · plant risk" meta="EQUIRECTANGULAR · 17 PLANTS SHOWN">
          <svg viewBox="0 0 1080 500" style={{ width: '100%', height: 500, background: 'var(--cq-surface-2)', borderRadius: 2 }}>
            <defs>
              <pattern id="grat" width="60" height="50" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 50" fill="none" stroke="var(--cq-line)" strokeWidth="0.4" />
              </pattern>
            </defs>
            <rect width="1080" height="500" fill="url(#grat)" />
            <g fill="color-mix(in srgb, var(--cq-accent) 8%, transparent)" stroke="var(--cq-line-strong)" strokeWidth="0.6">
              <path d="M 200 80 Q 280 70 300 130 L 320 200 Q 280 240 260 280 L 240 240 Q 200 210 195 160 Z" />
              <path d="M 280 280 L 320 320 L 360 380 L 340 420 L 300 410 L 280 360 Z" />
              <path d="M 480 100 L 580 110 L 600 160 L 580 200 L 540 220 L 500 200 L 480 150 Z" />
              <path d="M 540 220 L 620 230 L 640 320 L 600 380 L 560 360 L 540 280 Z" />
              <path d="M 600 110 L 900 120 L 920 200 L 880 240 L 800 230 L 720 220 L 660 180 L 620 160 Z" />
              <path d="M 880 320 L 950 330 L 970 380 L 920 390 L 880 360 Z" />
            </g>
            {PLANTS.map((p) => (
              <g key={p.id}>
                {p.s !== 'good' && (
                  <circle cx={p.x} cy={p.y} r={p.s === 'bad' ? 22 : 16} fill={dotColor(p.s)} opacity={0.18} />
                )}
                <circle cx={p.x} cy={p.y} r={p.s === 'bad' ? 7 : p.s === 'warn' ? 6 : 4.5} fill={dotColor(p.s)} stroke="var(--cq-surface)" strokeWidth="1.2" />
                <text x={p.x + 9} y={p.y - 6} style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fill: 'var(--cq-fg)', letterSpacing: '0.06em' }}>{p.id}</text>
                {p.v > 0 && <text x={p.x + 9} y={p.y + 7} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--cq-fg-3)' }}>{p.v} alarm{p.v > 1 ? 's' : ''}</text>}
              </g>
            ))}
            <g transform="translate(20 460)">
              <rect width="220" height="28" rx="2" fill="var(--cq-surface)" stroke="var(--cq-line)" />
              <circle cx={18} cy={14} r="4" fill="var(--cq-good)" /><text x={28} y={17} className="axis-text">Compliant</text>
              <circle cx={98} cy={14} r="4" fill="var(--cq-warn)" /><text x={108} y={17} className="axis-text">Warning</text>
              <circle cx={170} cy={14} r="4" fill="var(--cq-bad)" /><text x={180} y={17} className="axis-text">Fail</text>
            </g>
          </svg>
        </Card>

        <Card title="Sites · sorted by risk" meta="LIVE">
          <div style={{ display: 'grid', gap: 0 }}>
            {sorted.map((p, i) => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '10px 32px 1fr auto auto', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: i < 9 ? '1px solid var(--cq-line)' : 'none' }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: dotColor(p.s) }} />
                <span className="mono" style={{ fontSize: 11, color: 'var(--cq-fg-3)' }}>{p.id}</span>
                <span style={{ fontSize: 12 }}>{p.n}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--cq-fg-2)' }}>{p.swabs.toLocaleString()}</span>
                <span>
                  <Pill kind={p.s === 'bad' ? 'bad' : p.s === 'warn' ? 'warn' : 'good'}>{p.v}</Pill>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
