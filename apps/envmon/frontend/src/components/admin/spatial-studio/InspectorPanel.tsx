/**
 * InspectorPanel — right-hand side panel for the Spatial Studio.
 *
 * Shows zone properties when a zone is selected (editable name, geometry type,
 * bounding-box summary, delete button). Shows validation issues when in review
 * mode. Shows a placeholder otherwise.
 */

import { useState, useEffect } from 'react';
import { useUpsertZone, useDeleteZone } from '~/api/client';
import type { LayoutZone, RectangleGeometry, PolygonGeometry, ValidationResult } from '~/types';
import ValidationPanel from './ValidationPanel';

/** Props for {@link InspectorPanel}. */
export interface InspectorPanelProps {
  /** Currently selected zone, or null when nothing is selected. */
  zone: LayoutZone | null;
  /** SAP plant code for mutation calls. */
  plantId: string;
  /** Floor identifier for mutation calls. */
  floorId: string;
  /** Draft revision UUID; mutations are disabled when null. */
  revisionId: string | null;
  /** Called after a zone is deleted so the parent can clear the selection. */
  onDeselectZone: () => void;
  /** Validation result to render; takes over the panel when no zone is selected. */
  validationResult: ValidationResult | null;
}

/** Inspector panel: zone properties, validation results, or empty-state hint. */
export default function InspectorPanel({
  zone,
  plantId,
  floorId,
  revisionId,
  onDeselectZone,
  validationResult,
}: InspectorPanelProps) {
  const upsertZone = useUpsertZone();
  const deleteZone = useDeleteZone();
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    setNameInput(zone?.zone_name ?? '');
  }, [zone?.zone_id, zone?.zone_name]);

  function handleNameCommit() {
    if (!zone || !revisionId) return;
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === zone.zone_name) return;
    const geo = zone.geometry_json;
    const geomJson =
      geo.type === 'rectangle'
        ? {
            x_pct: (geo as RectangleGeometry).x_pct,
            y_pct: (geo as RectangleGeometry).y_pct,
            width_pct: (geo as RectangleGeometry).width_pct,
            height_pct: (geo as RectangleGeometry).height_pct,
          }
        : { points: (geo as PolygonGeometry).points };
    upsertZone.mutate({
      zone_id: zone.zone_id,
      floorId,
      plant_id: plantId,
      revision_id: revisionId,
      zone_name: trimmed,
      geometry_type: zone.geometry_type,
      geometry_json: geomJson,
    });
  }

  function handleDelete() {
    if (!zone || !revisionId) return;
    deleteZone.mutate(
      { plantId, floorId, zoneId: zone.zone_id, revisionId },
      { onSuccess: onDeselectZone },
    );
  }

  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        overflow: 'auto',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
      data-testid="studio-inspector"
    >
      {zone ? (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
            Zone
          </div>

          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 2 }}>
            Name
          </label>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleNameCommit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNameCommit(); }}
            style={{
              width: '100%',
              fontSize: 13,
              padding: '4px 6px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: 'var(--surface-sunken)',
              color: 'var(--text-1)',
              boxSizing: 'border-box',
              marginBottom: 12,
            }}
            data-testid="inspector-zone-name"
          />

          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', marginBottom: 2 }}>Type</div>
          <div style={{ fontSize: 12, color: 'var(--text-1)', marginBottom: 12 }}>{zone.geometry_type}</div>

          {zone.geometry_json.type === 'rectangle' && (
            <>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>Bounds</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace', lineHeight: 1.7, marginBottom: 12 }}>
                {`x ${(zone.geometry_json as RectangleGeometry).x_pct.toFixed(1)}%  y ${(zone.geometry_json as RectangleGeometry).y_pct.toFixed(1)}%`}
                <br />
                {`w ${(zone.geometry_json as RectangleGeometry).width_pct.toFixed(1)}%  h ${(zone.geometry_json as RectangleGeometry).height_pct.toFixed(1)}%`}
              </div>
            </>
          )}

          <button
            className="btn btn-sm btn-ghost"
            style={{ color: 'var(--sunset)', width: '100%', marginTop: 'auto' }}
            onClick={handleDelete}
            disabled={deleteZone.isPending}
            data-testid="inspector-delete-btn"
          >
            {deleteZone.isPending ? 'Deleting…' : 'Delete zone'}
          </button>
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {validationResult
            ? null
            : 'Select a zone to inspect, or draw a new zone on the canvas.'}
        </div>
      )}

      {/* Validation results — shown in review mode regardless of zone selection */}
      {validationResult && (
        <div style={{ marginTop: zone ? 16 : 0 }}>
          <ValidationPanel validationResult={validationResult} />
        </div>
      )}
    </div>
  );
}
