/* eslint-disable jsdoc/require-jsdoc */
/**
 * ZoneLayer — SVG group that renders all L4 zones for the active draft.
 *
 * Sits inside the `0 0 100 100` percentage viewBox shared by both canvas
 * variants. Rectangles map directly to `<rect>` elements; polygons map to
 * `<polygon>`. The selected zone gets a thicker, brighter stroke.
 *
 * A semi-transparent dashed preview rect is shown while a new zone is being
 * drawn via the pointer-drag gesture in `useCanvasInteraction`.
 */

import type { LayoutZone, RectangleGeometry, PolygonGeometry } from '~/types';

/** Props for {@link ZoneLayer}. */
export interface ZoneLayerProps {
  /** All zones from the current draft revision. */
  zones: LayoutZone[];
  /** Currently selected zone UUID, or null. */
  selectedZoneId: string | null;
  /** Called when the user clicks a zone. Deselects when already selected. */
  onSelectZone: (id: string | null) => void;
  /** In-progress draw gesture preview; null when not dragging. */
  dragRect: RectangleGeometry | null;
}

/** Compute centroid percentage coordinates for a zone label. */
function centroidOf(zone: LayoutZone): { cx: number; cy: number } {
  const geo = zone.geometry_json;
  if (geo.type === 'rectangle') {
    return {
      cx: geo.x_pct + geo.width_pct / 2,
      cy: geo.y_pct + geo.height_pct / 2,
    };
  }
  const pts = (geo as PolygonGeometry).points;
  return {
    cx: pts.reduce((s, p) => s + p.x_pct, 0) / pts.length,
    cy: pts.reduce((s, p) => s + p.y_pct, 0) / pts.length,
  };
}

/** SVG group rendering all draft zones plus an optional drag-preview rectangle. */
export default function ZoneLayer({ zones, selectedZoneId, onSelectZone, dragRect }: ZoneLayerProps) {
  return (
    <g data-testid="zone-layer">
      {zones.map((zone) => {
        const isSelected = zone.zone_id === selectedZoneId;
        const { cx, cy } = centroidOf(zone);
        const geo = zone.geometry_json;

        const sharedShapeProps = {
          'data-zone-id': zone.zone_id,
          fill: isSelected ? 'rgba(64, 130, 255, 0.25)' : 'rgba(64, 130, 255, 0.12)',
          stroke: isSelected ? '#4082ff' : '#7aa9ff',
          strokeWidth: isSelected ? 0.8 : 0.4,
          style: { cursor: 'pointer' } as React.CSSProperties,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onSelectZone(isSelected ? null : zone.zone_id);
          },
        };

        return (
          <g key={zone.zone_id}>
            {geo.type === 'rectangle' ? (
              <rect
                {...sharedShapeProps}
                x={(geo as RectangleGeometry).x_pct}
                y={(geo as RectangleGeometry).y_pct}
                width={(geo as RectangleGeometry).width_pct}
                height={(geo as RectangleGeometry).height_pct}
              />
            ) : (
              <polygon
                {...sharedShapeProps}
                points={(geo as PolygonGeometry).points.map(p => `${p.x_pct},${p.y_pct}`).join(' ')}
              />
            )}
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={2.5}
              fill={isSelected ? '#4082ff' : '#7aa9ff'}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {zone.zone_name}
            </text>
          </g>
        );
      })}

      {/* In-progress drag-draw preview */}
      {dragRect && (
        <rect
          x={dragRect.x_pct}
          y={dragRect.y_pct}
          width={dragRect.width_pct}
          height={dragRect.height_pct}
          fill="rgba(64, 130, 255, 0.15)"
          stroke="#4082ff"
          strokeWidth={0.5}
          strokeDasharray="2 1"
          style={{ pointerEvents: 'none' }}
          data-testid="drag-preview"
        />
      )}
    </g>
  );
}
