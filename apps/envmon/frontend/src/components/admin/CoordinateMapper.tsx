/**
 * CoordinateMapper — multi-plant admin spatial authoring tool.
 *
 * Top bar:   plant selector (all plants with inspection lots)
 * Left bar:  floor management + unmapped/mapped location lists
 * Canvas:    drag-and-drop + pointer-repositioning of markers on the floor plan
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@connectio/shared-frontend-i18n';
import { IconTrash, IconMove, IconPlus, IconX, IconSearch } from '~/components/ui/Icons';
import { DataTable, type Column, Button } from '@connectio/shared-ui';
import type { PlantInfo } from '~/types';
import { useEM } from '~/context/EMContext';
import {
  usePlants,
  useFloors,
  useUnmappedLocations,
  useMappedLocations,
  useSaveCoordinate,
  useDeleteCoordinate,
  useHeatmap,
  useAddFloor,
  useDeleteFloor,
  usePlantGeoConfig,
  useUpsertPlantGeo,
} from '~/api/client';

const MARKER_R = 10;
const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 700;

const STATUS_CLASS: Record<string, string> = {
  PASS:    'em-marker--pass',
  FAIL:    'em-marker--fail',
  WARNING: 'em-marker--warning',
  PENDING: 'em-marker--pending',
  NO_DATA: 'em-marker--no-data',
};

const STATUS_FILL: Record<string, string> = {
  'em-marker--pass':    'var(--jade)',
  'em-marker--fail':    'var(--sunset)',
  'em-marker--warning': 'var(--sunrise)',
  'em-marker--pending': 'var(--sage)',
  'em-marker--no-data': 'color-mix(in srgb, var(--forest) 35%, white)',
};

type DragSource = { funcLocId: string };

function parseLevels(id: string): string[] { return id.split('-'); }
function levelsAt(ids: string[], idx: number): string[] {
  return Array.from(new Set(ids.map((id) => parseLevels(id)[idx]).filter(Boolean))).sort();
}

// ---------------------------------------------------------------------------
// Add-floor inline form
// ---------------------------------------------------------------------------
/**
 * Props for the AddFloorForm component.
 */
interface AddFloorFormProps {
  /** The unique identifier of the plant. */
  plantId: string;
  /** Callback function called when the floor addition is complete or cancelled. */
  onDone: () => void;
}

/**
 * Inline form for adding a new floor to a plant in admin mode.
 */
function AddFloorForm({ plantId, onDone }: AddFloorFormProps) {
  const { t } = useI18n();
  const { mutate: addFloor, isPending } = useAddFloor();
  const [floorId,   setFloorId]   = useState('');
  const [floorName, setFloorName] = useState('');
  const [svgUrl,    setSvgUrl]    = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!floorId.trim() || !floorName.trim()) return;
    addFloor(
      { plant_id: plantId, floor_id: floorId.trim(), floor_name: floorName.trim(),
        svg_url: svgUrl.trim() || undefined, sort_order: 1 },
      { onSuccess: onDone },
    );
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-1)' }}>
      <div style={{ fontSize: 'var(--fs-12)', fontWeight: 600, marginBottom: 8, color: 'var(--text-1)' }}>{t('envmon.admin.floor.addFloor')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input placeholder={t('envmon.admin.floor.placeholder.id')} value={floorId} onChange={(e) => setFloorId(e.target.value)}
          style={{ fontSize: 'var(--fs-12)', padding: '4px 8px', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)', background: 'var(--surface-1)', color: 'var(--text-1)' }} />
        <input placeholder={t('envmon.admin.floor.placeholder.name')} value={floorName} onChange={(e) => setFloorName(e.target.value)}
          style={{ fontSize: 'var(--fs-12)', padding: '4px 8px', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)', background: 'var(--surface-1)', color: 'var(--text-1)' }} />
        <input placeholder={t('envmon.admin.floor.placeholder.svgUrl')} value={svgUrl} onChange={(e) => setSvgUrl(e.target.value)}
          style={{ fontSize: 'var(--fs-12)', padding: '4px 8px', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)', background: 'var(--surface-1)', color: 'var(--text-1)' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="primary" size="sm" type="submit" disabled={isPending || !floorId.trim() || !floorName.trim()}>
            {isPending ? t('envmon.admin.floor.adding') : t('envmon.admin.floor.add')}
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={onDone}>{t('envmon.admin.floor.cancel')}</Button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Plant geo editor
// ---------------------------------------------------------------------------

/**
 * Table editor for setting WGS-84 lat/lon coordinates for each plant (global map pin positions).
 */
function PlantGeoPanel() {
  const { t } = useI18n();
  const { data: plants = [] } = usePlants();
  const { data: saved = [] } = usePlantGeoConfig();
  const { mutate: upsert, isPending } = useUpsertPlantGeo();

  const savedMap = React.useMemo(
    () => new Map(saved.map((e) => [e.plant_id, e])),
    [saved],
  );

  const [edits, setEdits] = React.useState<Record<string, { lat: string; lon: string }>>({});
  const [savedFlags, setSavedFlags] = React.useState<Record<string, boolean>>({});

  const getField = (plantId: string, field: 'lat' | 'lon'): string => {
    if (edits[plantId]?.[field] !== undefined) return edits[plantId][field];
    const v = savedMap.get(plantId)?.[field] ?? 0;
    return v === 0 ? '' : String(v);
  };

  const setField = (plantId: string, field: 'lat' | 'lon', value: string) => {
    setEdits((prev) => ({
      ...prev,
      [plantId]: { lat: getField(plantId, 'lat'), lon: getField(plantId, 'lon'), [field]: value },
    }));
    setSavedFlags((prev) => ({ ...prev, [plantId]: false }));
  };

  const handleSave = (plantId: string) => {
    const lat = parseFloat(getField(plantId, 'lat') || '0');
    const lon = parseFloat(getField(plantId, 'lon') || '0');
    if (isNaN(lat) || isNaN(lon)) return;
    upsert({ plantId, lat, lon }, {
      onSuccess: () => setSavedFlags((prev) => ({ ...prev, [plantId]: true })),
    });
  };

  const columns: Column<PlantInfo>[] = [
    {
      header: t('envmon.admin.geo.col.plant'),
      render: (p) => (
        <>
          <span style={{ fontWeight: 600 }}>{p.plant_code}</span>
          <span style={{ color: 'var(--text-3)', marginLeft: 6, fontSize: 'var(--fs-12)' }}>{p.plant_name}</span>
        </>
      )
    },
    {
      header: t('envmon.admin.geo.col.lat'),
      render: (p) => (
        <input
          type="number"
          step="any"
          placeholder="e.g. 53.3498"
          value={getField(p.plant_id, 'lat')}
          onChange={(e) => setField(p.plant_id, 'lat', e.target.value)}
          style={{ width: 130, padding: '5px 8px', fontSize: 'var(--fs-13)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)', background: 'var(--surface-1)', color: 'var(--text-1)' }}
        />
      )
    },
    {
      header: t('envmon.admin.geo.col.lon'),
      render: (p) => (
        <input
          type="number"
          step="any"
          placeholder="e.g. -6.2603"
          value={getField(p.plant_id, 'lon')}
          onChange={(e) => setField(p.plant_id, 'lon', e.target.value)}
          style={{ width: 130, padding: '5px 8px', fontSize: 'var(--fs-13)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)', background: 'var(--surface-1)', color: 'var(--text-1)' }}
        />
      )
    },
    {
      header: '',
      align: 'right',
      render: (p) => savedFlags[p.plant_id] ? (
        <span style={{ fontSize: 'var(--fs-12)', color: 'var(--status-ok)', fontFamily: 'var(--font-mono)' }}>{t('envmon.admin.geo.saved')}</span>
      ) : (
        <Button
          variant="primary"
          size="sm"
          disabled={isPending}
          onClick={() => handleSave(p.plant_id)}
        >
          {t('envmon.admin.geo.save')}
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '20px 24px', maxWidth: 840 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{t('envmon.admin.geo.eyebrow')}</div>
      <p style={{ fontSize: 'var(--fs-13)', color: 'var(--text-3)', marginTop: 0, marginBottom: 16 }}>
        {t('envmon.admin.geo.help')}
      </p>
      <DataTable
        columns={columns}
        rows={plants}
        rowKey={(p) => p.plant_id}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
/** Admin spatial authoring tool for mapping functional locations onto floor plans. */
export default function CoordinateMapper() {
  const { t } = useI18n();
  const [adminTab, setAdminTab] = React.useState<'floor' | 'geo'>('floor');
  const [locationTab, setLocationTab] = useState<'unmapped' | 'mapped'>('unmapped');
  const { timeWindow } = useEM();
  const svgRef = useRef<SVGSVGElement>(null);

  // Plant selection
  const { data: plants = [], isLoading: plantsLoading } = usePlants();
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const plantId = selectedPlantId ?? plants[0]?.plant_id ?? null;

  useEffect(() => {
    if (!selectedPlantId && plants.length > 0) setSelectedPlantId(plants[0].plant_id);
  }, [plants, selectedPlantId]);

  // Floors for selected plant
  const { data: floors = [], isLoading: floorsLoading } = useFloors(plantId);
  const [activeFloor, setActiveFloor] = useState<string | null>(null);
  const [showAddFloor, setShowAddFloor] = useState(false);
  const { mutate: deleteFloor } = useDeleteFloor();

  useEffect(() => {
    if (floors.length > 0 && (!activeFloor || !floors.find((f) => f.floor_id === activeFloor))) {
      setActiveFloor(floors[0].floor_id);
    }
  }, [floors, activeFloor]);

  const currentFloor = useMemo(
    () => floors.find((f) => f.floor_id === activeFloor) || floors[0] || null,
    [floors, activeFloor],
  );

  const viewWidth  = currentFloor?.svg_width  || DEFAULT_WIDTH;
  const viewHeight = currentFloor?.svg_height || DEFAULT_HEIGHT;

  // Heatmap status colouring
  const { data: heatmapData } = useHeatmap(plantId, activeFloor ?? '', 'deterministic', timeWindow);
  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    heatmapData?.markers.forEach((mk) => m.set(mk.func_loc_id, mk.status));
    return m;
  }, [heatmapData]);

  // Unmapped / mapped locations
  const { data: unmapped = [], isLoading: loadingUnmapped } = useUnmappedLocations(plantId);
  const { data: mapped   = [], isLoading: loadingMapped   } = useMappedLocations(plantId);
  const { mutate: saveCoordinate, isPending: isSaving   } = useSaveCoordinate();
  const { mutate: deleteCoordinate, isPending: isDeleting } = useDeleteCoordinate();

  const floorMapped = useMemo(
    () => mapped.filter((m) => m.floor_id === activeFloor),
    [mapped, activeFloor],
  );

  // Cascading filters
  const [l1, setL1] = useState('');
  const [l2, setL2] = useState('');
  const [l3, setL3] = useState('');
  const [l4, setL4] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const allIds = unmapped.map((u) => u.func_loc_id);
  const l1Options = useMemo(() => levelsAt(allIds, 0), [allIds]);
  const l2Ids = useMemo(() => l1 ? allIds.filter((id) => parseLevels(id)[0] === l1) : allIds, [allIds, l1]);
  const l2Options = useMemo(() => levelsAt(l2Ids, 1), [l2Ids]);
  const l3Ids = useMemo(() => l2 ? l2Ids.filter((id) => parseLevels(id)[1] === l2) : l2Ids, [l2Ids, l2]);
  const l3Options = useMemo(() => levelsAt(l3Ids, 2), [l3Ids]);
  const l4Ids = useMemo(() => l3 ? l3Ids.filter((id) => parseLevels(id)[2] === l3) : l3Ids, [l3Ids, l3]);
  const l4Options = useMemo(() => levelsAt(l4Ids, 3), [l4Ids]);

  const filteredUnmapped = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return unmapped.filter((u) => {
      const parts = parseLevels(u.func_loc_id);
      if (l1 && parts[0] !== l1) return false;
      if (l2 && parts[1] !== l2) return false;
      if (l3 && parts[2] !== l3) return false;
      if (l4 && parts[3] !== l4) return false;
      if (q && !u.func_loc_id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [unmapped, l1, l2, l3, l4, searchQuery]);

  const filteredMapped = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return mapped.filter((m) => !q || m.func_loc_id.toLowerCase().includes(q));
  }, [mapped, searchQuery]);

  const handleL1 = (v: string) => { setL1(v); setL2(''); setL3(''); setL4(''); };
  const handleL2 = (v: string) => { setL2(v); setL3(''); setL4(''); };
  const handleL3 = (v: string) => { setL3(v); setL4(''); };

  // Drag state
  const [dragging, setDragging] = useState<DragSource | null>(null);
  const [pointerDragging, setPointerDragging] = useState<string | null>(null);
  const [previewPos, setPreviewPos] = useState<{ cx: number; cy: number } | null>(null);

  const [notification, setNotification] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const notify = (kind: 'success' | 'error', message: string) => {
    setNotification({ kind, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const screenToSvgPct = useCallback(
    (clientX: number, clientY: number) => {
      const svgEl = svgRef.current;
      if (!svgEl) return null;
      const pt = svgEl.createSVGPoint();
      pt.x = clientX; pt.y = clientY;
      const ctm = svgEl.getScreenCTM();
      if (!ctm) return null;
      const svgPt = pt.matrixTransform(ctm.inverse());
      return {
        x_pos: Math.round(Math.max(0, Math.min(100, (svgPt.x / viewWidth)  * 100)) * 100) / 100,
        y_pos: Math.round(Math.max(0, Math.min(100, (svgPt.y / viewHeight) * 100)) * 100) / 100,
      };
    },
    [viewWidth, viewHeight],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<SVGSVGElement>) => {
      e.preventDefault();
      if (!dragging || !plantId || !activeFloor) return;
      const pos = screenToSvgPct(e.clientX, e.clientY);
      if (!pos) return;
      saveCoordinate(
        { plant_id: plantId, func_loc_id: dragging.funcLocId, floor_id: activeFloor, ...pos },
        {
          onSuccess: () => {
            notify('success', t('envmon.admin.notify.placed', { id: dragging.funcLocId, floor: activeFloor }));
            setDragging(null);
          },
          onError: (err) => { notify('error', err.message); setDragging(null); },
        },
      );
    },
    [dragging, plantId, activeFloor, saveCoordinate, screenToSvgPct, t],
  );

  const handleDragOver = (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  };

  const handleMarkerPointerDown = useCallback(
    (e: React.PointerEvent<SVGGElement>, funcLocId: string) => {
      e.preventDefault(); e.stopPropagation();
      setPointerDragging(funcLocId);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }, [],
  );

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!pointerDragging) return;
      const pos = screenToSvgPct(e.clientX, e.clientY);
      if (pos) setPreviewPos({ cx: (pos.x_pos / 100) * viewWidth, cy: (pos.y_pos / 100) * viewHeight });
    },
    [pointerDragging, screenToSvgPct, viewWidth, viewHeight],
  );

  const handleSvgPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!pointerDragging || !plantId || !activeFloor) return;
      const pos = screenToSvgPct(e.clientX, e.clientY);
      if (pos) {
        saveCoordinate(
          { plant_id: plantId, func_loc_id: pointerDragging, floor_id: activeFloor, ...pos },
          {
            onSuccess: () => notify('success', t('envmon.admin.notify.repositioned', { id: pointerDragging })),
            onError:   (err) => notify('error', err.message),
          },
        );
      }
      setPointerDragging(null); setPreviewPos(null);
    },
    [pointerDragging, plantId, activeFloor, saveCoordinate, screenToSvgPct, t],
  );

  const handleUnmap = (funcLocId: string) => {
    if (!plantId) return;
    deleteCoordinate(
      { plantId, funcLocId },
      {
        onSuccess: () => notify('success', t('envmon.admin.notify.removed', { id: funcLocId })),
        onError:   (err) => notify('error', err.message),
      },
    );
  };

  const isAnyDragging = !!dragging || !!pointerDragging;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Admin tab bar */}
      <div className="subnav">
        <button
          className={`tab${adminTab === 'floor' ? ' active' : ''}`}
          onClick={() => setAdminTab('floor')}
        >
          {t('envmon.admin.tab.floorPlan')}
        </button>
        <button
          className={`tab${adminTab === 'geo' ? ' active' : ''}`}
          onClick={() => setAdminTab('geo')}
        >
          {t('envmon.admin.tab.mapPins')}
        </button>
      </div>

      {adminTab === 'geo' ? (
        <div className="scroll-y" style={{ flex: 1 }}>
          <PlantGeoPanel />
        </div>
      ) : (
    <div className="em-mapper-container">
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="em-mapper-sidebar">
        {/* Plant selector */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--stroke-soft)' }}>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4 }}>{t('envmon.admin.plant.label')}</div>
          <select
            value={plantId ?? ''}
            onChange={(e) => { setSelectedPlantId(e.target.value); setActiveFloor(null); }}
            style={{ fontSize: 12, padding: '4px 8px' }}
          >
            {plantsLoading && <option value="">{t('envmon.admin.loading')}</option>}
            {plants.map((p) => (
              <option key={p.plant_id} value={p.plant_id}>{p.plant_id} · {p.plant_name}</option>
            ))}
          </select>
        </div>

        {/* Floor management */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--stroke-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-muted)' }}>{t('envmon.admin.floor.floors')}</span>
            <button className="btn btn-icon btn-ghost btn-sm" type="button"
              onClick={() => setShowAddFloor((v) => !v)} title={t('envmon.admin.floor.addFloor')}>
              <IconPlus size={12} />
            </button>
          </div>
          {showAddFloor && plantId && (
            <AddFloorForm plantId={plantId} onDone={() => setShowAddFloor(false)} />
          )}
          {floorsLoading && <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('envmon.admin.loading')}</span>}
          {!floorsLoading && floors.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('envmon.admin.floor.noFloors')}</p>
          )}
          {floors.map((f) => (
            <div key={f.floor_id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <button
                onClick={() => setActiveFloor(f.floor_id)}
                style={{
                  flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 12, borderRadius: 4,
                  background: activeFloor === f.floor_id ? 'color-mix(in srgb, var(--forest) 5%, white)' : 'transparent',
                  fontWeight: activeFloor === f.floor_id ? 600 : 400,
                  color: 'var(--forest)',
                }}
              >
                {f.floor_name} <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>({f.location_count})</span>
              </button>
              <button className="btn btn-icon btn-ghost btn-sm" type="button"
                style={{ color: 'var(--sunset)', flexShrink: 0 }}
                title={t('envmon.admin.floor.delete')}
                onClick={() => plantId && deleteFloor({ plantId, floorId: f.floor_id })}>
                <IconTrash size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Location lists */}
        {plantId && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Tab bar */}
            <div className="subnav" style={{ padding: '6px 12px', background: 'var(--stone)', flexShrink: 0 }}>
              <button
                className={`tab${locationTab === 'unmapped' ? ' active' : ''}`}
                onClick={() => setLocationTab('unmapped')}
              >
                {t('envmon.admin.loc.tab.unmapped', { n: filteredUnmapped.length })}
              </button>
              <button
                className={`tab${locationTab === 'mapped' ? ' active' : ''}`}
                onClick={() => setLocationTab('mapped')}
              >
                {t('envmon.admin.loc.tab.mapped', { n: filteredMapped.length })}
              </button>
            </div>

            {/* Unmapped panel */}
            {locationTab === 'unmapped' && (
              <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
                <div className="em-hierarchy-filters">
                  {[
                    { id: 'filter-l1', n: 1, value: l1, options: l1Options, onChange: handleL1, disabled: false },
                    { id: 'filter-l2', n: 2, value: l2, options: l2Options, onChange: handleL2, disabled: !l1 },
                    { id: 'filter-l3', n: 3, value: l3, options: l3Options, onChange: handleL3, disabled: !l2 },
                    { id: 'filter-l4', n: 4, value: l4, options: l4Options, onChange: setL4, disabled: !l3 },
                  ].map(({ id, n, value, options, onChange, disabled }) => (
                    <div key={id}>
                      <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 2 }}>{t('envmon.admin.filter.level', { n })}</div>
                      <select id={id} value={value} disabled={disabled}
                        onChange={(e) => onChange(e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px' }}>
                        <option value="">{t('envmon.admin.filter.all')}</option>
                        {options.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="em-mapper-search">
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)', pointerEvents: 'none', display: 'flex' }}>
                      <IconSearch size={13} />
                    </span>
                    <input
                      type="text"
                      placeholder={t('envmon.admin.loc.search')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: 28, paddingRight: searchQuery ? 28 : undefined, fontSize: 12, padding: '5px 28px' }}
                    />
                    {searchQuery && (
                      <button type="button" onClick={() => setSearchQuery('')}
                        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)', padding: 2, display: 'flex' }}>
                        <IconX size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="em-hierarchy-count">
                  {t(
                    filteredUnmapped.length === 1
                      ? 'envmon.admin.loc.unmapped.one'
                      : 'envmon.admin.loc.unmapped.other',
                    { n: filteredUnmapped.length },
                  )}
                </div>
                {loadingUnmapped && <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('envmon.admin.loading')}</span>}
                {!loadingUnmapped && filteredUnmapped.length === 0 && (
                  <p style={{ color: 'var(--fg-muted)', fontSize: '0.75rem' }}>
                    {unmapped.length === 0
                      ? t('envmon.admin.loc.allMapped')
                      : t('envmon.admin.loc.noMatch')}
                  </p>
                )}
                {filteredUnmapped.map((loc) => (
                  <div key={loc.func_loc_id} className="em-draggable-id" draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', loc.func_loc_id); setDragging({ funcLocId: loc.func_loc_id }); }}
                    onDragEnd={() => setDragging(null)}
                    title={t('envmon.admin.loc.dragToMap')}>
                    <IconMove size={12} style={{ marginRight: 4, verticalAlign: 'middle', flexShrink: 0 }} />
                    {loc.func_loc_id}
                  </div>
                ))}
              </div>
            )}

            {/* Mapped panel */}
            {locationTab === 'mapped' && (
              <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
                {loadingMapped && <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('envmon.admin.loading')}</span>}
                {!loadingMapped && filteredMapped.length === 0 && (
                  <p style={{ color: 'var(--fg-muted)', fontSize: '0.75rem', marginTop: 8 }}>
                    {mapped.length === 0
                      ? t('envmon.admin.loc.noneMapped')
                      : t('envmon.admin.loc.noMappedMatch')}
                  </p>
                )}
                {filteredMapped.map((loc) => (
                  <div key={loc.func_loc_id} className="em-mapped-row">
                    <div className="em-draggable-id em-mapped-draggable" draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', loc.func_loc_id); setDragging({ funcLocId: loc.func_loc_id }); }}
                      onDragEnd={() => setDragging(null)}
                      title={t('envmon.admin.loc.dragToReposition', { floor: loc.floor_id })}
                      style={{ flex: 1, marginBottom: 0 }}>
                      <IconMove size={12} style={{ marginRight: 4, verticalAlign: 'middle', flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{loc.func_loc_id}</span>
                      <span className="em-floor-badge">{loc.floor_id}</span>
                    </div>
                    <button className="btn btn-icon btn-ghost btn-sm" type="button"
                      style={{ color: 'var(--sunset)', flexShrink: 0 }}
                      title={t('envmon.admin.loc.removeMapping')}
                      onClick={() => handleUnmap(loc.func_loc_id)}
                      disabled={isDeleting}>
                      <IconTrash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Canvas                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="em-mapper-canvas">
        <div className="em-mapper-floor-bar">
          <select
            value={activeFloor ?? ''}
            onChange={(e) => setActiveFloor(e.target.value)}
            style={{ width: 160, fontSize: 12, padding: '4px 8px' }}
          >
            {floors.length === 0 && <option value="">{t('envmon.admin.canvas.noFloors')}</option>}
            {floors.map((f) => <option key={f.floor_id} value={f.floor_id}>{f.floor_name}</option>)}
          </select>
          <span className="em-mapper-floor-count">
            {t(
              floorMapped.length === 1
                ? 'envmon.admin.loc.floorCount.one'
                : 'envmon.admin.loc.floorCount.other',
              { n: floorMapped.length },
            )}
          </span>
        </div>

        {currentFloor?.svg_url && (
          <img key={currentFloor.svg_url} src={currentFloor.svg_url}
            alt={t('envmon.admin.canvas.floorPlanAlt', { floor: currentFloor.floor_name })}
            style={{ position: 'absolute', top: 48, left: 0, right: 0, bottom: 0,
              width: '100%', height: 'calc(100% - 48px)', objectFit: 'contain',
              objectPosition: 'center', display: 'block', pointerEvents: 'none' }} />
        )}

        <svg ref={svgRef} viewBox={`0 0 ${viewWidth} ${viewHeight}`} preserveAspectRatio="xMidYMid meet"
          style={{ position: 'absolute', top: 48, left: 0, right: 0, bottom: 0,
            width: '100%', height: 'calc(100% - 48px)',
            cursor: isAnyDragging ? 'crosshair' : 'default', overflow: 'visible' }}
          onDrop={handleDrop} onDragOver={handleDragOver}
          onPointerMove={handleSvgPointerMove} onPointerUp={handleSvgPointerUp}>

          {floorMapped.map((loc) => {
            const cx = ((loc.x_pos ?? 0) / 100) * viewWidth;
            const cy = ((loc.y_pos ?? 0) / 100) * viewHeight;
            const isMoving = pointerDragging === loc.func_loc_id;
            const status = statusMap.get(loc.func_loc_id) ?? 'NO_DATA';
            const markerClass = STATUS_CLASS[status] ?? STATUS_CLASS.NO_DATA;
            const labelFill = STATUS_FILL[markerClass] ?? STATUS_FILL['em-marker--no-data'];
            return (
              <g key={loc.func_loc_id}
                style={{ cursor: isMoving ? 'grabbing' : 'grab', opacity: isMoving ? 0.4 : 1, touchAction: 'none' }}
                onPointerDown={(e) => handleMarkerPointerDown(e, loc.func_loc_id)}>
                <circle cx={cx} cy={cy} r={MARKER_R + 6} fill="transparent" />
                <circle cx={cx} cy={cy} r={MARKER_R + 4} className={markerClass} opacity={0.18} />
                <circle cx={cx} cy={cy} r={MARKER_R} className={markerClass} stroke="white" strokeWidth={1.5} />
                <text x={cx} y={cy - MARKER_R - 4} textAnchor="middle" fontSize={10}
                  fill={labelFill} fontWeight="600"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {loc.func_loc_id}
                </text>
              </g>
            );
          })}

          {pointerDragging && previewPos && (
            <circle cx={previewPos.cx} cy={previewPos.cy} r={MARKER_R}
              fill="none" stroke="var(--valentia-slate)" strokeWidth={2}
              strokeDasharray="4 3" pointerEvents="none" />
          )}

          {dragging && (
            <rect x={0} y={0} width={viewWidth} height={viewHeight}
              fill="var(--valentia-slate)" opacity={0.05}
              stroke="var(--valentia-slate)" strokeWidth={8} strokeDasharray="24 12"
              pointerEvents="none" />
          )}
        </svg>

        {(isSaving || isDeleting) && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{t('envmon.admin.floor.adding')}</span>
          </div>
        )}

        {notification && (
          <div style={{ position: 'absolute', top: 56, left: 16, right: 16, zIndex: 20,
            padding: '8px 12px', borderRadius: 4, fontSize: 12,
            background: notification.kind === 'success'
              ? 'color-mix(in srgb, var(--jade) 18%, white)'
              : 'color-mix(in srgb, var(--sunset) 18%, white)',
            border: `1px solid ${notification.kind === 'success' ? 'var(--jade)' : 'var(--sunset)'}`,
            color: 'var(--forest)',
          }}>
            <strong>
              {notification.kind === 'success' ? t('envmon.admin.notify.saved') : t('envmon.admin.notify.error')}:
            </strong>{' '}
            {notification.message}
          </div>
        )}

        {isAnyDragging && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%',
            transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 20,
            padding: '5px 14px', borderRadius: 999, fontSize: 12, fontFamily: 'var(--font-mono)',
            background: 'var(--valentia-slate)', color: 'white', whiteSpace: 'nowrap',
          }}>
            {dragging
              ? t('envmon.admin.drag.place', { id: dragging.funcLocId, floor: currentFloor?.floor_name || activeFloor || '' })
              : t('envmon.admin.drag.reposition', { id: pointerDragging || '' })}
          </div>
        )}
      </div>
    </div>
      )}
    </div>
  );
}
