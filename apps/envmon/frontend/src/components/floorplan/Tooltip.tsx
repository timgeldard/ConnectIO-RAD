import type { MarkerData } from '~/types';

interface TooltipProps {
  marker: MarkerData;
  x: number;
  y: number;
}

const STATUS_COLOR: Record<string, string> = {
  PASS:    '#44CF93',
  FAIL:    '#F24A00',
  WARNING: '#F9C20A',
  PENDING: '#B7B7A8',
  NO_DATA: '#D9D9CB',
};

export default function Tooltip({ marker, x, y }: TooltipProps) {
  const label = marker.func_loc_name ?? marker.func_loc_id;
  const dot = STATUS_COLOR[marker.status] ?? '#D9D9CB';

  return (
    <div
      className="tooltip"
      style={{ left: x + 12, top: y - 8 }}
      role="tooltip"
    >
      <div className="mono" style={{ fontSize: 10.5, opacity: 0.75, marginBottom: 2 }}>{marker.func_loc_id}</div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {marker.status}
        </span>
      </div>
      {marker.total_count > 0 && (
        <div style={{ marginTop: 5, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          <span style={{ opacity: 0.7, marginRight: 4 }}>F</span>{marker.fail_count}
          <span style={{ opacity: 0.7, margin: '0 4px 0 8px' }}>TOT</span>{marker.total_count}
        </div>
      )}
      {marker.risk_score !== null && (
        <div style={{ marginTop: 4, fontSize: 11, fontFamily: 'var(--font-mono)', opacity: 0.8 }}>
          Risk: {marker.risk_score?.toFixed(2)}
        </div>
      )}
    </div>
  );
}
