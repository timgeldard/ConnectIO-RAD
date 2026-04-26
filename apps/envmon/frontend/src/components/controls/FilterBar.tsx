import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@connectio/shared-frontend-i18n';
import { useEM } from '~/context/EMContext';
import { useMics, useHeatmap } from '~/api/client';
import { IconDownload, IconPlay, IconPause } from '~/components/ui/Icons';
import type { TimeWindow } from '~/types';

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let s = String(val);
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function computeDaysSinceToday(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  const hDate = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - hDate.getTime()) / (1000 * 60 * 60 * 24));
}

/** Available time window values for the heatmap range selector. */
const TIME_WINDOW_VALUES: TimeWindow[] = [30, 60, 90, 180, 365];

/** FilterBar provides time window, MIC filter, heatmap mode, sensitivity, time-travel, and CSV export controls. */
export default function FilterBar() {
  const { t } = useI18n();
  const {
    view,
    activeFloor,
    timeWindow, setTimeWindow,
    heatmapMode, setHeatmapMode,
    historicalDate, setHistoricalDate,
    decayLambda, setDecayLambda,
    selectedMics, setSelectedMics,
  } = useEM();

  const plantId = view.plantId;
  const { data: allMics = [] } = useMics(plantId, null);
  const { data: heatmapData } = useHeatmap(plantId, activeFloor, heatmapMode, timeWindow, historicalDate, decayLambda, selectedMics);

  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (historicalDate && computeDaysSinceToday(historicalDate) > timeWindow) {
      setHistoricalDate(null);
    }
  }, [timeWindow, historicalDate, setHistoricalDate]);

  useEffect(() => {
    if (isPlaying) {
      let currentDays = historicalDate ? computeDaysSinceToday(historicalDate) : timeWindow;
      if (currentDays <= 0) currentDays = timeWindow;
      playbackRef.current = setInterval(() => {
        currentDays -= 1;
        if (currentDays < 0) {
          setIsPlaying(false);
          setHistoricalDate(null);
        } else {
          const d = new Date();
          d.setDate(d.getDate() - currentDays);
          setHistoricalDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
      }, 600);
    } else {
      if (playbackRef.current) clearInterval(playbackRef.current);
    }
    return () => { if (playbackRef.current) clearInterval(playbackRef.current); };
  }, [isPlaying, timeWindow, setHistoricalDate, historicalDate]);

  const sliderValue = historicalDate ? Math.min(Math.max(computeDaysSinceToday(historicalDate), 0), timeWindow) : 0;

  const handleSliderChange = (val: number) => {
    if (isPlaying) setIsPlaying(false);
    if (val === 0) {
      setHistoricalDate(null);
    } else {
      const d = new Date();
      d.setDate(d.getDate() - val);
      setHistoricalDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
  };

  const handleExport = () => {
    const markers = heatmapData?.markers;
    if (!markers?.length) return;
    const headers = ['Functional Location', 'Status', 'Risk Score', 'Fail Count', 'Total Lots', 'X%', 'Y%'];
    const rows = markers.map((m) => [m.func_loc_id, m.status, m.risk_score ?? '', m.fail_count, m.total_count, m.x_pos.toFixed(2), m.y_pos.toFixed(2)]);
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `em_heatmap_${activeFloor}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 24px', background: 'white', borderBottom: '1px solid var(--stroke-soft)', flexWrap: 'wrap', flexShrink: 0 }}>
      {/* Time window */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>{t('envmon.filterBar.timeWindow')}</div>
        <select
          value={String(timeWindow)}
          onChange={(e) => setTimeWindow(Number(e.target.value) as TimeWindow)}
          style={{ width: 110 }}
        >
          {TIME_WINDOW_VALUES.map((value) => (
            <option key={value} value={String(value)}>{t('envmon.filterBar.days', { n: value })}</option>
          ))}
        </select>
      </div>

      {/* MIC filter chips */}
      {allMics.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>{t('envmon.filterBar.micFilter')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {allMics.slice(0, 6).map((m) => {
              const active = selectedMics.includes(m);
              return (
                <button key={m} className={`chip${active ? ' active' : ''}`}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setSelectedMics(active ? selectedMics.filter((x) => x !== m) : [...selectedMics, m])}>
                  {m}
                </button>
              );
            })}
            {selectedMics.length > 0 && (
              <button className="chip" style={{ fontSize: 11, padding: '2px 8px', color: 'var(--fg-muted)' }}
                onClick={() => setSelectedMics([])}>
                {t('envmon.filterBar.clearFilter')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Heatmap mode */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>{t('envmon.filterBar.heatmapMode')}</div>
        <div style={{ display: 'inline-flex', background: 'var(--stone)', borderRadius: 999, padding: 2 }}>
          {(['deterministic', 'continuous'] as const).map((m) => (
            <button key={m} onClick={() => setHeatmapMode(m)}
              style={{ padding: '4px 12px', fontSize: 12, borderRadius: 999,
                background: heatmapMode === m ? 'var(--forest)' : 'transparent',
                color: heatmapMode === m ? 'white' : 'var(--fg-muted)' }}>
              {m === 'deterministic' ? t('envmon.filterBar.deterministic') : t('envmon.filterBar.continuous')}
            </button>
          ))}
        </div>
      </div>

      {/* Sensitivity (continuous only) */}
      {heatmapMode === 'continuous' && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            {t('envmon.filterBar.sensitivity', { n: Math.round(Math.log(2) / decayLambda) })}
          </div>
          <input type="range" min="0.02" max="0.5" step="0.01" value={decayLambda}
            onChange={(e) => setDecayLambda(Number(e.target.value))}
            style={{ width: 130 }} />
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Time-travel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div className="eyebrow" style={{ marginRight: 2 }}>{t('envmon.filterBar.timeTravel')}</div>
        <button className="btn btn-icon btn-ghost"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? t('envmon.filterBar.pause') : t('envmon.filterBar.play')}>
          {isPlaying ? <IconPause size={12} /> : <IconPlay size={12} />}
        </button>
        <input type="range" min={0} max={timeWindow} step={1} value={sliderValue}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          style={{ width: 160 }} />
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)', minWidth: 56 }}>
          {sliderValue === 0
            ? t('envmon.filterBar.today')
            : t('envmon.filterBar.daysAgo', { n: sliderValue })}
        </span>
      </div>

      {/* Export */}
      <button className="btn btn-ghost btn-sm"
        onClick={handleExport}
        disabled={!heatmapData?.markers?.length}
        title={t('envmon.filterBar.exportCsv')}>
        <IconDownload size={12} /> CSV
      </button>
    </div>
  );
}
