import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n/context'
import {
  TopBar,
  Icon,
  KPI,
  Button,
  type KPITone,
  type IconName
} from '@connectio/shared-ui'
import { fetchPlanningSchedule } from '../api/planning'

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// ---- helpers ----
function fmtDay(ms: number) {
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}
function fmtDate(ms: number) {
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
function fmtTime(ms: number) {
  const d = new Date(ms);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtDateTime(ms: number) {
  return fmtDate(ms) + ' · ' + fmtTime(ms);
}
function fmtRelativeDue(ms: number, now: number) {
  const diff = ms - now;
  if (diff < 0) return 'OVERDUE';
  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / HOUR);
  if (days === 0) return hours + 'h';
  if (days === 1) return 'tomorrow';
  return days + 'd';
}

interface BlockData {
  id: string;
  kind: string;
  start: number;
  end: number;
  label: string;
  sublabel?: string;
  poId?: string;
  qty?: number;
  uom?: string;
  lineId: string;
  activeDowntime?: any;
  reasonCode?: string;
  reasonCategory?: string;
  hostPoId?: string;
  hostLabel?: string;
  shortageItem?: string;
  shortageETA?: number;
  customer?: string;
  shift?: string;
  operator?: string;
  ratePerH?: number;
  durationH: number;
  product: string;
  requiresLine: string;
  priority: 'urgent' | 'high' | 'normal';
  due: number;
}

// =====================================================
// Planning Board root
// =====================================================
function PlanningBoard() {
  const { t } = useT();
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<'day' | 'week'>('week');  // 'day' | 'week'
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [hoveredBacklog, setHoveredBacklog] = useState<any>(null);
  const [showWm, setShowWm] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchPlanningSchedule()
      .then(d => { setScheduleData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  // Build Gantt-compatible data object from API response
  const data = useMemo(() => {
    if (!scheduleData) return null;
    const lines = scheduleData.lines.map((id: string) => ({ id, name: id, cap: '—', shift: '—' }));
    return {
      NOW: scheduleData.now_ms,
      today: scheduleData.today_ms,
      windowStart: scheduleData.window_start_ms,
      windowEnd: scheduleData.window_end_ms,
      lines,
      blocks: scheduleData.blocks,
      backlog: scheduleData.backlog,
      wmTransfers: [],
      kpis: scheduleData.kpis,
    };
  }, [scheduleData]);

  if (loading) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: t.crumbManufacturing || 'Manufacturing' }, { label: t.navPlanning }]} />
        <div className="loading-state" style={{padding:'48px',textAlign:'center',color:'var(--text-3)'}}>
          Loading schedule…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: t.crumbManufacturing || 'Manufacturing' }, { label: t.navPlanning }]} />
        <div className="error-state" style={{padding:'48px',textAlign:'center',color:'var(--status-risk)'}}>
          {error || 'No data available.'}
        </div>
      </div>
    );
  }

  // Time window
  const windowStart = data.windowStart;
  const windowEnd = data.windowEnd;
  const totalMs = windowEnd - windowStart;
  // Pixels per hour — drives the horizontal scale of the Gantt
  const pxPerHour = zoom === 'week' ? 16 : 64;
  const totalWidth = (totalMs / HOUR) * pxPerHour;

  // Build day columns
  const dayCols: any[] = [];
  let cursor = windowStart;
  while (cursor < windowEnd) {
    const d = new Date(cursor);
    d.setUTCHours(0,0,0,0);
    const startOfDay = d.getTime();
    const nextDay = startOfDay + DAY;
    dayCols.push({
      start: startOfDay,
      end: Math.min(nextDay, windowEnd),
      isToday: startOfDay === data.today,
      isPast: nextDay <= data.NOW,
    });
    cursor = nextDay;
  }

  return (
    <div className="app-shell-full" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar
        breadcrumbs={[{ label: t.operations }, { label: t.crumbManufacturing || 'Manufacturing' }, { label: t.navPlanning }]}
      />

      <div className="planning-head" style={{ padding: '24px 32px 0', background: 'var(--surface-0)' }}>
        <div className="planning-id-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div className="id-block">
            <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="layers" size={14} />
              <span>{t.planningTitle}</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 4px', color: 'var(--text-1)' }}>
              {t.planningTitle}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {t.planningSubtitle}
              <span style={{ marginLeft: 12, opacity: 0.6 }}>{data.lines.length} lines · {data.kpis.backlogCount} in backlog</span>
            </div>
          </div>
          <div className="detail-actions" style={{ display: 'flex', gap: 12 }}>
            <Button variant="secondary" icon={<Icon name="printer" />}>Print plan</Button>
            <Button variant="primary" icon={<Icon name="plus" />}>{t.schedulePlan}</Button>
          </div>
        </div>

        <KpiStrip kpis={data.kpis} t={t} />
      </div>

      <div className="planning-toolbar" style={{ padding: '12px 32px', borderBottom: '1px solid var(--line-1)', background: 'var(--surface-sunken)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="planning-tools-l" style={{ display: 'flex', gap: 12 }}>
          <div className="chip" style={{ background: 'var(--surface-0)', border: '1px solid var(--line-1)', borderRadius: 4, padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="calendar" size={13} />
            <span>{fmtDate(windowStart)} – {fmtDate(windowEnd - 1)}</span>
          </div>
          <div className="chip" style={{ background: 'var(--surface-0)', border: '1px solid var(--line-1)', borderRadius: 4, padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="factory" size={13} />
            <span>All plants · {data.lines.length} lines</span>
          </div>
          <div className="chip" style={{ background: 'var(--surface-0)', border: '1px solid var(--line-1)', borderRadius: 4, padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="filter" size={13} />
            <span>All categories</span>
          </div>
        </div>
        <div className="planning-tools-r" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Legend t={t} showWm={showWm} setShowWm={setShowWm} />
          <div className="zoom-toggle" style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-0)', border: '1px solid var(--line-1)', borderRadius: 4, padding: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '0 8px', color: 'var(--text-3)', textTransform: 'uppercase' }}>{t.zoomLabel}</span>
            <button 
              className={`btn btn-sm ${zoom === 'day' ? 'btn-primary' : 'btn-ghost'}`} 
              style={{ height: 24, padding: '0 12px', fontSize: 11 }}
              onClick={() => setZoom('day')}
            >
              {t.viewDay}
            </button>
            <button 
              className={`btn btn-sm ${zoom === 'week' ? 'btn-primary' : 'btn-ghost'}`} 
              style={{ height: 24, padding: '0 12px', fontSize: 11 }}
              onClick={() => setZoom('week')}
            >
              {t.viewWeek}
            </button>
          </div>
        </div>
      </div>

      <div className="planning-body" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Gantt
          data={data}
          dayCols={dayCols}
          windowStart={windowStart}
          totalMs={totalMs}
          pxPerHour={pxPerHour}
          totalWidth={totalWidth}
          zoom={zoom}
          selectedBlock={selectedBlock}
          setSelectedBlock={setSelectedBlock}
          hoveredBacklog={hoveredBacklog}
          showWm={showWm}
          t={t}
        />

        <BacklogRail
          backlog={data.backlog}
          NOW={data.NOW}
          hovered={hoveredBacklog}
          setHovered={setHoveredBacklog}
          t={t}
        />
      </div>
    </div>
  );
}

// =====================================================
// KPI Strip
// =====================================================
function KpiStrip({ kpis, t }: { kpis: any; t: any }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 12, marginBottom: 24 }}>
      <KPI
        label={t.kpiLinesRunning}
        icon="factory"
        value={kpis.runningCount}
        unit={`/ ${kpis.totalLines}`}
        subtext="across all plants"
      />
      <KPI
        label={t.kpiTodaysQty}
        icon="package"
        value={(kpis.todaysQty / 1000).toFixed(1)}
        unit="t"
        subtext={`${kpis.todaysCount} orders today`}
      />
      <KPI
        label={t.kpiUtilization}
        icon="trending-up"
        value={kpis.utilization}
        unit="%"
        subtext="next 24h capacity"
        progressBar={kpis.utilization}
        tone={kpis.utilization >= 75 ? 'ok' : kpis.utilization >= 55 ? 'warn' : 'risk'}
      />
      <KPI
        label={t.kpiOnTime}
        icon="clock"
        value={kpis.onTimePct}
        unit="%"
        subtext="last 48h closed"
        progressBar={kpis.onTimePct}
        tone={kpis.onTimePct >= 90 ? 'ok' : kpis.onTimePct >= 75 ? 'warn' : 'risk'}
      />
      <KPI
        label={t.kpiAtRisk}
        icon="alert-triangle"
        value={kpis.atRiskCount}
        subtext={kpis.atRiskCount === 0 ? 'all on track' : 'review schedule'}
        tone={kpis.atRiskCount === 0 ? 'ok' : 'risk'}
      />
      <KPI
        label={t.kpiMaterialShort || 'Shortages'}
        icon="alert-triangle"
        value={kpis.materialShortCount}
        subtext={`${kpis.wmInTransit || 0} WM in transit`}
        tone={kpis.materialShortCount === 0 ? 'ok' : 'risk'}
      />
      <KPI
        label={t.kpiDowntime || 'Downtime 24h'}
        icon="alert-triangle"
        value={`${Math.floor(kpis.downtimeMinsToday / 60)}h ${kpis.downtimeMinsToday % 60}m`}
        subtext={(kpis.activeDowntimeCount || 0) > 0 ? `${kpis.activeDowntimeCount} active now` : 'none active'}
        tone={kpis.activeDowntimeCount > 0 ? 'risk' : (kpis.downtimeMinsToday > 90 ? 'warn' : 'ok')}
      />
      <KPI
        label={t.kpiBacklog}
        icon="history"
        value={kpis.backlogCount}
        subtext={`${kpis.backlogUrgent} urgent`}
        tone={kpis.backlogUrgent > 0 ? 'risk' : 'neutral'}
      />
    </div>
  );
}

// =====================================================
// Legend
// =====================================================
function Legend({ t, showWm, setShowWm }: { t: any; showWm: boolean; setShowWm: (v: any) => void }) {
  const items = [
    { kind: 'running',         label: t.legendRunning },
    { kind: 'firm',            label: t.legendFirm },
    { kind: 'material-ready',  label: t.legendMaterialReady || 'Materials ready' },
    { kind: 'material-short',  label: t.legendMaterialShort || 'Material shortage' },
    { kind: 'completed',       label: t.legendCompleted },
    { kind: 'atrisk',          label: t.legendAtRisk },
    { kind: 'changeover',      label: t.legendChangeover },
    { kind: 'cleaning',        label: t.legendCleaning },
    { kind: 'maintenance',     label: t.legendMaintenance },
    { kind: 'downtime',        label: t.legendDowntime || 'Unplanned downtime' },
  ];
  return (
    <div className="plan-legend" style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11.5, color: 'var(--text-2)' }}>
      {items.map(it => (
        <span className="leg-item" key={it.kind} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`leg-swatch swatch-${it.kind}`} style={{ width: 10, height: 10, borderRadius: 2 }} />
          {it.label}
        </span>
      ))}
      <span style={{ width: 1, height: 16, background: 'var(--line-1)', margin: '0 4px' }} />
      <button
        className={`btn btn-xs ${showWm ? 'btn-primary' : 'btn-ghost'}`}
        style={{ fontSize: 10, height: 22 }}
        onClick={() => setShowWm((v: boolean) => !v)}
      >
        <Icon name={showWm ? 'check' : 'plus'} size={10} style={{ marginRight: 4 }} />
        {t.wmShowHide || 'WM transfers'}
      </button>
    </div>
  );
}

// =====================================================
// Gantt
// =====================================================
function Gantt({ data, dayCols, windowStart, totalMs, pxPerHour, totalWidth, zoom, selectedBlock, setSelectedBlock, hoveredBacklog, showWm, t }: any) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const windowEnd = windowStart + totalMs;

  // Scroll to "now" on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const nowOffset = ((data.NOW - windowStart) / HOUR) * pxPerHour;
    scrollRef.current.scrollLeft = Math.max(0, nowOffset - 200);
  }, [pxPerHour, data.NOW, windowStart]);

  const nowX = ((data.NOW - windowStart) / HOUR) * pxPerHour;
  const todayStart = data.today;
  const todayX = ((todayStart - windowStart) / HOUR) * pxPerHour;

  return (
    <div className="gantt" style={{ flex: 1, display: 'flex', background: 'var(--surface-sunken)', overflow: 'hidden' }}>
      <div className="gantt-line-col" style={{ width: 180, flexShrink: 0, borderRight: '1px solid var(--line-1)', background: 'var(--surface-0)', zIndex: 10 }}>
        <div className="lane-head" style={{ height: 56, borderBottom: '1px solid var(--line-1)', padding: '0 16px', display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t.headerLine}
        </div>
        {data.lines.map((line: any) => (
          <div className="lane-head-row" key={line.id} style={{ height: 80, borderBottom: '1px solid var(--line-1)', padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="lane-name" style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{line.id}</span>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>{line.name}</span>
            </div>
            <div className="lane-meta" style={{ marginTop: 4, display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-3)' }}>
              <span>{line.cap}</span>
              <span>·</span>
              <span>{line.shift}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="gantt-scroll" ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
        <div className="gantt-grid" style={{ width: totalWidth, position: 'relative', height: '100%' }}>
          {/* Date header */}
          <div className="gantt-date-head" style={{ width: totalWidth, height: 56, borderBottom: '1px solid var(--line-1)', position: 'sticky', top: 0, background: 'var(--surface-0)', zIndex: 5 }}>
            {dayCols.map((c: any, i: number) => {
              const w = ((c.end - c.start) / HOUR) * pxPerHour;
              const left = ((c.start - windowStart) / HOUR) * pxPerHour;
              return (
                <div className={`day-col-head ${c.isToday ? 'today' : ''} ${c.isPast ? 'past' : ''}`} key={i} style={{ width: w, left, position: 'absolute', top: 0, height: '100%', borderRight: '1px solid var(--line-1)', padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}>{fmtDay(c.start)}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{fmtDate(c.start)}</div>
                  {c.isToday && <span className="today-pill" style={{ position: 'absolute', right: 8, top: 8, background: 'var(--status-ok)', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 99, fontWeight: 700 }}>{t.todayLabel}</span>}
                </div>
              );
            })}
          </div>

          {/* Vertical day separators */}
          <div className="gantt-day-sep-layer" style={{ width: totalWidth, position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {dayCols.map((c: any, i: number) => {
              const left = ((c.start - windowStart) / HOUR) * pxPerHour;
              return <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left, width: 1, background: 'var(--line-1)', opacity: 0.5 }} />;
            })}
            {/* "Today" bg highlight */}
            <div className="today-bg" style={{ position: 'absolute', top: 0, bottom: 0, left: todayX, width: 24 * pxPerHour, background: 'var(--status-ok)', opacity: 0.03 }} />
          </div>

          {/* Lanes */}
          {data.lines.map((line: any, li: number) => {
            const lineBlocks = data.blocks.filter((b: any) => b.lineId === line.id);
            const lineWmts = (data.wmTransfers || []).filter((w: any) => w.lineId === line.id);
            return (
              <div key={line.id} style={{ width: totalWidth, height: 80, position: 'relative', borderBottom: '1px solid var(--line-1)', background: li % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                {lineBlocks.map((b: any) => {
                  const x = ((b.start - windowStart) / HOUR) * pxPerHour;
                  const w = ((b.end - b.start) / HOUR) * pxPerHour;
                  return (
                    <Block
                      key={b.id}
                      block={b}
                      x={x} w={w}
                      isSelected={selectedBlock?.id === b.id}
                      onClick={() => setSelectedBlock(selectedBlock?.id === b.id ? null : b)}
                      pxPerHour={pxPerHour}
                    />
                  );
                })}
                {/* Backlog drop preview */}
                {hoveredBacklog && hoveredBacklog.requiresLine === line.id && (
                  <BacklogPreview block={hoveredBacklog} pxPerHour={pxPerHour} laneStart={windowStart} now={data.NOW} />
                )}
              </div>
            );
          })}

          {/* NOW line */}
          <div className="now-line" style={{ position: 'absolute', top: 56, bottom: 0, left: nowX, width: 2, background: 'var(--status-risk)', zIndex: 8 }}>
            <span style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', background: 'var(--status-risk)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
              {t.nowLabel}
            </span>
          </div>
        </div>
      </div>

      {selectedBlock && (
        <BlockDetailDrawer block={selectedBlock} onClose={() => setSelectedBlock(null)} t={t} />
      )}
    </div>
  );
}

// =====================================================
// Block (a scheduled job on the gantt)
// =====================================================
function Block({ block, x, w, isSelected, onClick, pxPerHour }: any) {
  const showLabel = w > 60;
  const showSub = w > 120;
  const isOp = block.kind !== 'changeover' && block.kind !== 'cleaning' && block.kind !== 'maintenance' && block.kind !== 'downtime';
  const adt = block.activeDowntime;
  return (
    <div
      className={`gantt-block kind-${block.kind} ${isSelected ? 'selected' : ''} ${!isOp ? 'compact' : ''} ${adt ? 'has-active-downtime' : ''}`}
      style={{ 
        position: 'absolute', 
        top: isOp ? 8 : 24, 
        bottom: isOp ? 8 : 24, 
        left: x, 
        width: Math.max(4, w), 
        borderRadius: 4, 
        cursor: 'pointer',
        zIndex: isSelected ? 20 : 1,
        transition: 'all 0.1s ease',
        boxShadow: isSelected ? '0 0 0 3px var(--surface-0), 0 0 0 5px var(--status-warn)' : 'none',
        overflow: 'hidden'
      }}
      onClick={onClick}
      title={`${block.label} · ${fmtDateTime(block.start)} → ${fmtTime(block.end)}${adt ? ` · DOWN ${adt.durationMin}m (${adt.reasonLabel})` : ''}`}
    >
      {showLabel && (
        <div style={{ padding: '6px 10px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>
            {block.kind === 'running' && !adt && <span style={{ width: 6, height: 6, borderRadius: 99, background: 'currentColor', animation: 'pulse 2s infinite' }} />}
            <span>{block.label}</span>
          </div>
          {showSub && block.poId && block.kind !== 'downtime' && (
            <div style={{ fontSize: 10, opacity: 0.8, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {block.poId} · {block.qty?.toLocaleString()}{block.uom?.toLowerCase()}
            </div>
          )}
        </div>
      )}
      {!showLabel && isOp && <div style={{ width: 6, height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.5)', margin: 'auto' }} />}
    </div>
  );
}

function BacklogPreview({ block, pxPerHour, laneStart, now }: any) {
  // Show a ghost block at "now + small gap" of duration block.durationH
  const start = now + 0.5 * HOUR;
  const x = ((start - laneStart) / HOUR) * pxPerHour;
  const w = block.durationH * pxPerHour;
  return (
    <div style={{ position: 'absolute', top: 8, bottom: 8, left: x, width: w, background: 'var(--surface-sunken)', border: '2px dashed var(--line-2)', borderRadius: 4, opacity: 0.6, pointerEvents: 'none' }}>
      <div style={{ padding: '6px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: 'var(--text-3)' }}>
          <Icon name="plus" size={12} />
          <span>{block.product}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
          {block.qty.toLocaleString()}kg · {block.durationH}h
        </div>
      </div>
    </div>
  );
}


// =====================================================
// Block detail drawer
// =====================================================
function BlockDetailDrawer({ block, onClose, t }: any) {
  const isOp = block.kind !== 'changeover' && block.kind !== 'cleaning' && block.kind !== 'maintenance' && block.kind !== 'downtime';
  const isDowntime = block.kind === 'downtime';
  const openOrder = () => {
    if (!block.poId) return;
    if ((window as any).__navigateToOrder) {
      (window as any).__navigateToOrder(block.poId, {
        _from: 'planning',
        start: block.start,
        end: block.end,
        materialId: block.materialId,
        label: block.label,
        category: block.sublabel?.split('·')?.[1]?.trim() || null,
        plantId: null,
        operator: block.operator,
        shift: block.shift,
        kind: block.kind,
        qty: block.qty,
        lineId: block.lineId,
        materials: block.materials,
        shortageETA: block.shortageETA,
      });
    }
  };
  const isShort = block.kind === 'material-short';
  return (
    <div className="block-drawer" style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 360, background: 'var(--surface-0)', borderLeft: '1px solid var(--line-1)', zIndex: 100, boxShadow: '-10px 0 30px rgba(0,0,0,0.1)', padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
      <div className="bd-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, background: 'var(--surface-sunken)', color: 'var(--text-2)' }}>{block.kind.replace('-',' ')}</span>
          <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 4, background: 'var(--line-1)', color: 'var(--text-1)' }}>{block.lineId}</span>
        </div>
        <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
      </div>
      
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{block.label}</div>
        {block.sublabel && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{block.sublabel}</div>}
      </div>

      {(isDowntime || block.activeDowntime || isShort) && (
        <div style={{ background: 'var(--status-risk-surface)', border: '1px solid var(--status-risk)', borderRadius: 6, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-risk)', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
            <Icon name="alert-triangle" size={16} />
            <span>{isDowntime ? (t.legendDowntime || 'Unplanned downtime') : isShort ? (t.legendMaterialShort || 'Material shortage') : 'Active downtime'}</span>
          </div>
          {isDowntime && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-3)' }}>Reason</span>
                <span style={{ fontWeight: 600 }}>{block.reasonCategory} · {block.reasonCode}</span>
              </div>
            </div>
          )}
          {isShort && block.shortageETA && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-3)' }}>Material ETA</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtDateTime(block.shortageETA)}</span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Start</div>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{fmtDateTime(block.start)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>End</div>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{fmtDateTime(block.end)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Duration</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{((block.end - block.start) / HOUR).toFixed(1)} h</div>
        </div>
        {isOp && (
          <>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Quantity</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{block.qty?.toLocaleString()} {block.uom}</div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>PO / Material</div>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--valentia-slate)' }}>{block.poId} · {block.materialId}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isOp && <Button variant="primary" onClick={openOrder} icon={<Icon name="eye" />}>{t.blockOpenOrder || t.blockPopOpen}</Button>}
        <Button variant="secondary" icon={<Icon name="calendar" />}>{t.blockPopReschedule}</Button>
        {isOp && <Button variant="secondary" icon={<Icon name="copy" />}>{t.blockPopSplit}</Button>}
        {isOp && (block.kind === 'material-ready' || block.kind === 'material-short') && (
          <Button variant="secondary" icon={<Icon name="archive" />}>{t.blockPopUnschedule}</Button>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Backlog rail
// =====================================================
function BacklogRail({ backlog, NOW, hovered, setHovered, t }: any) {
  const sorted = useMemo(() => {
    const order: Record<string, number> = { urgent: 0, high: 1, normal: 2 };
    return [...backlog].sort((a, b) => order[a.priority] - order[b.priority] || a.due - b.due);
  }, [backlog]);

  return (
    <aside className="backlog-rail" style={{ width: 300, borderLeft: '1px solid var(--line-1)', background: 'var(--surface-sunken)', display: 'flex', flexDirection: 'column' }}>
      <div className="backlog-head" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line-1)', background: 'var(--surface-0)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--text-1)' }}>
          <Icon name="history" size={14} />
          <span>{t.backlogTitle}</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: 'var(--line-1)', color: 'var(--text-2)' }}>{backlog.length}</span>
      </div>

      <div style={{ padding: '12px 20px', background: 'var(--surface-0)', borderBottom: '1px solid var(--line-1)' }}>
        <div className="search-box" style={{ position: 'relative' }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input 
            placeholder="Filter backlog…" 
            style={{ width: '100%', padding: '6px 12px 6px 32px', fontSize: 13, border: '1px solid var(--line-1)', borderRadius: 6, background: 'var(--surface-sunken)' }}
          />
        </div>
      </div>

      <div className="backlog-list" style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.map((item: any) => {
          const isHovered = hovered?.id === item.id;
          return (
            <div
              key={item.id}
              className={`backlog-card pri-${item.priority} ${isHovered ? 'hovered' : ''}`}
              style={{ 
                background: 'var(--surface-0)', 
                border: '1px solid var(--line-1)', 
                borderRadius: 8, 
                padding: 12, 
                cursor: 'grab',
                boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                borderLeft: `4px solid ${item.priority === 'urgent' ? 'var(--status-risk)' : item.priority === 'high' ? 'var(--status-warn)' : 'var(--line-2)'}`
              }}
              onMouseEnter={() => setHovered(item)}
              onMouseLeave={() => setHovered(null)}
              draggable
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.priority}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{t.backlogDue} <strong>{fmtRelativeDue(item.due, NOW)}</strong></span>
              </div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 2 }}>PO {item.poId}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>{item.product}</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{item.materialId}</span>
                <span>{item.qty.toLocaleString()} {item.uom}</span>
                <span>{item.durationH}h</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-xs btn-ghost"
                  style={{ flex: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if ((window as any).__navigateToOrder) {
                      (window as any).__navigateToOrder(item.poId, {
                        _from: 'planning',
                        materialId: item.materialId,
                        label: item.product,
                        category: item.category,
                        qty: item.qty,
                        kind: 'material-ready',
                        lineId: item.requiresLine,
                      });
                    }
                  }}
                >
                  <Icon name="eye" size={12} style={{ marginRight: 4 }} />
                  {t.backlogOpenOrder || 'Open'}
                </button>
                <button className="btn btn-xs btn-primary" style={{ flex: 1 }}>
                  <Icon name="plus" size={12} style={{ marginRight: 4 }} />
                  {t.schedulePlan}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export { PlanningBoard }
