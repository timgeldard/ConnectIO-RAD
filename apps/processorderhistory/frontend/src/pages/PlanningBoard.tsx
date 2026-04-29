// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n/context'
import { I as DI, TopBar } from '../ui'
import { fetchPlanningSchedule } from '../api/planning'

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// ---- helpers ----
function fmtDay(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}
function fmtDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
function fmtTime(ms) {
  const d = new Date(ms);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtDateTime(ms) {
  return fmtDate(ms) + ' · ' + fmtTime(ms);
}
function fmtRelativeDue(ms, now) {
  const diff = ms - now;
  if (diff < 0) return 'OVERDUE';
  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / HOUR);
  if (days === 0) return hours + 'h';
  if (days === 1) return 'tomorrow';
  return days + 'd';
}

// =====================================================
// Planning Board root
// =====================================================
function PlanningBoard() {
  const { t } = useT();
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState('week');  // 'day' | 'week'
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [hoveredBacklog, setHoveredBacklog] = useState(null);
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
    const lines = scheduleData.lines.map(id => ({ id, name: id, cap: '—', shift: '—' }));
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
      <>
        <TopBar trail={[t.operations, t.crumbManufacturing || 'Manufacturing', t.navPlanning]} />
        <div className="loading-state" style={{padding:'48px',textAlign:'center',color:'var(--ink-400)'}}>
          Loading schedule…
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <TopBar trail={[t.operations, t.crumbManufacturing || 'Manufacturing', t.navPlanning]} />
        <div className="error-state" style={{padding:'48px',textAlign:'center',color:'var(--danger)'}}>
          {error || 'No data available.'}
        </div>
      </>
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
  const dayCols = [];
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
    <>
      <TopBar
        trail={[t.operations, t.crumbManufacturing || 'Manufacturing', t.navPlanning]}
      />

      <div className="planning-head">
        <div className="planning-id-row">
          <div className="id-block">
            <div className="detail-eyebrow">{DI.layers}<span>{t.planningTitle}</span></div>
            <h1 className="detail-title" style={{margin:'8px 0 4px'}}>
              <span>{t.planningTitle}</span>
            </h1>
            <div className="detail-product">
              {t.planningSubtitle}
              <span className="sku">{data.lines.length} lines · {data.kpis.backlogCount} in backlog</span>
            </div>
          </div>
          <div className="detail-actions">
            <button className="btn secondary">{DI.printer}<span>Print plan</span></button>
            <button className="btn primary">{DI.plus}<span>{t.schedulePlan}</span></button>
          </div>
        </div>

        <KpiStrip kpis={data.kpis} t={t} />
      </div>

      <div className="planning-toolbar">
        <div className="planning-tools-l">
          <button className="chip" style={{cursor:'default'}}>
            {DI.calendar}<span>{fmtDate(windowStart)} – {fmtDate(windowEnd - 1)}</span>
          </button>
          <button className="chip">
            {DI.factory}<span>All plants · {data.lines.length} lines</span>
          </button>
          <button className="chip">
            {DI.filter}<span>All categories</span>
          </button>
        </div>
        <div className="planning-tools-r">
          <Legend t={t} showWm={showWm} setShowWm={setShowWm} />
          <div className="zoom-toggle">
            <span className="zoom-l">{t.zoomLabel}</span>
            <button className={zoom === 'day' ? 'active' : ''} onClick={() => setZoom('day')}>{t.viewDay}</button>
            <button className={zoom === 'week' ? 'active' : ''} onClick={() => setZoom('week')}>{t.viewWeek}</button>
          </div>
        </div>
      </div>

      <div className="planning-body">
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
    </>
  );
}

// =====================================================
// KPI Strip
// =====================================================
function KpiStrip({ kpis, t }) {
  const cells = [
    {
      label: t.kpiLinesRunning, icon: DI.factory,
      value: <>{kpis.runningCount}<span className="unit">/ {kpis.totalLines}</span></>,
      sub: 'across all plants',
      tone: 'neutral',
    },
    {
      label: t.kpiTodaysQty, icon: DI.package,
      value: <>{(kpis.todaysQty / 1000).toFixed(1)}<span className="unit">t</span></>,
      sub: kpis.todaysCount + ' orders today',
      tone: 'neutral',
    },
    {
      label: t.kpiUtilization, icon: DI.trending,
      value: <>{kpis.utilization}<span className="unit">%</span></>,
      sub: 'next 24h capacity',
      tone: kpis.utilization >= 75 ? 'good' : kpis.utilization >= 55 ? 'ok' : 'bad',
      bar: kpis.utilization,
    },
    {
      label: t.kpiOnTime, icon: DI.clock,
      value: <>{kpis.onTimePct}<span className="unit">%</span></>,
      sub: 'last 48h closed',
      tone: kpis.onTimePct >= 90 ? 'good' : kpis.onTimePct >= 75 ? 'ok' : 'bad',
      bar: kpis.onTimePct,
    },
    {
      label: t.kpiAtRisk, icon: DI.alert,
      value: kpis.atRiskCount,
      sub: kpis.atRiskCount === 0 ? 'all on track' : 'review schedule',
      tone: kpis.atRiskCount === 0 ? 'good' : 'bad',
    },
    {
      label: t.kpiMaterialShort || 'Shortages', icon: DI.alert,
      value: kpis.materialShortCount,
      sub: (kpis.wmInTransit || 0) + ' WM in transit',
      tone: kpis.materialShortCount === 0 ? 'good' : 'bad',
    },
    {
      label: t.kpiDowntime || 'Downtime 24h', icon: DI.alert,
      value: <>{Math.floor(kpis.downtimeMinsToday / 60)}<span className="unit">h</span> {kpis.downtimeMinsToday % 60}<span className="unit">m</span></>,
      sub: (kpis.activeDowntimeCount || 0) > 0 ? kpis.activeDowntimeCount + ' active now' : 'none active',
      tone: kpis.activeDowntimeCount > 0 ? 'bad' : (kpis.downtimeMinsToday > 90 ? 'ok' : 'good'),
    },
    {
      label: t.kpiBacklog, icon: DI.history,
      value: kpis.backlogCount,
      sub: kpis.backlogUrgent + ' urgent',
      tone: kpis.backlogUrgent > 0 ? 'bad' : 'neutral',
    },
  ];
  return (
    <div className="plan-kpi-strip cells-8">
      {cells.map((c, i) => (
        <div className={`plan-kpi tone-${c.tone}`} key={i}>
          <div className="kpi-l">
            <span className="kpi-icon">{c.icon}</span>
            <span className="kpi-label">{c.label}</span>
          </div>
          <div className="kpi-value">{c.value}</div>
          <div className="kpi-sub">{c.sub}</div>
          {c.bar != null && (
            <div className="kpi-bar"><div className="fill" style={{width: c.bar + '%'}} /></div>
          )}
        </div>
      ))}
    </div>
  );
}

// =====================================================
// Legend
// =====================================================
function Legend({ t, showWm, setShowWm }) {
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
    <div className="plan-legend">
      {items.map(it => (
        <span className="leg-item" key={it.kind}>
          <span className={`leg-swatch swatch-${it.kind}`} />
          {it.label}
        </span>
      ))}
      <span className="leg-divider" />
      <span className="leg-item leg-wm-group">
        <span className="leg-wm-bar wm-delivered" />
        <span className="leg-wm-bar wm-in-transit" />
        <span className="leg-wm-bar wm-pending" />
        <span className="leg-wm-bar wm-delayed" />
        <span style={{marginLeft: 4}}>{t.wmRailTitle || 'WM Replenishment'}</span>
      </span>
      <button
        className={`wm-toggle-btn ${showWm ? 'active' : ''}`}
        onClick={() => setShowWm(v => !v)}
        title={t.wmShowHide || 'WM transfers'}
      >
        {showWm ? '◉' : '○'} {t.wmShowHide || 'WM transfers'}
      </button>
    </div>
  );
}

// =====================================================
// Gantt
// =====================================================
function Gantt({ data, dayCols, windowStart, totalMs, pxPerHour, totalWidth, zoom, selectedBlock, setSelectedBlock, hoveredBacklog, showWm, t }) {
  const scrollRef = useRef(null);
  const windowEnd = windowStart + totalMs;

  // Scroll to "now" on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const nowOffset = ((data.NOW - windowStart) / HOUR) * pxPerHour;
    scrollRef.current.scrollLeft = Math.max(0, nowOffset - 200);
  }, [pxPerHour]);

  const nowX = ((data.NOW - windowStart) / HOUR) * pxPerHour;
  const todayStart = data.today;
  const todayX = ((todayStart - windowStart) / HOUR) * pxPerHour;

  return (
    <div className="gantt">
      <div className="gantt-line-col">
        <div className="lane-head">
          <div className="lane-head-title">{t.headerLine}</div>
        </div>
        {data.lines.map(line => (
          <div className="lane-head-row" key={line.id}>
            <div className="lane-name">
              <span className="lane-id">{line.id}</span>
              <span className="lane-label">{line.name}</span>
            </div>
            <div className="lane-meta">
              <span className="lane-cap">{line.cap}</span>
              <span className="lane-shift">{line.shift}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="gantt-scroll" ref={scrollRef}>
        <div className="gantt-grid" style={{ width: totalWidth }}>
          {/* Date header */}
          <div className="gantt-date-head" style={{ width: totalWidth }}>
            {dayCols.map((c, i) => {
              const w = ((c.end - c.start) / HOUR) * pxPerHour;
              const left = ((c.start - windowStart) / HOUR) * pxPerHour;
              return (
                <div className={`day-col-head ${c.isToday ? 'today' : ''} ${c.isPast ? 'past' : ''}`} key={i} style={{ width: w, left }}>
                  <div className="day-name">{fmtDay(c.start)}</div>
                  <div className="day-date">{fmtDate(c.start)}</div>
                  {c.isToday && <span className="today-pill">{t.todayLabel}</span>}
                </div>
              );
            })}
            {/* Hour ticks for day view */}
            {zoom === 'day' && dayCols.map((c, di) => (
              <React.Fragment key={'h' + di}>
                {[6,12,18].map(h => {
                  const ms = c.start + h * HOUR;
                  if (ms >= windowEnd) return null;
                  const x = ((ms - windowStart) / HOUR) * pxPerHour;
                  return (
                    <div className="hour-tick" key={'ht' + di + h} style={{ left: x }}>
                      <span>{String(h).padStart(2,'0')}:00</span>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Vertical day separators */}
          <div className="gantt-day-sep-layer" style={{ width: totalWidth }}>
            {dayCols.map((c, i) => {
              const left = ((c.start - windowStart) / HOUR) * pxPerHour;
              return <div key={i} className={`day-sep ${c.isToday ? 'today' : ''} ${c.isPast ? 'past' : ''}`} style={{ left }} />;
            })}
            {/* "Today" bg highlight */}
            <div className="today-bg" style={{ left: todayX, width: 24 * pxPerHour }} />
          </div>

          {/* Lanes */}
          {data.lines.map((line, li) => {
            const lineBlocks = data.blocks.filter(b => b.lineId === line.id);
            const lineWmts = (data.wmTransfers || []).filter(w => w.lineId === line.id);
            return (
              <div className={`gantt-lane ${li % 2 === 1 ? 'alt' : ''}`} key={line.id} style={{ width: totalWidth }}>
                {/* Half-day grid lines */}
                {dayCols.map((c, di) => {
                  const left = ((c.start - windowStart) / HOUR) * pxPerHour;
                  return (
                    <React.Fragment key={'g' + di}>
                      <div className="lane-vline major" style={{ left }} />
                      <div className="lane-vline minor" style={{ left: left + 12 * pxPerHour }} />
                    </React.Fragment>
                  );
                })}
                {lineBlocks.map(b => {
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
                {/* WM Replenishment ribbon (top of lane) */}
                {showWm && lineWmts.map(w => {
                  const x = ((w.start - windowStart) / HOUR) * pxPerHour;
                  const wd = Math.max(8, ((w.end - w.start) / HOUR) * pxPerHour);
                  return (
                    <div
                      key={w.id}
                      className={`wm-ribbon wm-${w.status}`}
                      style={{ left: x, width: wd }}
                      title={`${w.id} · ${w.materialName} · ${w.qty}${w.uom} · ${w.status}`}
                    >
                      <span className="wm-rib-label">{w.id.replace('WMT-','')} · {w.qty}kg</span>
                    </div>
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
          <div className="now-line" style={{ left: nowX, height: 'calc(100% - 56px)', top: 56 }}>
            <span className="now-label">{t.nowLabel}</span>
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
function Block({ block, x, w, isSelected, onClick, pxPerHour }) {
  const showLabel = w > 60;
  const showSub = w > 120;
  const isOp = block.kind !== 'changeover' && block.kind !== 'cleaning' && block.kind !== 'maintenance' && block.kind !== 'downtime';
  const adt = block.activeDowntime;
  return (
    <div
      className={`gantt-block kind-${block.kind} ${isSelected ? 'selected' : ''} ${!isOp ? 'compact' : ''} ${adt ? 'has-active-downtime' : ''}`}
      style={{ left: x, width: w }}
      onClick={onClick}
      title={`${block.label} · ${fmtDateTime(block.start)} → ${fmtTime(block.end)}${adt ? ` · DOWN ${adt.durationMin}m (${adt.reasonLabel})` : ''}`}
    >
      {showLabel && (
        <div className="gb-body">
          <div className="gb-title">
            {block.kind === 'running' && !adt && <span className="gb-pulse" />}
            {block.kind === 'material-short' && <span className="gb-short-icon" title="Material shortage">!</span>}
            {block.kind === 'downtime' && <span className="gb-down-icon" title="Downtime">⏻</span>}
            {adt && <span className="gb-down-icon active" title="Active downtime">⏻</span>}
            <span>{block.label}</span>
          </div>
          {showSub && block.poId && block.kind !== 'downtime' && (
            <div className="gb-sub mono">{block.poId} · {block.qty?.toLocaleString()}{block.uom?.toLowerCase()}</div>
          )}
          {showSub && block.kind === 'downtime' && (
            <div className="gb-sub mono">{block.reasonCode} · {Math.round((block.end-block.start)/60000)}m</div>
          )}
          {showSub && !block.poId && block.kind !== 'downtime' && (
            <div className="gb-sub">{block.sublabel}</div>
          )}
          {adt && showSub && (
            <div className="gb-active-downtime mono">DOWN {adt.durationMin}m · {adt.reasonCode}</div>
          )}
        </div>
      )}
      {!showLabel && isOp && <span className="gb-dot" />}
    </div>
  );
}

function BacklogPreview({ block, pxPerHour, laneStart, now }) {
  // Show a ghost block at "now + small gap" of duration block.durationH
  const start = now + 0.5 * HOUR;
  const x = ((start - laneStart) / HOUR) * pxPerHour;
  const w = block.durationH * pxPerHour;
  return (
    <div className="gantt-block ghost" style={{ left: x, width: w }}>
      <div className="gb-body">
        <div className="gb-title">{DI.plus}<span>{block.product}</span></div>
        <div className="gb-sub mono">{block.qty.toLocaleString()}kg · {block.durationH}h</div>
      </div>
    </div>
  );
}

// =====================================================
// Block detail drawer
// =====================================================
function BlockDetailDrawer({ block, onClose, t }) {
  const isOp = block.kind !== 'changeover' && block.kind !== 'cleaning' && block.kind !== 'maintenance' && block.kind !== 'downtime';
  const isDowntime = block.kind === 'downtime';
  const openOrder = () => {
    if (!block.poId) return;
    if (window.__navigateToOrder) {
      window.__navigateToOrder(block.poId, {
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
    <div className="block-drawer">
      <div className="bd-head">
        <span className={`bd-status kind-${block.kind}`}>{block.kind.replace('-',' ')}</span>
        <span className="bd-line mono">{block.lineId}</span>
        <button className="bd-close" onClick={onClose}>{DI.x}</button>
      </div>
      <div className="bd-title">{block.label}</div>
      {block.sublabel && <div className="bd-sub">{block.sublabel}</div>}

      {isDowntime && (
        <div className="bd-shortage bd-downtime">
          <div className="bd-shortage-head">
            {DI.alert}<span>{t.legendDowntime || 'Unplanned downtime'}</span>
          </div>
          <div className="bd-shortage-row">
            <span className="bd-l">Reason</span>
            <span className="bd-v">{block.reasonCategory} · {block.reasonCode}</span>
          </div>
          {block.hostPoId && (
            <div className="bd-shortage-row">
              <span className="bd-l">Interrupted PO</span>
              <span className="bd-v mono">{block.hostPoId} · {block.hostLabel}</span>
            </div>
          )}
        </div>
      )}

      {block.activeDowntime && (
        <div className="bd-shortage bd-downtime active">
          <div className="bd-shortage-head">
            {DI.alert}<span>Active downtime · {block.activeDowntime.durationMin}m</span>
          </div>
          <div className="bd-shortage-row">
            <span className="bd-l">Reason</span>
            <span className="bd-v">{block.activeDowntime.reasonCategory} · {block.activeDowntime.reasonCode}</span>
          </div>
          <div className="bd-shortage-row">
            <span className="bd-l">Detail</span>
            <span className="bd-v">{block.activeDowntime.detail}</span>
          </div>
          <div className="bd-shortage-row">
            <span className="bd-l">Since</span>
            <span className="bd-v mono">{fmtTime(block.activeDowntime.since)}</span>
          </div>
        </div>
      )}

      {isShort && (
        <div className="bd-shortage">
          <div className="bd-shortage-head">
            {DI.alert}<span>{t.legendMaterialShort || 'Material shortage'}</span>
          </div>
          {block.shortageItem && (
            <div className="bd-shortage-row">
              <span className="bd-l">{t.shortageItemLabel || 'Critical item'}</span>
              <span className="bd-v">{block.shortageItem}</span>
            </div>
          )}
          {block.shortageETA && (
            <div className="bd-shortage-row">
              <span className="bd-l">{t.shortageEtaLabel || 'Material ETA'}</span>
              <span className="bd-v mono">{fmtDateTime(block.shortageETA)}</span>
            </div>
          )}
        </div>
      )}

      <div className="bd-grid">
        <div><div className="bd-l">Start</div><div className="bd-v mono">{fmtDateTime(block.start)}</div></div>
        <div><div className="bd-l">End</div><div className="bd-v mono">{fmtDateTime(block.end)}</div></div>
        <div><div className="bd-l">Duration</div><div className="bd-v mono">{((block.end - block.start) / HOUR).toFixed(1)} h</div></div>
        {isOp && <div><div className="bd-l">Quantity</div><div className="bd-v mono">{block.qty?.toLocaleString()} {block.uom}</div></div>}
        {isOp && <div><div className="bd-l">PO</div><div className="bd-v mono" style={{color:'var(--valentia-slate)'}}>{block.poId}</div></div>}
        {isOp && <div><div className="bd-l">Material</div><div className="bd-v mono">{block.materialId}</div></div>}
        {isOp && <div><div className="bd-l">Customer</div><div className="bd-v">{block.customer}</div></div>}
        <div><div className="bd-l">Shift</div><div className="bd-v">{block.shift}</div></div>
        <div><div className="bd-l">Operator</div><div className="bd-v">{block.operator}</div></div>
        {isOp && block.ratePerH && <div><div className="bd-l">Run rate</div><div className="bd-v mono">{block.ratePerH} kg/h</div></div>}
      </div>

      <div className="bd-actions">
        {isOp && <button className="btn primary" onClick={openOrder}>{DI.eye}<span>{t.blockOpenOrder || t.blockPopOpen}</span></button>}
        <button className="btn secondary">{DI.calendar}<span>{t.blockPopReschedule}</span></button>
        {isOp && <button className="btn secondary">{DI.copy}<span>{t.blockPopSplit}</span></button>}
        {isOp && (block.kind === 'material-ready' || block.kind === 'material-short') && (
          <button className="btn secondary">{DI.archive}<span>{t.blockPopUnschedule}</span></button>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Backlog rail
// =====================================================
function BacklogRail({ backlog, NOW, hovered, setHovered, t }) {
  const sorted = useMemo(() => {
    const order = { urgent: 0, high: 1, normal: 2 };
    return [...backlog].sort((a, b) => order[a.priority] - order[b.priority] || a.due - b.due);
  }, [backlog]);

  return (
    <aside className="backlog-rail">
      <div className="backlog-head">
        <div className="bh-title">{DI.history}<span>{t.backlogTitle}</span></div>
        <span className="bh-count">{backlog.length}</span>
      </div>
      <div className="backlog-sub">{t.backlogSubtitle}</div>

      <div className="backlog-search">
        <span className="bs-icon">{DI.search}</span>
        <input placeholder="Filter backlog…" />
      </div>

      <div className="backlog-list">
        {sorted.map(item => {
          const isHovered = hovered?.id === item.id;
          return (
            <div
              className={`backlog-card pri-${item.priority} ${isHovered ? 'hovered' : ''}`}
              key={item.id}
              onMouseEnter={() => setHovered(item)}
              onMouseLeave={() => setHovered(null)}
              draggable
            >
              <div className="bc-head">
                <span className={`pri-pill pri-${item.priority}`}>
                  {item.priority === 'urgent' ? t.backlogPriorityUrgent : item.priority === 'high' ? t.backlogPriorityHigh : t.backlogPriorityNormal}
                </span>
                <span className="bc-due">{t.backlogDue} <strong>{fmtRelativeDue(item.due, NOW)}</strong></span>
              </div>
              <div className="bc-poid mono">PO {item.poId}</div>
              <div className="bc-product">{item.product}</div>
              <div className="bc-meta">
                <span className="mono">{item.materialId}</span>
                <span>·</span>
                <span>{item.category}</span>
              </div>
              <div className="bc-foot">
                <div className="bc-stat">
                  <span className="bc-l">{t.backlogQty}</span>
                  <span className="bc-v mono">{item.qty.toLocaleString()} {item.uom}</span>
                </div>
                <div className="bc-stat">
                  <span className="bc-l">{t.backlogDuration}</span>
                  <span className="bc-v mono">{item.durationH}h</span>
                </div>
                <div className="bc-stat">
                  <span className="bc-l">{t.backlogPrefersLine}</span>
                  <span className="bc-v mono">{item.requiresLine}</span>
                </div>
              </div>
              <div className="bc-customer">{item.customer}</div>
              <div className="bc-actions">
                <button
                  className="bc-open"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.__navigateToOrder) {
                      window.__navigateToOrder(item.poId, {
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
                  {DI.eye}<span>{t.backlogOpenOrder || 'Open order'}</span>
                </button>
                <button className="bc-schedule">{DI.plus}<span>{t.schedulePlan}</span></button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export { PlanningBoard }
