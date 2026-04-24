/**
 * CoordinateMapper — multi-plant admin spatial authoring tool.
 *
 * Top bar:   plant selector (all plants with inspection lots)
 * Left bar:  floor management + unmapped/mapped location lists
 * Canvas:    drag-and-drop + pointer-repositioning of markers on the floor plan
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Tag, InlineNotification, Loading, Button,
  Tabs, Tab, TabList, TabPanels, TabPanel,
  Select, SelectItem, Search,
} from '@carbon/react';
import { TrashCan, Move, Add } from '@carbon/icons-react';
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
  'em-marker--pass':    'var(--cds-support-success)',
  'em-marker--fail':    'var(--cds-support-error)',
  'em-marker--warning': 'var(--cds-support-warning)',
  'em-marker--pending': 'var(--cds-support-info)',
  'em-marker--no-data': 'var(--cds-text-placeholder)',
};

type DragSource = { funcLocId: string };

function parseLevels(id: string): string[] { return id.split('-'); }
function levelsAt(ids: string[], idx: number): string[] {
  return Array.from(new Set(ids.map((id) => parseLevels(id)[idx]).filter(Boolean))).sort();
}

// ---------------------------------------------------------------------------
// Add-floor inline form
// ---------------------------------------------------------------------------
function AddFloorForm({ plantId, onDone }: { plantId: string; onDone: () => void }) {
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
    <form onSubmit={handleSubmit} style={{ padding: '12px 0', borderBottom: '1px solid var(--cds-border-subtle-00)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--cds-text-primary)' }}>Add floor</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input placeholder="Floor ID (e.g. F1)" value={floorId} onChange={(e) => setFloorId(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--cds-border-strong-01)', borderRadius: 4 }} />
        <input placeholder="Floor name (e.g. Ground Floor)" value={floorName} onChange={(e) => setFloorName(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--cds-border-strong-01)', borderRadius: 4 }} />
        <input placeholder="SVG URL (optional)" value={svgUrl} onChange={(e) => setSvgUrl(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--cds-border-strong-01)', borderRadius: 4 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <Button kind="primary" size="sm" type="submit" disabled={isPending || !floorId.trim() || !floorName.trim()}>
            {isPending ? 'Saving…' : 'Add'}
          </Button>
          <Button kind="ghost" size="sm" type="button" onClick={onDone}>Cancel</Button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Plant geo editor
// ---------------------------------------------------------------------------
function PlantGeoPanel() {
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

  return (
    <div style={{ padding: '20px 24px', maxWidth: 720 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>Map pin coordinates</div>
      <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 0, marginBottom: 16 }}>
        Set WGS-84 latitude / longitude for each plant. These are used as map pin positions on the global view.
      </p>
      <table className="tbl">
        <thead>
          <tr>
            <th>Plant</th>
            <th>Latitude</th>
            <th>Longitude</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {plants.map((p) => (
            <tr key={p.plant_id}>
              <td>
                <span style={{ fontWeight: 600 }}>{p.plant_code}</span>
                <span style={{ color: 'var(--fg-muted)', marginLeft: 6, fontSize: 12 }}>{p.plant_name}</span>
              </td>
              <td>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 53.3498"
                  value={getField(p.plant_id, 'lat')}
                  onChange={(e) => setField(p.plant_id, 'lat', e.target.value)}
                  style={{ width: 130, padding: '5px 8px', fontSize: 13, border: '1px solid var(--stroke)', borderRadius: 4 }}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. -6.2603"
                  value={getField(p.plant_id, 'lon')}
                  onChange={(e) => setField(p.plant_id, 'lon', e.target.value)}
                  style={{ width: 130, padding: '5px 8px', fontSize: 13, border: '1px solid var(--stroke)', borderRadius: 4 }}
                />
              </td>
              <td>
                {savedFlags[p.plant_id] ? (
                  <span style={{ fontSize: 12, color: 'var(--jade)', fontFamily: 'var(--font-mono)' }}>Saved</span>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={isPending}
                    onClick={() => handleSave(p.plant_id)}
                  >
                    Save
                  </button>
                )}
              </td>
            </tr>
          ))}
          {plants.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: 'var(--fg-muted)', fontStyle: 'italic' }}>No active plants found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function CoordinateMapper() {
  const [adminTab, setAdminTab] = React.useState<'floor' | 'geo'>('floor');
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
          onSuccess: () => { notify('success', `${dragging.funcLocId} → ${activeFloor}`); setDragging(null); },
          onError: (err) => { notify('error', err.message); setDragging(null); },
        },
      );
    },
    [dragging, plantId, activeFloor, saveCoordinate, screenToSvgPct],
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
            onSuccess: () => notify('success', `${pointerDragging} repositioned`),
            onError:   (err) => notify('error', err.message),
          },
        );
      }
      setPointerDragging(null); setPreviewPos(null);
    },
    [pointerDragging, plantId, activeFloor, saveCoordinate, screenToSvgPct],
  );

  const handleUnmap = (funcLocId: string) => {
    if (!plantId) return;
    deleteCoordinate(
      { plantId, funcLocId },
      {
        onSuccess: () => notify('success', `${funcLocId} removed`),
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
          Floor plan
        </button>
        <button
          className={`tab${adminTab === 'geo' ? ' active' : ''}`}
          onClick={() => setAdminTab('geo')}
        >
          Map pins
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
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--cds-border-subtle-00)' }}>
          <Select
            id="mapper-plant-select"
            labelText="Plant"
            size="sm"
            value={plantId ?? ''}
            onChange={(e) => { setSelectedPlantId(e.target.value); setActiveFloor(null); }}
          >
            {plantsLoading && <SelectItem value="" text="Loading plants…" />}
            {plants.map((p) => (
              <SelectItem key={p.plant_id} value={p.plant_id} text={`${p.plant_id} · ${p.plant_name}`} />
            ))}
          </Select>
        </div>

        {/* Floor management */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--cds-border-subtle-00)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--cds-text-secondary)' }}>Floors</span>
            <Button kind="ghost" size="sm" hasIconOnly renderIcon={Add} iconDescription="Add floor"
              tooltipPosition="left" onClick={() => setShowAddFloor((v) => !v)} style={{ minHeight: 'auto', padding: '2px 6px' }} />
          </div>
          {showAddFloor && plantId && (
            <AddFloorForm plantId={plantId} onDone={() => setShowAddFloor(false)} />
          )}
          {floorsLoading && <Loading small withOverlay={false} description="Loading floors…" />}
          {!floorsLoading && floors.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--cds-text-secondary)' }}>No floors configured. Add one above.</p>
          )}
          {floors.map((f) => (
            <div key={f.floor_id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <button
                onClick={() => setActiveFloor(f.floor_id)}
                style={{
                  flex: 1, textAlign: 'left', padding: '4px 8px', fontSize: 12, borderRadius: 4,
                  background: activeFloor === f.floor_id ? 'var(--cds-background-selected)' : 'transparent',
                  fontWeight: activeFloor === f.floor_id ? 600 : 400,
                  color: 'var(--cds-text-primary)',
                }}
              >
                {f.floor_name} <span style={{ color: 'var(--cds-text-secondary)', fontFamily: 'var(--cds-code-01-font-family)' }}>({f.location_count})</span>
              </button>
              <Button kind="danger--ghost" size="sm" hasIconOnly renderIcon={TrashCan}
                iconDescription="Delete floor" tooltipPosition="left"
                onClick={() => plantId && deleteFloor({ plantId, floorId: f.floor_id })}
                style={{ minHeight: 'auto', padding: '2px 4px', flexShrink: 0 }} />
            </div>
          ))}
        </div>

        {/* Location lists */}
        {plantId && (
          <Tabs>
            <TabList aria-label="Coordinate mapping tabs">
              <Tab>Unmapped ({filteredUnmapped.length})</Tab>
              <Tab>Mapped ({filteredMapped.length})</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <div className="em-hierarchy-filters">
                  {[
                    { id: 'filter-l1', label: 'Level 1', value: l1, options: l1Options, onChange: handleL1, disabled: false },
                    { id: 'filter-l2', label: 'Level 2', value: l2, options: l2Options, onChange: handleL2, disabled: !l1 },
                    { id: 'filter-l3', label: 'Level 3', value: l3, options: l3Options, onChange: handleL3, disabled: !l2 },
                    { id: 'filter-l4', label: 'Level 4', value: l4, options: l4Options, onChange: setL4, disabled: !l3 },
                  ].map(({ id, label, value, options, onChange, disabled }) => (
                    <Select key={id} id={id} labelText={label} size="sm" value={value} disabled={disabled}
                      onChange={(e) => onChange(e.target.value)}>
                      <SelectItem value="" text="All" />
                      {options.map((v) => <SelectItem key={v} value={v} text={v} />)}
                    </Select>
                  ))}
                </div>
                <div className="em-mapper-search">
                  <Search id="mapper-search" labelText="Search locations" placeholder="Search by ID…"
                    size="sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery('')} />
                </div>
                <div className="em-hierarchy-count">{filteredUnmapped.length} location{filteredUnmapped.length !== 1 ? 's' : ''}</div>
                {loadingUnmapped && <Loading description="Loading…" withOverlay={false} small />}
                {!loadingUnmapped && filteredUnmapped.length === 0 && (
                  <p style={{ color: 'var(--cds-text-secondary)', fontSize: 'var(--cds-label-01-font-size)' }}>
                    {unmapped.length === 0 ? 'All locations are mapped.' : 'No locations match the selected filters.'}
                  </p>
                )}
                {filteredUnmapped.map((loc) => (
                  <div key={loc.func_loc_id} className="em-draggable-id" draggable
                    onDragStart={() => setDragging({ funcLocId: loc.func_loc_id })}
                    onDragEnd={() => setDragging(null)}
                    title="Drag onto floor plan to map">
                    <Move size={12} style={{ marginRight: 'var(--cds-spacing-02)', verticalAlign: 'middle', flexShrink: 0 }} />
                    {loc.func_loc_id}
                  </div>
                ))}
              </TabPanel>

              <TabPanel>
                {loadingMapped && <Loading description="Loading…" withOverlay={false} small />}
                {!loadingMapped && filteredMapped.length === 0 && (
                  <p style={{ color: 'var(--cds-text-secondary)', fontSize: 'var(--cds-label-01-font-size)', marginTop: 'var(--cds-spacing-04)' }}>
                    {mapped.length === 0 ? 'No locations mapped yet.' : 'No mapped locations match the search.'}
                  </p>
                )}
                {filteredMapped.map((loc) => (
                  <div key={loc.func_loc_id} className="em-mapped-row">
                    <div className="em-draggable-id em-mapped-draggable" draggable
                      onDragStart={() => setDragging({ funcLocId: loc.func_loc_id })}
                      onDragEnd={() => setDragging(null)}
                      title={`Floor ${loc.floor_id} — drag to reposition`}
                      style={{ flex: 1, marginBottom: 0 }}>
                      <Move size={12} style={{ marginRight: 'var(--cds-spacing-02)', verticalAlign: 'middle', flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{loc.func_loc_id}</span>
                      <span className="em-floor-badge">{loc.floor_id}</span>
                    </div>
                    <Button kind="danger--ghost" size="sm" hasIconOnly renderIcon={TrashCan}
                      iconDescription="Remove mapping" tooltipPosition="left"
                      onClick={() => handleUnmap(loc.func_loc_id)}
                      disabled={isDeleting} style={{ flexShrink: 0 }} />
                  </div>
                ))}
              </TabPanel>
            </TabPanels>
          </Tabs>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Canvas                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="em-mapper-canvas">
        <div className="em-mapper-floor-bar">
          <Select id="mapper-floor-select" labelText="Select floor" hideLabel size="sm"
            value={activeFloor ?? ''} onChange={(e) => setActiveFloor(e.target.value)}
            style={{ width: '160px' }}>
            {floors.length === 0 && <SelectItem value="" text="No floors configured" />}
            {floors.map((f) => <SelectItem key={f.floor_id} value={f.floor_id} text={f.floor_name} />)}
          </Select>
          <span className="em-mapper-floor-count">
            {floorMapped.length} location{floorMapped.length !== 1 ? 's' : ''} on this floor
          </span>
        </div>

        {currentFloor?.svg_url && (
          <img key={currentFloor.svg_url} src={currentFloor.svg_url}
            alt={`${currentFloor.floor_name} plan`}
            style={{ position: 'absolute', top: 'var(--cds-spacing-09)', left: 0, right: 0, bottom: 0,
              width: '100%', height: 'calc(100% - var(--cds-spacing-09))', objectFit: 'contain',
              objectPosition: 'center', display: 'block', pointerEvents: 'none' }} />
        )}

        <svg ref={svgRef} viewBox={`0 0 ${viewWidth} ${viewHeight}`} preserveAspectRatio="xMidYMid meet"
          style={{ position: 'absolute', top: 'var(--cds-spacing-09)', left: 0, right: 0, bottom: 0,
            width: '100%', height: 'calc(100% - var(--cds-spacing-09))',
            cursor: isAnyDragging ? 'crosshair' : 'default', overflow: 'visible' }}
          onDrop={handleDrop} onDragOver={handleDragOver}
          onPointerMove={handleSvgPointerMove} onPointerUp={handleSvgPointerUp}>

          {floorMapped.map((loc) => {
            const cx = ((loc.x_pos ?? 0) / 100) * viewWidth;
            const cy = ((loc.y_pos ?? 0) / 100) * viewHeight;
            const isMoving = pointerDragging === loc.func_loc_id;
            const status = statusMap.get(loc.func_loc_id) ?? 'NO_DATA';
            const markerClass = STATUS_CLASS[status] ?? STATUS_CLASS.NO_DATA;
            const labelFill = STATUS_FILL[markerClass] ?? 'var(--cds-text-placeholder)';
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
              fill="none" stroke="var(--cds-interactive-01)" strokeWidth={2}
              strokeDasharray="4 3" pointerEvents="none" />
          )}

          {dragging && (
            <rect x={0} y={0} width={viewWidth} height={viewHeight}
              fill="var(--cds-interactive-01)" opacity={0.05}
              stroke="var(--cds-interactive-01)" strokeWidth={8} strokeDasharray="24 12"
              pointerEvents="none" />
          )}
        </svg>

        {(isSaving || isDeleting) && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--cds-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loading description="Saving…" withOverlay={false} />
          </div>
        )}

        {notification && (
          <div style={{ position: 'absolute', top: 'calc(var(--cds-spacing-09) + var(--cds-spacing-04))',
            left: 'var(--cds-spacing-05)', right: 'var(--cds-spacing-05)', zIndex: 20 }}>
            <InlineNotification kind={notification.kind}
              title={notification.kind === 'success' ? 'Saved' : 'Error'}
              subtitle={notification.message} hideCloseButton />
          </div>
        )}

        {isAnyDragging && (
          <div style={{ position: 'absolute', bottom: 'var(--cds-spacing-05)', left: '50%',
            transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 20 }}>
            <Tag type="blue">
              {dragging
                ? `Drop to place ${dragging.funcLocId} on ${currentFloor?.floor_name || activeFloor}`
                : `Drag to reposition ${pointerDragging}`}
            </Tag>
          </div>
        )}
      </div>
    </div>
      )}
    </div>
  );
}
