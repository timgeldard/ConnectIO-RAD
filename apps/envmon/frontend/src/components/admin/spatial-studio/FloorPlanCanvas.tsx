/**
 * FloorPlanCanvas — renders a floor plan background image with an SVG overlay
 * for zone and point authoring.
 *
 * Coordinate convention: SVG overlay uses `viewBox="0 0 100 100"` (percentage
 * units), matching {@link GridCanvas}. Zone/point coordinates are percentage
 * values; no client-to-SVG scaling is needed. The background image sits outside
 * the SVG and uses `objectFit: contain`.
 *
 * ZoneLayer (Slice 9) and PointLayer (Slice 10) slot into the overlay SVG.
 */

import type { StudioCanvasProps } from './StudioCanvas';
import ZoneLayer from './ZoneLayer';
import PointLayer from './PointLayer';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';

/** Floor plan canvas with background image and percentage-coordinate SVG overlay. */
export default function FloorPlanCanvas({
  floor,
  draft,
  activeMode,
  selectedZoneId,
  selectedPointId,
  onSelectZone,
  onSelectPoint,
  onCreateDraft,
  isCreatingDraft,
}: StudioCanvasProps) {
  const { dragRect, onPointerDown, onPointerMove, onPointerUp } = useCanvasInteraction({
    activeMode,
    draft,
    onSelectZone,
    selectedPointId,
  });

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

      {/* Zone + point overlay — percentage viewBox matches GridCanvas */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          cursor: (activeMode === 'structure' || (activeMode === 'place' && selectedPointId)) && draft ? 'crosshair' : 'default',
        }}
        aria-label={`${floor.floor_name} layout canvas`}
        data-testid="floor-plan-svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <ZoneLayer
          zones={draft?.zones ?? []}
          selectedZoneId={selectedZoneId}
          onSelectZone={onSelectZone}
          dragRect={dragRect}
        />
        <PointLayer
          coordinates={draft?.coordinates ?? []}
          zones={draft?.zones ?? []}
          selectedPointId={selectedPointId}
          onSelectPoint={onSelectPoint}
        />
      </svg>

      {/* No-draft overlay — prompt to open a draft before authoring */}
      {!draft && (
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            background: 'color-mix(in srgb, var(--surface-inverse) 45%, transparent)',
            borderRadius: 8,
            padding: '20px 28px',
            color: 'var(--fg-on-brand)',
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
