/* eslint-disable jsdoc/require-jsdoc */
/**
 * useCanvasInteraction — pointer event logic for the Spatial Studio canvas.
 *
 * In `'structure'` mode with an open draft, a pointer-down + drag creates a new
 * rectangular L4 zone. The in-progress rectangle is returned as {@link dragRect}
 * so canvas components can render a live preview inside the SVG.
 *
 * Coordinate conversion uses `SVGSVGElement.getScreenCTM().inverse()` to map
 * pointer client coords to the `0 0 100 100` percentage viewBox shared by both
 * canvas variants.
 *
 * Known limitation (flagged for Slice 10): no optimistic update — there is a
 * brief gap between pointer-up and the refetch where the new zone is absent,
 * and the inspector shows an empty state while the mutation is in-flight.
 */

import { useRef, useState, useCallback } from 'react';
import { useUpsertZone } from '~/api/client';
import type { DraftLayout, LayoutZone, RectangleGeometry, StudioMode } from '~/types';

/** Props for {@link useCanvasInteraction}. */
export interface UseCanvasInteractionProps {
  /** Current authoring mode — draw gesture only fires in `'structure'` mode. */
  activeMode: StudioMode;
  /** Open draft layout; gesture is suppressed when null (no draft). */
  draft: DraftLayout | null;
  /** Called with the new zone_id after a successful create, or null to deselect. */
  onSelectZone: (id: string | null) => void;
}

/** Values returned by {@link useCanvasInteraction}. */
export interface UseCanvasInteractionResult {
  /** In-progress drag rectangle for SVG preview; null when no drag is active. */
  dragRect: RectangleGeometry | null;
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
}

/** Minimum zone side length in percentage units to accept a draw gesture. */
const MIN_ZONE_SIZE = 2;

/** Convert a pointer event to SVG percentage coordinates clamped to [0, 100]. */
function screenToCanvas(
  e: React.PointerEvent,
  svgEl: SVGSVGElement,
): { x_pct: number; y_pct: number } {
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return { x_pct: 0, y_pct: 0 };
  const pt = svgEl.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const svgPt = pt.matrixTransform(ctm.inverse());
  return {
    x_pct: Math.max(0, Math.min(100, svgPt.x)),
    y_pct: Math.max(0, Math.min(100, svgPt.y)),
  };
}

/** Build a normalized RectangleGeometry from two corner points. */
function cornersToRect(
  start: { x_pct: number; y_pct: number },
  end: { x_pct: number; y_pct: number },
): RectangleGeometry {
  return {
    type: 'rectangle',
    x_pct: Math.min(start.x_pct, end.x_pct),
    y_pct: Math.min(start.y_pct, end.y_pct),
    width_pct: Math.abs(end.x_pct - start.x_pct),
    height_pct: Math.abs(end.y_pct - start.y_pct),
  };
}

/** Derive the next auto-name by finding the max existing "Zone N" suffix. */
function nextZoneName(zones: LayoutZone[]): string {
  const max = zones.reduce((n, z) => {
    const m = z.zone_name.match(/^Zone (\d+)$/);
    return m ? Math.max(n, Number(m[1])) : n;
  }, 0);
  return `Zone ${max + 1}`;
}

/** Pointer-driven zone authoring hook for the Spatial Studio canvas. */
export function useCanvasInteraction({
  activeMode,
  draft,
  onSelectZone,
}: UseCanvasInteractionProps): UseCanvasInteractionResult {
  const dragStart = useRef<{ x_pct: number; y_pct: number } | null>(null);
  const [dragRect, setDragRect] = useState<RectangleGeometry | null>(null);
  const upsertZone = useUpsertZone();

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (activeMode !== 'structure' || !draft) return;
      // Don't start a draw gesture when clicking an existing zone shape
      if ((e.target as Element).closest('[data-zone-id]')) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStart.current = screenToCanvas(e, e.currentTarget);
    },
    [activeMode, draft],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragStart.current) return;
      setDragRect(cornersToRect(dragStart.current, screenToCanvas(e, e.currentTarget)));
    },
    [],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragStart.current || !draft) return;
      const rect = cornersToRect(dragStart.current, screenToCanvas(e, e.currentTarget));
      dragStart.current = null;
      setDragRect(null);

      if (rect.width_pct < MIN_ZONE_SIZE || rect.height_pct < MIN_ZONE_SIZE) return;

      const { revision_id, plant_id, floor_id } = draft.revision;
      upsertZone.mutate(
        {
          floorId: floor_id,
          plant_id,
          revision_id,
          zone_name: nextZoneName(draft.zones),
          geometry_type: 'rectangle',
          geometry_json: {
            x_pct: rect.x_pct,
            y_pct: rect.y_pct,
            width_pct: rect.width_pct,
            height_pct: rect.height_pct,
          },
        },
        { onSuccess: (data) => onSelectZone(data.zone_id) },
      );
    },
    [draft, upsertZone, onSelectZone],
  );

  return { dragRect, onPointerDown, onPointerMove, onPointerUp };
}
