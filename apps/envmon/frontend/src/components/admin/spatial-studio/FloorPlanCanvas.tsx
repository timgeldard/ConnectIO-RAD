/* eslint-disable jsdoc/require-jsdoc */
/**
 * FloorPlanCanvas — renders a floor plan background image with an SVG overlay
 * for zone and point authoring.
 *
 * Coordinate convention matches the existing {@link FloorPlan} viewer:
 *   - SVG viewBox is `0 0 viewWidth viewHeight` (px, defaulting to 1000×700)
 *   - Zone/point percentage coordinates are scaled: x_px = (x_pct / 100) * viewWidth
 *   - Background image is absolutely positioned with objectFit: contain
 *
 * ZoneLayer (Slice 9) and PointLayer (Slice 10) slot into the overlay SVG.
 */

import type { StudioCanvasProps } from './StudioCanvas';

const DEFAULT_WIDTH = 1000;
const DEFAULT_HEIGHT = 700;

/** Floor plan canvas with SVG background image and overlay SVG for zones/points. */
export default function FloorPlanCanvas({
  floor,
  draft,
  onCreateDraft,
  isCreatingDraft,
}: StudioCanvasProps) {
  const viewWidth = floor.svg_width ?? DEFAULT_WIDTH;
  const viewHeight = floor.svg_height ?? DEFAULT_HEIGHT;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      {/* Background floor plan image */}
      {floor.svg_url && (
        <img
          key={floor.svg_url}
          src={floor.svg_url}
          alt={`${floor.floor_name} floor plan`}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
          }}
        />
      )}

      {/* Zone + point overlay — same viewBox as background for 1:1 coordinate alignment */}
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        aria-label={`${floor.floor_name} layout canvas`}
        data-testid="floor-plan-svg"
      >
        {/* ZoneLayer inserted here in Slice 9 */}
        {/* PointLayer inserted here in Slice 10 */}
      </svg>

      {/* No-draft overlay — prompt to open a draft before authoring */}
      {!draft && (
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            background: 'rgba(0,0,0,0.45)',
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
