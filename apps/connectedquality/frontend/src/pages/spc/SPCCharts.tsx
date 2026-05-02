import { useMemo } from 'react'
import { Card } from '~/components/Card'
import { KPI } from '~/components/KPI'
import { Pill } from '~/components/Pill'
import { PageHead } from '~/components/PageHead'
import { Icon } from '~/components/Icon'

const N = 80

function buildData(): number[] {
  const arr: number[] = []
  let v = 50
  for (let i = 0; i < N; i++) {
    v += Math.sin(i * 0.5) * 0.6 + Math.cos(i * 0.21) * 0.8 + (Math.random() * 1.4 - 0.7)
    if (i > 60) v += 0.15
    arr.push(v)
  }
  return arr
}

/** SPC Control Charts — I-MR chart with UCL/LCL and WECO/Nelson rule violations. */
export function SPCCharts() {
  const data = useMemo(buildData, [])
  const mean = data.reduce((s, d) => s + d, 0) / N
  const stdev = Math.sqrt(data.reduce((s, d) => s + (d - mean) * (d - mean), 0) / N)
  const ucl = mean + 3 * stdev
  const lcl = mean - 3 * stdev
  const usigma = mean + 2 * stdev

  const W = 1140, H = 280
  const P = { l: 56, r: 30, t: 18, b: 26 }
  const minY = lcl - 1.5, maxY = ucl + 1.5
  const x = (i: number) => P.l + i * ((W - P.l - P.r) / (N - 1))
  const y = (v: number) => H - P.b - ((v - minY) / (maxY - minY)) * (H - P.t - P.b)

  const ooc = data
    .map((v, i) =>
      v > ucl || (i >= 2 && data[i] > usigma && data[i - 1] > usigma && data[i - 2] > usigma),
    )
    .map((b, i) => (b ? i : -1))
    .filter((i) => i >= 0)

  const mr = data.slice(1).map((v, i) => Math.abs(v - data[i]))
  const mrMean = mr.reduce((s, d) => s + d, 0) / mr.length
  const mrUCL = mrMean * 3.267
  const maxMR = mrUCL * 1.2
  const ym = (v: number) => 180 - 26 - ((v - 0) / maxMR) * 130

  return (
    <div className="cq-page">
      <PageHead
        eyebrow="SPC · MODULE 03 · PAGE 03"
        title="CONTROL CHARTS"
        desc="I-MR chart for moisture (%). UCL / LCL at 3σ; WECO + Nelson rules applied. Drift injected after sample 60."
        actions={
          <>
            <span className="cq-chip active">I-MR</span>
            <span className="cq-chip">X̄-R</span>
            <span className="cq-chip">EWMA</span>
            <span className="cq-chip">CUSUM</span>
            <button className="cq-btn ghost"><Icon name="dl" size={12} /> Export</button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 14 }}>
        <KPI label="Cp" value="1.62" tone="good" sub="95% CI [1.48, 1.76]" />
        <KPI label="Cpk" value="1.41" tone="good" sub="95% CI [1.27, 1.55]" />
        <KPI label="Pp" value="1.32" sub="long-term" />
        <KPI label="Ppk" value="1.18" tone="warn" sub="long-term" />
        <KPI label="OOC signals" value={ooc.length} tone={ooc.length > 0 ? 'warn' : 'good'} sub="WECO · Nelson" />
        <KPI label="Sample size" value={N} sub={`Last: ${new Date().toLocaleTimeString('en-GB', { hour12: false })}`} />
      </div>

      <Card
        title="Individual values · moisture %"
        meta="MAT WPC-80 · LINE 4 · CHARLEVILLE"
        action={<span className="mono" style={{ fontSize: 10.5, color: 'var(--cq-fg-3)' }}>μ {mean.toFixed(2)} · σ {stdev.toFixed(2)}</span>}
        style={{ marginBottom: 14 }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
          {[minY, mean - 2 * stdev, mean, usigma, maxY].map((v, i) => (
            <g key={i}>
              <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="grid-line" />
              <text x={P.l - 8} y={y(v) + 3} textAnchor="end" className="axis-text">{v.toFixed(1)}</text>
            </g>
          ))}
          <line x1={P.l} x2={W - P.r} y1={y(ucl)} y2={y(ucl)} stroke="var(--cq-bad)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1={P.l} x2={W - P.r} y1={y(lcl)} y2={y(lcl)} stroke="var(--cq-bad)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1={P.l} x2={W - P.r} y1={y(mean)} y2={y(mean)} stroke="var(--cq-accent)" strokeWidth="1" />
          <text x={W - P.r - 2} y={y(ucl) - 4} textAnchor="end" className="axis-text" style={{ fill: 'var(--cq-bad)' }}>UCL {ucl.toFixed(2)}</text>
          <text x={W - P.r - 2} y={y(lcl) + 12} textAnchor="end" className="axis-text" style={{ fill: 'var(--cq-bad)' }}>LCL {lcl.toFixed(2)}</text>
          <text x={W - P.r - 2} y={y(mean) - 4} textAnchor="end" className="axis-text" style={{ fill: 'var(--cq-accent)' }}>X̄ {mean.toFixed(2)}</text>
          <polyline fill="none" stroke="var(--cq-fg)" strokeWidth="1.2" points={data.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
          {data.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={ooc.includes(i) ? 4 : 2} fill={ooc.includes(i) ? 'var(--cq-bad)' : 'var(--cq-fg)'} />
          ))}
          {ooc.map((i) => (
            <g key={'t' + i}>
              <line x1={x(i)} x2={x(i)} y1={y(data[i]) - 8} y2={y(data[i]) - 22} stroke="var(--cq-bad)" />
              <rect x={x(i) - 12} y={y(data[i]) - 36} width="24" height="14" rx="2" fill="var(--cq-bad)" />
              <text x={x(i)} y={y(data[i]) - 26} textAnchor="middle" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: '#fff' }}>R1</text>
            </g>
          ))}
          <text x={P.l} y={H - 8} className="axis-text">1</text>
          <text x={(P.l + W - P.r) / 2} y={H - 8} textAnchor="middle" className="axis-text">{Math.floor(N / 2)}</text>
          <text x={W - P.r} y={H - 8} textAnchor="end" className="axis-text">{N}</text>
        </svg>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12 }}>
        <Card title="Moving range · MR" meta="WINDOW 2">
          <svg viewBox={`0 0 ${W} 180`} style={{ width: '100%', height: 180 }}>
            <line x1={P.l} x2={W - P.r} y1={ym(mrUCL)} y2={ym(mrUCL)} stroke="var(--cq-bad)" strokeWidth="1" strokeDasharray="4 3" />
            <line x1={P.l} x2={W - P.r} y1={ym(mrMean)} y2={ym(mrMean)} stroke="var(--cq-accent)" strokeWidth="1" />
            <text x={P.l - 8} y={ym(mrUCL) + 3} textAnchor="end" className="axis-text">{mrUCL.toFixed(2)}</text>
            <text x={P.l - 8} y={ym(mrMean) + 3} textAnchor="end" className="axis-text">{mrMean.toFixed(2)}</text>
            <text x={P.l - 8} y={ym(0) + 3} textAnchor="end" className="axis-text">0</text>
            {mr.map((v, i) => (
              <line key={i} x1={x(i + 1)} x2={x(i + 1)} y1={ym(0)} y2={ym(v)} stroke="var(--cq-fg-2)" strokeWidth="1" />
            ))}
          </svg>
        </Card>

        <Card title="Triggered rules" meta="LAST 80 SAMPLES">
          {[
            { rule: 'WECO 1', desc: '1 point > 3σ above X̄', n: ooc.length, sev: 'bad' as const },
            { rule: 'Nelson 2', desc: '9 points on one side of X̄', n: 0, sev: 'muted' as const },
            { rule: 'Nelson 3', desc: '6 points strictly increasing', n: 1, sev: 'warn' as const },
            { rule: 'Nelson 5', desc: '2 of 3 beyond 2σ', n: 2, sev: 'warn' as const },
            { rule: 'WECO 4', desc: '8 in trend', n: 0, sev: 'muted' as const },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 36px', gap: 8, alignItems: 'center', padding: '7px 0', borderBottom: i < 4 ? '1px solid var(--cq-line)' : 'none' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--cq-fg)' }}>{r.rule}</span>
              <span style={{ fontSize: 11.5, color: 'var(--cq-fg-2)' }}>{r.desc}</span>
              <span style={{ textAlign: 'right' }}><Pill kind={r.sev}>{r.n}</Pill></span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
