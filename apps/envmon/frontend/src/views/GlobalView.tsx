import React, { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import KPI from '~/components/ui/KPI';
import type { PlantInfo } from '~/types';

interface Props {
  plants: PlantInfo[];
  onOpenPlant: (plantId: string) => void;
}

const REGIONS = ['ALL', 'EMEA', 'AMER', 'APMEA'];

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

function riskColor(p: PlantInfo) {
  if (p.kpis.risk_index > 30) return '#F24A00';
  if (p.kpis.risk_index > 15) return '#F9C20A';
  return '#44CF93';
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

  const validPins = plants.filter((p) => p.lat !== 0 || p.lon !== 0);

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
        <div className="card" style={{ padding: 0, position: 'relative' }}>
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
          <div style={{ height: 320, overflow: 'hidden', background: '#EEF0E8', borderRadius: '0 0 8px 8px' }}>
            <ComposableMap
              projection="geoEqualEarth"
              projectionConfig={{ scale: 155, center: [10, 10] }}
              style={{ width: '100%', height: '100%' }}
            >
              <ZoomableGroup zoom={1}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="#DDE0D4"
                        stroke="#C8CCC0"
                        strokeWidth={0.3}
                        style={{
                          default: { outline: 'none' },
                          hover: { outline: 'none', fill: '#D2D5CB' },
                          pressed: { outline: 'none' },
                        }}
                      />
                    ))
                  }
                </Geographies>
                {validPins.map((p) => {
                  const r = 3 + Math.min(7, p.kpis.active_fails * 0.6);
                  const color = riskColor(p);
                  return (
                    <Marker
                      key={p.plant_id}
                      coordinates={[p.lon, p.lat]}
                      onClick={() => onOpenPlant(p.plant_id)}
                      onMouseEnter={(e: React.MouseEvent) => {
                        setHover(p);
                        setMousePos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setHover(null)}
                      onMouseMove={(e: React.MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle r={r + 3} fill={color} fillOpacity={0.2} />
                      <circle r={r} fill={color} stroke="white" strokeWidth={1} />
                    </Marker>
                  );
                })}
              </ZoomableGroup>
            </ComposableMap>
          </div>
          {hover && (
            <div className="tooltip" style={{ position: 'fixed', left: mousePos.x + 14, top: mousePos.y + 14, zIndex: 1000, pointerEvents: 'none' }}>
              <div className="mono" style={{ fontSize: 10.5, opacity: 0.75 }}>{hover.plant_code}</div>
              <div style={{ fontWeight: 600 }}>{hover.plant_name}</div>
              {hover.city && <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{hover.city}</div>}
              <div style={{ fontSize: 11, marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--sunset)', marginRight: 8 }}>{hover.kpis.active_fails} FAIL</span>
                <span>{hover.kpis.pass_rate.toFixed(1)}% pass</span>
              </div>
            </div>
          )}
        </div>

        {/* Plant ranking list */}
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
  const riskCol = kpis.active_fails > 0 ? 'var(--sunset)' : kpis.warnings > 0 ? 'var(--sunrise)' : 'var(--jade)';
  return (
    <button className="card" onClick={onClick}
      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: riskCol, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{plant.plant_code} · {plant.plant_name}</div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>{plant.country}</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>{plant.city ?? plant.product}</div>
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
