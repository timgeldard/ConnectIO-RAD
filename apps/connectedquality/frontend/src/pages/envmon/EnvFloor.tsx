import { useMemo } from 'react'
import { Card } from '~/components/Card'
import { PageHead } from '~/components/PageHead'
import { Pill } from '~/components/Pill'
import { Icon } from '~/components/Icon'

interface Zone {
  x: number; y: number; w: number; h: number; n: string
}

interface Marker {
  id: string; x: number; y: number; s: 'good' | 'warn' | 'bad'
}

const ZONES: Zone[] = [
  { x: 40, y: 40, w: 320, h: 200, n: 'Cold store A' },
  { x: 40, y: 250, w: 320, h: 220, n: 'Wash bay' },
  { x: 380, y: 40, w: 380, h: 230, n: 'RTE-3 process zone' },
  { x: 380, y: 290, w: 380, h: 180, n: 'Packing line PL-2' },
  { x: 780, y: 40, w: 280, h: 220, n: 'Allergen room' },
  { x: 780, y: 280, w: 280, h: 190, n: 'Office' },
]

const W = 1100, H = 520

const dotColor = (s: string) =>
  s === 'bad' ? 'var(--cq-bad)' : s === 'warn' ? 'var(--cq-warn)' : 'var(--cq-good)'

function buildMarkers(): Marker[] {
  const out: Marker[] = []
  let id = 1
  ZONES.forEach((z) => {
    const count = z.n.startsWith('RTE') ? 16 : z.n.startsWith('Pack') ? 11 : z.n.startsWith('Wash') ? 8 : 5
    for (let i = 0; i < count; i++) {
      const px = z.x + 18 + (Math.cos(i * 1.7 + id) * 0.5 + 0.5) * (z.w - 36)
      const py = z.y + 18 + (Math.sin(i * 1.3 + id * 0.7) * 0.5 + 0.5) * (z.h - 36)
      let s: 'good' | 'warn' | 'bad' = 'good'
      if (z.n.startsWith('RTE')) {
        if (i < 3) s = 'bad'
        else if (i < 6) s = 'warn'
      } else if (z.n.startsWith('Pack') && i < 2) s = 'warn'
      else if (z.n.startsWith('Wash') && i === 0) s = 'warn'
      out.push({ id: 'L' + id++, x: px, y: py, s })
    }
  })
  return out
}

/** EnvMon Floor Plan — spatial heatmap with blast radius overlays for failed locations. */
export function EnvFloor() {
  const markers = useMemo(buildMarkers, [])

  return (
    <div className="cq-page">
      <PageHead
        eyebrow="ENVMON · MODULE 02 · PAGE 03"
        title="FLOOR PLAN — F2 · CHARLEVILLE"
        desc="Per-location risk overlay. Failed markers project a blast radius to guide vector swabbing in the immediate physical vicinity."
        actions={
          <>
            <span className="cq-chip active">F2</span>
            <span className="cq-chip">F1</span>
            <span className="cq-chip">F3</span>
            <button className="cq-btn ghost"><Icon name="play" size={12} /> Play 90d</button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>
        <Card
          title="Spatial heatmap"
          meta={markers.length + ' LOCATIONS · 90D WINDOW'}
          action={
            <div style={{ display: 'flex', gap: 6 }}>
              <span className="cq-chip">Listeria</span>
              <span className="cq-chip">Salmonella</span>
              <span className="cq-chip active">All MICs</span>
            </div>
          }
        >
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, background: '#FAFAF1', borderRadius: 2 }}>
            {ZONES.map((z, i) => (
              <g key={i}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="var(--cq-surface)" stroke="var(--cq-line-strong)" strokeWidth="1" />
                <text x={z.x + 12} y={z.y + 18} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--cq-fg-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{z.n}</text>
              </g>
            ))}
            <line x1="360" y1="40" x2="360" y2="470" stroke="var(--cq-line-strong)" strokeWidth="1.5" />
            <line x1="760" y1="40" x2="760" y2="470" stroke="var(--cq-line-strong)" strokeWidth="1.5" />
            <line x1="380" y1="270" x2="760" y2="270" stroke="var(--cq-line-strong)" strokeWidth="1.5" strokeDasharray="3 3" />
            {markers.filter(m => m.s === 'bad').map((m) => (
              <g key={m.id}>
                <circle cx={m.x} cy={m.y} r="50" fill="var(--cq-bad)" opacity={0.10} />
                <circle cx={m.x} cy={m.y} r="32" fill="var(--cq-bad)" opacity={0.16} />
              </g>
            ))}
            {markers.filter(m => m.s === 'warn').map((m) => (
              <circle key={m.id} cx={m.x} cy={m.y} r="20" fill="var(--cq-warn)" opacity={0.18} />
            ))}
            {markers.map((m) => (
              <g key={m.id}>
                <circle cx={m.x} cy={m.y} r={m.s === 'bad' ? 7 : 5.5} fill={dotColor(m.s)} stroke="var(--cq-surface)" strokeWidth="1.2" />
                {m.s !== 'good' && <text x={m.x + 8} y={m.y + 3} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--cq-fg-2)' }}>{m.id}</text>}
              </g>
            ))}
            <g transform="translate(40 480)">
              <circle r="10" cx="10" cy="0" fill="var(--cq-surface)" stroke="var(--cq-line-strong)" />
              <line x1="10" y1="-7" x2="10" y2="7" stroke="var(--cq-fg-2)" strokeWidth="1" />
              <text x="10" y="-12" textAnchor="middle" className="axis-text">N</text>
            </g>
          </svg>
        </Card>

        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <Card title="Selected location" num="L03" meta="RTE-3">
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 6 }}><Pill kind="bad">FAIL · LISTERIA SPP.</Pill></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px' }}>
                <span style={{ color: 'var(--cq-fg-3)' }}>SAP</span><span className="mono">CHV-F2-RTE3-L03</span>
                <span style={{ color: 'var(--cq-fg-3)' }}>Last swab</span><span className="mono">2026-04-29 · 03:18</span>
                <span style={{ color: 'var(--cq-fg-3)' }}>Result</span><span className="mono" style={{ color: 'var(--cq-bad)' }}>POS &gt;100 cfu</span>
                <span style={{ color: 'var(--cq-fg-3)' }}>Trend</span><span className="mono">3↗ rising · WECO</span>
                <span style={{ color: 'var(--cq-fg-3)' }}>Decay λ</span><span className="mono">0.21 d⁻¹</span>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                <button className="cq-btn sm primary"><Icon name="flag" size={12} /> CAR</button>
                <button className="cq-btn sm"><Icon name="dl" size={12} /> CSV</button>
              </div>
            </div>
          </Card>
          <Card title="Trend · 90 days" num="T">
            <svg viewBox="0 0 280 110" style={{ width: '100%', height: 110 }}>
              <line x1="20" y1="80" x2="270" y2="80" className="grid-line" />
              <line x1="20" y1="50" x2="270" y2="50" className="grid-line" strokeDasharray="2 3" />
              <line x1="20" y1="22" x2="270" y2="22" stroke="var(--cq-bad)" strokeWidth="0.8" strokeDasharray="3 3" />
              <text x="270" y="20" textAnchor="end" className="axis-text" style={{ fill: 'var(--cq-bad)' }}>USL</text>
              {(() => {
                const pts: [number, number][] = []
                let v = 12
                for (let i = 0; i < 60; i++) {
                  v += Math.sin(i * 0.5) * 4 + (i > 50 ? 1.2 : 0)
                  pts.push([20 + i * 4.16, 80 - Math.max(0, Math.min(60, v))])
                }
                return <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="var(--cq-accent)" strokeWidth="1.5" />
              })()}
            </svg>
          </Card>
          <Card title="Sensitivity" num="S">
            <div className="mono" style={{ fontSize: 9.5, color: 'var(--cq-fg-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Risk multiplier</div>
            <input type="range" min="0" max="100" defaultValue="62" style={{ width: '100%' }} />
            <div className="mono" style={{ fontSize: 11, color: 'var(--cq-fg-2)' }}>0.62 ×</div>
          </Card>
        </div>
      </div>
    </div>
  )
}
