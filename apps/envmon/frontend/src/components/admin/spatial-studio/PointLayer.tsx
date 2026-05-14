/**
 * PointLayer — SVG layer that renders L5 coordinate points on the Studio canvas.
 *
 * Renders only mapped coordinates (those with non-null x_pos and y_pos). Click
 * toggles selection. Selected points render larger and filled; unselected render
 * as small outlined circles.
 *
 * When a coordinate has a parent_zone_id and its position falls outside the parent
 * zone's geometry, the circle is stroked red to signal a validation issue. This is
 * a client-side visual hint; the authoritative check runs server-side via validate.
 *
 * Known limitation (Slice 10): parent_zone_id is populated only after the Slice 1
 * migration deploys and publish stamps coordinates. Until then all points render
 * with neutral styling (no red outline).
 *
 * Click-to-place (moving a selected point) is handled by {@link useCanvasInteraction}
 * in Place mode, not here.
 */

import type { LocationMeta, LayoutZone, RectangleGeometry, PolygonGeometry } from '~/types';

/** Props for {@link PointLayer}. */
export interface PointLayerProps {
  /** L5 coordinate records from the current draft layout. */
  coordinates: LocationMeta[];
  /** L4 zones from the draft layout, used to evaluate parent-zone containment. */
  zones: LayoutZone[];
  /** Selected L5 func_loc_id, or null when nothing is selected. */
  selectedPointId: string | null;
  /** Called with func_loc_id to select, or null to deselect. */
  onSelectPoint: (id: string | null) => void;
}

/** Normal point radius in percentage units. */
const R_NORMAL = 1.2;
/** Selected point radius in percentage units. */
const R_SELECTED = 1.8;

/** Return true if (x, y) is inside the given zone geometry (rectangle exact, polygon bbox). */
function isInsideZone(x: number, y: number, zone: LayoutZone): boolean {
  const geo = zone.geometry_json;
  if (geo.type === 'rectangle') {
    const r = geo as RectangleGeometry;
    return x >= r.x_pct && x <= r.x_pct + r.width_pct && y >= r.y_pct && y <= r.y_pct + r.height_pct;
  }
  // Polygon: use bounding-box check as a lightweight approximation
  const pts = (geo as PolygonGeometry).points;
  if (!pts.length) return true;
  const minX = Math.min(...pts.map(p => p.x_pct));
  const maxX = Math.max(...pts.map(p => p.x_pct));
  const minY = Math.min(...pts.map(p => p.y_pct));
  const maxY = Math.max(...pts.map(p => p.y_pct));
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

/** Point layer: renders each mapped L5 coordinate as an SVG circle. */
export default function PointLayer({
  coordinates,
  zones,
  selectedPointId,
  onSelectPoint,
}: PointLayerProps) {
  return (
    <g data-testid="point-layer">
      {coordinates.map((coord) => {
        if (coord.x_pos == null || coord.y_pos == null) return null;

        const isSelected = coord.func_loc_id === selectedPointId;
        const r = isSelected ? R_SELECTED : R_NORMAL;

        let outsideParent = false;
        if (coord.parent_zone_id) {
          const parentZone = zones.find(z => z.zone_id === coord.parent_zone_id);
          if (parentZone) {
            outsideParent = !isInsideZone(coord.x_pos, coord.y_pos, parentZone);
          }
        }

        const stroke = outsideParent ? 'var(--status-risk)' : 'var(--accent)';
        const fill = isSelected ? 'var(--accent)' : 'var(--accent-subtle)';

        return (
          <circle
            key={coord.func_loc_id}
            data-point-id={coord.func_loc_id}
            cx={coord.x_pos}
            cy={coord.y_pos}
            r={r}
            fill={fill}
            stroke={stroke}
            strokeWidth={isSelected ? 0.6 : 0.4}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPoint(isSelected ? null : coord.func_loc_id);
            }}
          />
        );
      })}
    </g>
  );
}
