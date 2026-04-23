import React, { useState } from 'react';
import { useTrends, useMics } from '~/api/client';
import { useEM } from '~/context/EMContext';
import type { TimeWindow } from '~/types';

interface Props { plantId: string | null; funcLocId: string; }

const CHART_W = 340, CHART_H = 180;
const PAD = { t: 12, r: 12, b: 28, l: 40 };

const VALUATION_COLOR: Record<string, string> = {
  A: '#44CF93',
  R: '#F24A00',
  W: '#F9C20A',
};

const WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: 30,  label: '30d' },
  { value: 60,  label: '60d' },
  { value: 90,  label: '90d' },
  { value: 180, label: '180d' },
];

export default function TrendTab({ plantId, funcLocId }: Props) {
  const { timeWindow } = useEM();
  const [selectedMic, setSelectedMic] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<TimeWindow>(timeWindow);

  const { data: micNames = [], isLoading: micsLoading } = useMics(plantId, funcLocId);
  const { data: trend, isLoading } = useTrends(plantId, funcLocId, selectedMic, windowDays);

  const activeMic = selectedMic ?? micNames[0] ?? null;
  const points = trend?.points ?? [];

  const innerW = CHART_W - PAD.l - PAD.r;
  const innerH = CHART_H - PAD.t - PAD.b;

  const dates  = points.map((p) => new Date(p.inspection_date).getTime());
  const values = points.map((p) => p.result_value ?? 0).filter((v) => isFinite(v));
  const upperLimit = points.find((p) => p.upper_limit != null)?.upper_limit ?? null;

  const minDate = dates.length ? Math.min(...dates) : 0;
  const maxDate = dates.length ? Math.max(...dates) : 1;
  const maxVal  = Math.max(upperLimit ?? 0, ...values, 1);
  const minVal  = Math.min(0, ...values);

  const scaleX = (t: number) =>
    maxDate === minDate ? PAD.l + innerW / 2 : PAD.l + ((t - minDate) / (maxDate - minDate)) * innerW;
  const scaleY = (v: number) =>
    CHART_H - PAD.b - ((v - minVal) / (maxVal - minVal)) * innerH;

  const polylinePoints = points
    .filter((p) => p.result_value != null)
    .map((p) => `${scaleX(new Date(p.inspection_date).getTime())},${scaleY(p.result_value!)}`)
    .join(' ');

  const tickDates = points.length > 1
    ? [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]]
    : points;

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>MIC</div>
          <select value={activeMic ?? ''} onChange={(e) => setSelectedMic(e.target.value || null)} style={{ width: '100%' }}>
            <option value="">Select MIC…</option>
            {micNames.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Window</div>
          <div style={{ display: 'inline-flex', background: 'var(--stone)', borderRadius: 999, padding: 2 }}>
            {WINDOWS.map(({ value, label }) => (
              <button key={value} onClick={() => setWindowDays(value)}
                style={{ padding: '3px 9px', fontSize: 11, borderRadius: 999,
                  background: windowDays === value ? 'var(--forest)' : 'transparent',
                  color: windowDays === value ? 'white' : 'var(--fg-muted)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {micsLoading && <div style={{ color: 'var(--fg-muted)', fontSize: 12 }}>Loading MICs…</div>}
      {!micsLoading && !activeMic && <div style={{ color: 'var(--fg-muted)', fontSize: 12 }}>Select a MIC to view the trend.</div>}
      {activeMic && !isLoading && points.length === 0 && <div style={{ color: 'var(--fg-muted)', fontSize: 12 }}>No data in this window.</div>}
      {isLoading && <div style={{ color: 'var(--fg-muted)', fontSize: 12 }}>Loading trend…</div>}

      {activeMic && !isLoading && points.length > 0 && (
        <>
          <div className="eyebrow" style={{ marginBottom: 4 }}>MIC · {activeMic}</div>
          {upperLimit != null && (
            <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginBottom: 8 }}>
              Upper tolerance limit: {upperLimit}
            </div>
          )}
          <svg className="trend-chart" viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="xMidYMid meet"
            style={{ background: 'var(--stone)', borderRadius: 4, overflow: 'visible' }}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
              <line key={i} className="grid"
                x1={PAD.l} y1={PAD.t + t * innerH}
                x2={CHART_W - PAD.r} y2={PAD.t + t * innerH} />
            ))}
            {/* Upper limit */}
            {upperLimit != null && (
              <>
                <line className="limit"
                  x1={PAD.l} y1={scaleY(upperLimit)}
                  x2={CHART_W - PAD.r} y2={scaleY(upperLimit)} />
                <text className="axis" fill="#F24A00" x={CHART_W - PAD.r} y={scaleY(upperLimit) - 4} textAnchor="end">
                  UTL {upperLimit}
                </text>
              </>
            )}
            {/* Axes */}
            <line x1={PAD.l} y1={CHART_H - PAD.b} x2={CHART_W - PAD.r} y2={CHART_H - PAD.b} stroke="var(--stroke)" />
            <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={CHART_H - PAD.b} stroke="var(--stroke)" />
            {/* Trend line */}
            {polylinePoints && <polyline className="line" points={polylinePoints} />}
            {/* Data points */}
            {points.filter((p) => p.result_value != null).map((p, i) => (
              <circle key={i}
                cx={scaleX(new Date(p.inspection_date).getTime())}
                cy={scaleY(p.result_value!)}
                r="3.2"
                fill={VALUATION_COLOR[p.valuation ?? ''] ?? 'var(--fg-muted)'}
                stroke="white" strokeWidth="1" />
            ))}
            {/* Y axis labels */}
            <text className="axis" x={PAD.l - 4} y={PAD.t + 4} textAnchor="end">{maxVal.toFixed(0)}</text>
            <text className="axis" x={PAD.l - 4} y={CHART_H - PAD.b} textAnchor="end">{minVal.toFixed(0)}</text>
            {/* X axis ticks */}
            {tickDates.map((p, i) => {
              const tx = scaleX(new Date(p.inspection_date).getTime());
              return (
                <g key={i}>
                  <line x1={tx} y1={CHART_H - PAD.b} x2={tx} y2={CHART_H - PAD.b + 4} stroke="var(--stroke)" />
                  <text className="axis" x={tx} y={CHART_H - PAD.b + 14} textAnchor="middle">
                    {new Date(p.inspection_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </text>
                </g>
              );
            })}
          </svg>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, fontSize: 11.5, color: 'var(--fg-muted)' }}>
            <span style={{ color: '#44CF93' }}>● A (accept)</span>
            <span style={{ color: '#F9C20A' }}>● W (warn)</span>
            <span style={{ color: '#F24A00' }}>● R (reject)</span>
          </div>
        </>
      )}
    </div>
  );
}
