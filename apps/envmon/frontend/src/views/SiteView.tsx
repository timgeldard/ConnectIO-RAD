import KPI from '~/components/ui/KPI';
import { useFloors } from '~/api/client';
import type { PlantInfo, FloorInfo } from '~/types';

interface Props {
  plant: PlantInfo;
  onOpenFloor: (floorId: string) => void;
  onBack: () => void;
}

export default function SiteView({ plant, onOpenFloor, onBack }: Props) {
  const { data: floors = [] } = useFloors(plant.plant_id);
  const { kpis } = plant;

  return (
    <div className="scroll-y" style={{ height: '100%', padding: '20px 28px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Portfolio</button>
        <span className="eyebrow">Plant dashboard · 30 day window</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <h1 className="h-display" style={{ margin: '6px 0 0', fontSize: 32 }}>
            {plant.plant_code} · {plant.plant_name}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4 }}>
            {plant.product} · {plant.country} · {plant.employees} staff · {floors.length} floors · {kpis.total_locs} swab points
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Active FAILs" value={kpis.active_fails} accent="fail" delta="Require immediate action" />
        <KPI label="WARNING (SPC)" value={kpis.warnings} accent="warn" delta="3+ rising results" />
        <KPI label="PENDING lots" value={kpis.pending} accent="info" delta="Open in QM" />
        <KPI label="Pass rate" value={kpis.pass_rate.toFixed(1)} unit="%" accent="ok" />
        <KPI
          label="Plan completion"
          value={kpis.lots_planned > 0 ? Math.round(kpis.lots_tested / kpis.lots_planned * 100) : 100}
          unit="%"
          accent="info"
          delta={`${kpis.lots_tested}/${kpis.lots_planned} lots`}
        />
      </div>

      {/* Floor cards */}
      <h3 style={{ margin: '8px 0 12px', fontSize: 15, fontWeight: 600 }}>Floors</h3>
      {floors.length === 0 ? (
        <div style={{ color: 'var(--fg-muted)', fontSize: 13 }}>Loading floor data…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 14 }}>
          {floors.map((f) => (
            <FloorCard key={f.floor_id} floor={f} onClick={() => onOpenFloor(f.floor_id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FloorCard({ floor, onClick }: { floor: FloorInfo; onClick: () => void }) {
  const DEFAULT_W = 1021.6, DEFAULT_H = 722.48;
  const w = floor.svg_width ?? DEFAULT_W;
  const h = floor.svg_height ?? DEFAULT_H;

  return (
    <button className="card" onClick={onClick}
      style={{ padding: 0, cursor: 'pointer', textAlign: 'left', display: 'block', width: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--stroke-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="eyebrow">Floor {floor.floor_id}</div>
          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{floor.floor_name}</div>
        </div>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
          {floor.location_count} points
        </div>
      </div>
      {/* Mini floor plan preview — grid + placeholder */}
      <div style={{ background: '#FAFAF1', position: 'relative', overflow: 'hidden', height: 140 }}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }}>
          {/* Grid lines */}
          {[...Array(Math.floor(w / 120))].map((_, i) => (
            <line key={`gx${i}`} x1={i * 120} y1={0} x2={i * 120} y2={h} className="grid-line" />
          ))}
          {[...Array(Math.floor(h / 100))].map((_, i) => (
            <line key={`gy${i}`} x1={0} y1={i * 100} x2={w} y2={i * 100} className="grid-line" />
          ))}
          {/* Room outline */}
          <rect x={40} y={40} width={w - 80} height={h - 80} fill="white" stroke="rgba(20,55,0,0.15)" strokeWidth="3" rx={4} />
        </svg>
      </div>
      <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{floor.location_count} mapped swab points</span>
        <span style={{ marginLeft: 'auto', color: 'var(--valentia-slate)', fontWeight: 500 }}>View heatmap →</span>
      </div>
    </button>
  );
}
