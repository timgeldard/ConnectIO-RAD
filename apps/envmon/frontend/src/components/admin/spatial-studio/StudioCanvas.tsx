/* eslint-disable jsdoc/require-jsdoc */
/**
 * StudioCanvas — routes to {@link FloorPlanCanvas} or {@link GridCanvas}
 * based on whether the floor has a background SVG.
 *
 * canvas_type / canvas_metadata columns are added in the Slice 1 migration.
 * Until then, canvas type is derived from the presence of svg_url.
 */

import type { FloorInfo, DraftLayout, StudioMode } from '~/types';
import FloorPlanCanvas from './FloorPlanCanvas';
import GridCanvas from './GridCanvas';

/** Shared props threaded through both canvas variants. */
export interface StudioCanvasProps {
  /** Floor being authored. */
  floor: FloorInfo;
  /** Current open draft layout, or null when no draft exists. */
  draft: DraftLayout | null;
  /** Active authoring mode. */
  activeMode: StudioMode;
  /** Selected zone ID, or null. */
  selectedZoneId: string | null;
  /** Selected point (coordinate) ID, or null. */
  selectedPointId: string | null;
  /** Called when the user selects a zone on canvas. */
  onSelectZone: (id: string | null) => void;
  /** Called when the user selects a point on canvas. */
  onSelectPoint: (id: string | null) => void;
  /** Called to open / create the draft for this floor. */
  onCreateDraft: () => void;
  /** True while the create-draft mutation is in flight. */
  isCreatingDraft: boolean;
}

/** Top-level canvas container — routes to the appropriate canvas variant. */
export default function StudioCanvas(props: StudioCanvasProps) {
  // Derive canvas type from svg_url until canvas_type column is available (Slice 1)
  const canvasType = props.floor.svg_url ? 'floor_plan' : 'grid';

  return (
    <div
      style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--surface-sunken)' }}
      data-testid="studio-canvas"
    >
      {canvasType === 'floor_plan' ? (
        <FloorPlanCanvas {...props} />
      ) : (
        <GridCanvas {...props} />
      )}
    </div>
  );
}
