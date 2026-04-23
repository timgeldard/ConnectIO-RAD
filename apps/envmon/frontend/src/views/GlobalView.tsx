import React, { useMemo, useState } from 'react';
import KPI from '~/components/ui/KPI';
import type { PlantInfo } from '~/types';

interface Props {
  plants: PlantInfo[];
  onOpenPlant: (plantId: string) => void;
}

const REGIONS = ['ALL', 'EMEA', 'AMER', 'APMEA'];

// Simple equirectangular projection; world bounds lon[-180,180] lat[-60,75]
function proj(lat: number, lon: number, w: number, h: number) {
  return { x: ((lon + 180) / 360) * w, y: (1 - (lat + 60) / 135) * h };
}

export default function GlobalView({ plants, onOpenPlant }: Props) {
  const [region, setRegion] = useState('ALL');
  const [sortBy, setSortBy] = useState<'risk' | 'fails' | 'rate' | 'name'>('risk');
  const [hover, setHover] = useState<PlantInfo | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const filtered = useMemo(() => {
    let list = region === 'ALL' ? plants : plants.filter((p) => p.region === region);
    return [...list].sort((a, b) => {
      if (sortBy === 'risk') return b.kpis.risk_index - a.kpis.risk_index;
      if (sortBy === 'fails') return b.kpis.active_fails - a.kpis.active_fails;
      if (sortBy === 'rate') return a.kpis.pass_rate - b.kpis.pass_rate;
      return a.plant_name.localeCompare(b.plant_name);
    });
  }, [plants, region, sortBy]);

  const scoped = region === 'ALL' ? plants : plants.filter((p) => p.region === region);
  const totals = useMemo(() => {
    const totalLocs = scoped.reduce((a, p) => a + p.kpis.total_locs, 0) || 1;
    return {
      plants: scoped.length,
      active_fails: scoped.reduce((a, p) => a + p.kpis.active_fails, 0),
      warnings: scoped.reduce((a, p) => a + p.kpis.warnings, 0),
      pass_rate: scoped.reduce((a, p) => a + p.kpis.pass_rate * p.kpis.total_locs, 0) / totalLocs,
      lots_tested: scoped.reduce((a, p) => a + p.kpis.lots_tested, 0),
      lots_planned: scoped.reduce((a, p) => a + (p.kpis.lots_planned || p.kpis.lots_tested), 0),
      pathogen_hits: scoped.reduce((a, p) => a + p.kpis.pathogen_hits, 0),
    };
  }, [scoped]);

  const mapW = 100, mapH = 48;

  return (
    <div className="scroll-y" style={{ height: '100%', padding: '20px 28px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <div className="eyebrow">Portfolio overview · 30 day window</div>
          <h1 className="h-display" style={{ margin: '6px 0 0', fontSize: 32 }}>
            Environmental monitoring across {totals.plants} plant{totals.plants !== 1 ? 's' : ''}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 6 }}>
            Regional helicopter view · risk-ranked · drill into any plant for its full heatmap.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {REGIONS.map((r) => (
            <button key={r} className={`chip${region === r ? ' active' : ''}`} onClick={() => setRegion(r)}>
              {r === 'ALL' ? 'All regions' : r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        <KPI label="Active FAILs" value={totals.active_fails} accent="fail" />
        <KPI label="Trending up (WARN)" value={totals.warnings} accent="warn" />
        <KPI label="Pass rate (30d)" value={totals.pass_rate.toFixed(1)} unit="%" accent="ok" />
        <KPI label="Lots tested / planned" value={totals.lots_tested} unit={`/ ${totals.lots_planned}`} accent="info" />
        <KPI label="Pathogen hits" value={totals.pathogen_hits} accent="fail" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* World map */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-hd">
            <div>
              <h3>Risk map</h3>
              <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginTop: 2 }}>Pin size = open findings · colour = risk tier</div>
            </div>
            <div className="legend">
              <span className="item"><span className="sw" style={{ background: 'var(--sunset)' }} />High</span>
              <span className="item"><span className="sw" style={{ background: 'var(--sunrise)' }} />Medium</span>
              <span className="item"><span className="sw" style={{ background: 'var(--jade)' }} />Low</span>
            </div>
          </div>
          <div className="worldmap" style={{ height: 320, borderRadius: 0 }}>
            <svg viewBox={`0 0 ${mapW} ${mapH}`} preserveAspectRatio="xMidYMid meet">
              <g fill="#E3E3D4" stroke="#D1D1C1" strokeWidth="0.12">
                <path d="M 10,10 Q 14,6 22,8 Q 28,9 30,14 Q 29,18 27,22 Q 24,26 20,28 Q 16,28 14,25 Q 12,22 11,18 Z" />
                <path d="M 25,26 Q 29,28 30,32 Q 29,38 27,42 Q 24,44 23,40 Q 22,34 24,30 Z" />
                <path d="M 46,10 Q 52,8 56,10 Q 58,14 56,17 Q 52,19 48,18 Q 45,16 45,13 Z" />
                <path d="M 48,19 Q 54,19 56,22 Q 58,28 56,34 Q 53,40 50,40 Q 47,38 46,32 Q 45,26 46,21 Z" />
                <path d="M 58,10 Q 68,8 78,10 Q 84,13 86,18 Q 84,22 80,24 Q 72,25 64,22 Q 60,17 58,13 Z" />
                <path d="M 78,24 Q 84,25 87,27 Q 86,30 82,30 Q 79,29 78,26 Z" />
                <path d="M 82,34 Q 88,33 90,36 Q 89,39 85,40 Q 81,39 81,36 Z" />
              </g>
              {[...Array(12)].map((_, i) => <line key={i} x1={i * 10} y1={0} x2={i * 10} y2={mapH} stroke="#EDEDDF" strokeWidth="0.08" />)}
              {[...Array(6)].map((_, i) => <line key={i} x1={0} y1={i * 8} x2={mapW} y2={i * 8} stroke="#EDEDDF" strokeWidth="0.08" />)}
              {plants.map((p) => {
                const { x, y } = proj(p.lat, p.lon, mapW, mapH);
                const color = p.kpis.risk_index > 30 ? '#F24A00' : p.kpis.risk_index > 15 ? '#F9C20A' : '#44CF93';
                const r = 0.8 + Math.min(2.4, p.kpis.active_fails * 0.25);
                return (
                  <g key={p.plant_id} className="plant-pin" onClick={() => onOpenPlant(p.plant_id)}
                    onMouseEnter={(e) => { setHover(p); setMousePos({ x: e.clientX, y: e.clientY }); }}
                    onMouseLeave={() => setHover(null)}
                    onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}>
                    <circle cx={x} cy={y} r={r + 0.8} fill={color} fillOpacity="0.25" />
                    <circle cx={x} cy={y} r={r} fill={color} stroke="white" strokeWidth="0.25" />
                  </g>
                );
              })}
            </svg>
            {hover && (
              <div className="tooltip" style={{ left: mousePos.x + 12, top: mousePos.y + 12 }}>
                <div className="mono" style={{ fontSize: 10.5, opacity: 0.75 }}>{hover.plant_code}</div>
                <div style={{ fontWeight: 600 }}>{hover.plant_name}</div>
                <div style={{ fontSize: 11, marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--sunset)', marginRight: 8 }}>{hover.kpis.active_fails} FAIL</span>
                  <span style={{ marginRight: 8 }}>{hover.kpis.pass_rate.toFixed(1)}% pass</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sort controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">Plant ranking</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['risk', 'fails', 'rate', 'name'] as const).map((s) => (
                <button key={s} className={`chip${sortBy === s ? ' active' : ''}`}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setSortBy(s)}>
                  {s === 'risk' ? 'Risk' : s === 'fails' ? 'FAILs' : s === 'rate' ? 'Pass %' : 'A-Z'}
                </button>
              ))}
            </div>
          </div>
          <div className="scroll-y" style={{ flex: 1 }}>
            {filtered.map((p) => (
              <PlantCard key={p.plant_id} plant={p} onClick={() => onOpenPlant(p.plant_id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlantCard({ plant, onClick }: { plant: PlantInfo; onClick: () => void }) {
  const { kpis } = plant;
  const riskColor = kpis.active_fails > 0 ? 'var(--sunset)' : kpis.warnings > 0 ? 'var(--sunrise)' : 'var(--jade)';
  return (
    <button className="card" onClick={onClick}
      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: riskColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{plant.plant_code} · {plant.plant_name}</div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>{plant.country}</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>{plant.product}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          <span style={{ color: kpis.active_fails > 0 ? 'var(--sunset)' : 'var(--fg-muted)', fontWeight: 600 }}>
            {kpis.active_fails} FAIL
          </span>
          <span style={{ color: kpis.warnings > 0 ? 'var(--sunrise)' : 'var(--fg-muted)' }}>
            {kpis.warnings} WARN
          </span>
          <span>{kpis.pass_rate.toFixed(1)}% pass</span>
          <span style={{ color: 'var(--fg-muted)' }}>{kpis.total_locs} pts</span>
        </div>
      </div>
    </button>
  );
}
