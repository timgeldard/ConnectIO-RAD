import React from 'react';

interface KPIProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  deltaDir?: 'up' | 'down';
  accent?: 'fail' | 'warn' | 'ok' | 'info';
}

export default function KPI({ label, value, unit, delta, deltaDir, accent }: KPIProps) {
  return (
    <div className={`kpi-card${accent ? ` accent-${accent}` : ''}`}>
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {delta !== undefined && (
        <div className={`delta${deltaDir ? ` ${deltaDir}` : ''}`}>
          {deltaDir === 'up' ? '↑' : deltaDir === 'down' ? '↓' : '·'} {delta}
        </div>
      )}
    </div>
  );
}
