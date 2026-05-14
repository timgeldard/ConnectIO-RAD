/* eslint-disable jsdoc/require-jsdoc */
/**
 * GridCanvas — renders a procedurally generated grid as the canvas background
 * for floors that have no SVG floor plan.
 *
 * Grid uses the same `0 0 100 100` percentage viewBox so zone/point coordinates
 * map directly without scaling. Lines are drawn every {@link GRID_CELL_SIZE} units.
 *
 * ZoneLayer (Slice 9) and PointLayer (Slice 10) slot into the overlay group.
 */

import type { StudioCanvasProps } from './StudioCanvas';

/** Grid cell size in percentage units (each cell = 10% of canvas). */
const GRID_CELL_SIZE = 10;

/** Number of internal grid lines per axis. */
const LINE_COUNT = Math.floor(100 / GRID_CELL_SIZE) - 1;

/** Grid canvas with procedural lines and SVG overlay for zones/points. */
export default function GridCanvas({
  floor,
  draft,
  onCreateDraft,
  isCreatingDraft,
}: StudioCanvasProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        aria-label={`${floor.floor_name} grid canvas`}
        data-testid="grid-canvas-svg"
      >
        {/* Canvas border */}
        <rect x={0} y={0} width={100} height={100} fill="none" stroke="var(--border)" strokeWidth={0.3} />

        {/* Vertical grid lines */}
        {Array.from({ length: LINE_COUNT }, (_, i) => {
          const x = (i + 1) * GRID_CELL_SIZE;
          return (
            <line
              key={`gx${i}`}
              x1={x} y1={0} x2={x} y2={100}
              stroke="var(--border)"
              strokeWidth={0.2}
            />
          );
        })}

        {/* Horizontal grid lines */}
        {Array.from({ length: LINE_COUNT }, (_, i) => {
          const y = (i + 1) * GRID_CELL_SIZE;
          return (
            <line
              key={`gy${i}`}
              x1={0} y1={y} x2={100} y2={y}
              stroke="var(--border)"
              strokeWidth={0.2}
            />
          );
        })}

        {/* ZoneLayer inserted here in Slice 9 */}
        {/* PointLayer inserted here in Slice 10 */}
      </svg>

      {/* No-draft overlay */}
      {!draft && (
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            background: 'rgba(0,0,0,0.35)',
            borderRadius: 8,
            padding: '20px 28px',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 13, marginBottom: 12 }}>No draft open for this floor.</div>
          <button
            className="btn btn-sm btn-primary"
            onClick={onCreateDraft}
            disabled={isCreatingDraft}
          >
            {isCreatingDraft ? 'Opening…' : 'Open draft'}
          </button>
        </div>
      )}
    </div>
  );
}
