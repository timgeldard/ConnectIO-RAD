import { Card } from '~/components/Card'
import { Pill } from '~/components/Pill'
import { PageHead } from '~/components/PageHead'
import { Icon } from '~/components/Icon'

const STAGES = [
  { id: 'raw',  x: 60,  y: 100, n: 'Raw whey',       k: 'Inflow',  cpk: 1.55, s: 'good' as const },
  { id: 'clar', x: 230, y: 100, n: 'Clarification',  k: 'Stage 1', cpk: 1.31, s: 'good' as const },
  { id: 'uf',   x: 400, y: 100, n: 'Ultrafiltration', k: 'Stage 2', cpk: 1.18, s: 'warn' as const },
  { id: 'evap', x: 570, y: 100, n: 'Evaporation',    k: 'Stage 3', cpk: 1.04, s: 'warn' as const },
  { id: 'spr',  x: 740, y: 100, n: 'Spray drying',   k: 'Stage 4', cpk: 0.86, s: 'bad' as const },
  { id: 'pack', x: 910, y: 100, n: 'Packing',        k: 'Stage 5', cpk: 1.42, s: 'good' as const },
  { id: 'qc',   x: 740, y: 240, n: 'QC release',     k: 'Gate',    cpk: 1.61, s: 'good' as const },
]

const EDGES: [string, string][] = [
  ['raw', 'clar'], ['clar', 'uf'], ['uf', 'evap'], ['evap', 'spr'], ['spr', 'pack'], ['spr', 'qc'],
]

const SCORECARD = [
  { mat: 'WPC-80', line: 'L4', char: 'Moisture %',     n: 80, cpk: 1.41, ppk: 1.18, sig: 5, s: 'warn' as const },
  { mat: 'WPC-80', line: 'L4', char: 'Protein %',      n: 80, cpk: 1.55, ppk: 1.42, sig: 0, s: 'good' as const },
  { mat: 'WPC-80', line: 'L4', char: 'Bulk density',   n: 80, cpk: 0.86, ppk: 0.74, sig: 12, s: 'bad' as const },
  { mat: 'WPC-80', line: 'L4', char: 'Particle D50',   n: 80, cpk: 1.04, ppk: 0.97, sig: 3, s: 'warn' as const },
  { mat: 'WPC-80', line: 'L4', char: 'Solubility idx', n: 80, cpk: 1.62, ppk: 1.51, sig: 0, s: 'good' as const },
  { mat: 'WPC-80', line: 'L4', char: 'Outlet temp °C', n: 80, cpk: 1.18, ppk: 1.05, sig: 2, s: 'warn' as const },
  { mat: 'WPC-80', line: 'L4', char: 'Inlet temp °C',  n: 80, cpk: 1.51, ppk: 1.34, sig: 0, s: 'good' as const },
  { mat: 'WPC-80', line: 'L4', char: 'Feed rate kg/h', n: 80, cpk: 1.27, ppk: 1.12, sig: 1, s: 'good' as const },
]

const nodeBy = Object.fromEntries(STAGES.map(s => [s.id, s]))

const sCol = (s: string) =>
  s === 'bad' ? 'var(--cq-bad)' : s === 'warn' ? 'var(--cq-warn)' : 'var(--cq-good)'

/** SPC Process Flow & Scorecard — process DAG coloured by Cpk health + characteristics table. */
export function SPCFlow() {
  return (
    <div className="cq-page">
      <PageHead
        eyebrow="SPC · MODULE 03 · PAGE 02"
        title="PROCESS FLOW & SCORECARD"
        desc="Upstream / downstream DAG with stage health colouring. Per-characteristic Cpk, Ppk and OOC signal counts in the scorecard below."
        actions={
          <>
            <button className="cq-btn ghost"><Icon name="layers" size={12} /> Lineage depth</button>
            <button className="cq-btn"><Icon name="dl" size={12} /> Export Excel</button>
          </>
        }
      />

      <Card title="Process DAG" meta="HEALTH BY Cpk · DRYER STAGE BREACHING" style={{ marginBottom: 14 }}>
        <svg viewBox="0 0 1080 320" style={{ width: '100%', height: 320, background: 'var(--cq-surface-2)', borderRadius: 2 }}>
          <defs>
            <pattern id="dots2" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.6" fill="var(--cq-line)" />
            </pattern>
            <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--cq-line-strong)" />
            </marker>
          </defs>
          <rect width="1080" height="320" fill="url(#dots2)" />
          {EDGES.map(([a, b], i) => {
            const A = nodeBy[a], B = nodeBy[b]
            const x1 = A.x + 70, y1 = A.y + 22
            const x2 = B.x - 70, y2 = B.y + 22
            return <path key={i} d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`} fill="none" stroke="var(--cq-line-strong)" strokeWidth="1.4" markerEnd="url(#arrowhead)" />
          })}
          {STAGES.map((s) => (
            <g key={s.id} transform={`translate(${s.x - 70} ${s.y})`}>
              <rect width="140" height="80" rx="4" fill="var(--cq-surface)" stroke={sCol(s.s)} strokeWidth="1.5" />
              <rect width="6" height="80" fill={sCol(s.s)} />
              <text x="14" y="20" style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fill: 'var(--cq-fg-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.k}</text>
              <text x="14" y="38" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, fill: 'var(--cq-fg)' }}>{s.n}</text>
              <text x="14" y="62" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fill: 'var(--cq-fg-2)' }}>Cpk <tspan style={{ fill: sCol(s.s), fontWeight: 600 }}>{s.cpk.toFixed(2)}</tspan></text>
              <circle cx="124" cy="60" r="6" fill={sCol(s.s)} />
            </g>
          ))}
        </svg>
      </Card>

      <Card title="Scorecard" meta="8 CHARACTERISTICS · MAT WPC-80 · LINE 4" bodyClass="tight">
        <table className="cq-tbl">
          <thead>
            <tr>
              <th>Material</th><th>Line</th><th>Characteristic</th>
              <th style={{ textAlign: 'right' }}>n</th>
              <th style={{ textAlign: 'right' }}>Cpk</th>
              <th style={{ textAlign: 'right' }}>Ppk</th>
              <th style={{ textAlign: 'right' }}>OOC</th>
              <th>Health</th>
              <th>Spark</th>
            </tr>
          </thead>
          <tbody>
            {SCORECARD.map((r, i) => (
              <tr key={i} className={r.s === 'bad' ? 'flagged' : ''}>
                <td className="mono">{r.mat}</td>
                <td className="mono">{r.line}</td>
                <td>{r.char}</td>
                <td className="num">{r.n}</td>
                <td className="num" style={{ color: r.s === 'bad' ? 'var(--cq-bad)' : r.s === 'warn' ? 'var(--cq-warn)' : 'var(--cq-good)', fontWeight: 600 }}>{r.cpk.toFixed(2)}</td>
                <td className="num">{r.ppk.toFixed(2)}</td>
                <td className="num" style={{ color: r.sig > 0 ? (r.s === 'bad' ? 'var(--cq-bad)' : 'var(--cq-warn)') : 'var(--cq-fg-3)' }}>{r.sig}</td>
                <td>
                  <Pill kind={r.s}>
                    {r.s === 'good' ? 'In control' : r.s === 'warn' ? 'Drifting' : 'Out of control'}
                  </Pill>
                </td>
                <td>
                  <svg width="80" height="22" viewBox="0 0 80 22">
                    <polyline
                      fill="none"
                      stroke={r.s === 'bad' ? 'var(--cq-bad)' : r.s === 'warn' ? 'var(--cq-warn)' : 'var(--cq-accent)'}
                      strokeWidth="1.3"
                      points={Array.from({ length: 14 }).map((_, k) => `${k * 6},${11 + Math.sin(k * 0.6 + i) * 5 + (r.s === 'bad' && k > 8 ? (k - 8) * 1.2 : 0)}`).join(' ')}
                    />
                  </svg>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
