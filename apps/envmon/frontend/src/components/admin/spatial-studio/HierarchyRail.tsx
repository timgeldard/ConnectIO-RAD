/* eslint-disable jsdoc/require-jsdoc */
/**
 * HierarchyRail — left-side tree panel for Spatial Studio.
 *
 * Renders a three-level collapsible hierarchy:
 *   Floor → L4 zones → L5 functional locations (swab points)
 *
 * Clicking a zone or point sets the studio selection. The panel fetches
 * the draft layout from TanStack Query; if no draft exists it shows a
 * prompt to open one.
 */

import type { DraftLayout, LayoutZone, LocationMeta } from '~/types';

/** Props for {@link HierarchyRail}. */
export interface HierarchyRailProps {
  /** The draft layout for the current floor (null when no draft is open). */
  draft: DraftLayout | null;
  /** Whether the draft layout is still loading. */
  isLoading: boolean;
  /** Currently selected zone UUID, or null. */
  selectedZoneId: string | null;
  /** Currently selected point functional-location ID, or null. */
  selectedPointId: string | null;
  /** Called when the user selects a zone row. */
  onSelectZone: (zoneId: string | null) => void;
  /** Called when the user selects a point row. */
  onSelectPoint: (funcLocId: string | null) => void;
}

/** Returns the swab points that belong to a given zone. */
function pointsForZone(coords: LocationMeta[], zoneId: string): LocationMeta[] {
  return coords.filter((c) => (c as LocationMeta & { parent_zone_id?: string }).parent_zone_id === zoneId);
}

/** Returns the swab points that have no zone assignment. */
function unassignedPoints(coords: LocationMeta[]): LocationMeta[] {
  return coords.filter((c) => !(c as LocationMeta & { parent_zone_id?: string }).parent_zone_id);
}

/** Left rail showing the floor→zone→point hierarchy for the current draft. */
export default function HierarchyRail({
  draft,
  isLoading,
  selectedZoneId,
  selectedPointId,
  onSelectZone,
  onSelectPoint,
}: HierarchyRailProps) {
  if (isLoading) {
    return (
      <div style={railStyle}>
        <div style={eyebrowStyle}>Structure</div>
        <div style={emptyStyle}>Loading…</div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div style={railStyle}>
        <div style={eyebrowStyle}>Structure</div>
        <div style={emptyStyle}>No draft open. Use "Open draft" above.</div>
      </div>
    );
  }

  const { zones, coordinates } = draft;

  return (
    <div style={railStyle}>
      <div style={eyebrowStyle}>Structure</div>

      {zones.length === 0 && (
        <div style={emptyStyle}>No zones yet. Switch to Structure mode and draw your first zone.</div>
      )}

      {zones.map((zone: LayoutZone) => {
        const children = pointsForZone(coordinates, zone.zone_id);
        const isZoneSelected = selectedZoneId === zone.zone_id;
        return (
          <div key={zone.zone_id}>
            <button
              onClick={() => onSelectZone(isZoneSelected ? null : zone.zone_id)}
              style={rowStyle(isZoneSelected, 0)}
              aria-pressed={isZoneSelected}
            >
              <span style={iconStyle}>▧</span>
              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {zone.zone_name}
              </span>
              {children.length > 0 && (
                <span style={countStyle}>{children.length}</span>
              )}
            </button>
            {children.map((pt: LocationMeta) => {
              const isPtSelected = selectedPointId === pt.func_loc_id;
              return (
                <button
                  key={pt.func_loc_id}
                  onClick={() => onSelectPoint(isPtSelected ? null : pt.func_loc_id)}
                  style={rowStyle(isPtSelected, 1)}
                  aria-pressed={isPtSelected}
                >
                  <span style={iconStyle}>●</span>
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pt.func_loc_name ?? pt.func_loc_id}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}

      {/* Unassigned points */}
      {unassignedPoints(coordinates).length > 0 && (
        <div>
          <div style={{ ...rowStyle(false, 0), cursor: 'default', color: 'var(--text-3)' }}>
            <span style={iconStyle}>—</span>
            <span>Unassigned ({unassignedPoints(coordinates).length})</span>
          </div>
          {unassignedPoints(coordinates).map((pt: LocationMeta) => {
            const isPtSelected = selectedPointId === pt.func_loc_id;
            return (
              <button
                key={pt.func_loc_id}
                onClick={() => onSelectPoint(isPtSelected ? null : pt.func_loc_id)}
                style={rowStyle(isPtSelected, 1)}
                aria-pressed={isPtSelected}
              >
                <span style={iconStyle}>●</span>
                <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pt.func_loc_name ?? pt.func_loc_id}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

const railStyle: React.CSSProperties = {
  width: 220,
  flexShrink: 0,
  overflowY: 'auto',
  borderRight: '1px solid var(--border)',
  background: 'var(--surface-sunken)',
  display: 'flex',
  flexDirection: 'column',
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-3)',
  padding: '10px 12px 6px',
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-3)',
  padding: '8px 12px',
  lineHeight: 1.5,
};

function rowStyle(selected: boolean, depth: number): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    padding: `5px 12px 5px ${12 + depth * 14}px`,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    background: selected ? 'var(--accent-subtle)' : 'transparent',
    color: selected ? 'var(--accent)' : 'var(--text-1)',
    fontWeight: selected ? 600 : 400,
  };
}

const iconStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-3)',
  flexShrink: 0,
};

const countStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-3)',
  background: 'var(--surface)',
  borderRadius: 8,
  padding: '1px 5px',
  flexShrink: 0,
};
