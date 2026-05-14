/* eslint-disable jsdoc/require-jsdoc */
/**
 * StudioShell — three-column chrome for the Spatial Studio authoring session.
 *
 * Layout (top-to-bottom, left-to-right):
 *   ┌─────────────────────────────────────────────────┐
 *   │               CommandBar (top)                  │
 *   ├────────────┬───────────────────┬────────────────┤
 *   │ Hierarchy  │   StudioCanvas    │  InspectorPanel│
 *   │   Rail     │   (placeholder)   │  (placeholder) │
 *   └────────────┴───────────────────┴────────────────┘
 *
 * Canvas and Inspector are placeholder stubs until Slices 8–9.
 */

import { useState } from 'react';
import CommandBar from './CommandBar';
import HierarchyRail from './HierarchyRail';
import StudioCanvas from './StudioCanvas';
import InspectorPanel from './InspectorPanel';
import PublishDialog from './PublishDialog';
import { useStudioState } from './hooks/useStudioState';
import {
  useDraftLayout,
  useCreateDraft,
  useValidate,
  usePublish,
} from '~/api/client';
import type { FloorInfo, ValidationResult } from '~/types';

/** Props for {@link StudioShell}. */
export interface StudioShellProps {
  /** SAP plant code. */
  plantId: string;
  /** Floor ID currently being authored. */
  floorId: string;
  /** Full floor metadata (name, svg_url, dimensions). */
  floor: FloorInfo;
}

/** Three-column Studio layout shell with command bar. */
export default function StudioShell({ plantId, floorId, floor }: StudioShellProps) {
  const studio = useStudioState();

  const { data: draftData, isLoading: isDraftLoading } = useDraftLayout(plantId, floorId);
  const draft = draftData?.revision ? draftData : null;
  const revisionId = draft?.revision?.revision_id ?? null;

  const createDraft = useCreateDraft();
  const validateMutation = useValidate();
  const publishMutation = usePublish();

  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishReason, setPublishReason] = useState('');

  const hasDraft = Boolean(revisionId);
  const selectedZone = draft?.zones.find(z => z.zone_id === studio.selectedZoneId) ?? null;
  const isPublishable = validationResult?.issues.every(i => i.severity !== 'blocking_error') ?? false;

  function handleOpenDraft() {
    createDraft.mutate({ plantId, floorId }, { onSuccess: () => studio.clearDirty() });
  }

  function handleValidate() {
    if (!revisionId) return;
    validateMutation.mutate(
      { plantId, floorId, revisionId },
      {
        onSuccess: (result) => {
          setValidationResult(result);
          studio.setMode('review');
        },
      },
    );
  }

  function handlePublish() {
    setShowPublishDialog(true);
  }

  function handlePublishConfirm() {
    if (!revisionId || !publishReason.trim()) return;
    publishMutation.mutate(
      { floorId, plant_id: plantId, revision_id: revisionId, change_reason: publishReason },
      {
        onSuccess: () => {
          setShowPublishDialog(false);
          setPublishReason('');
          studio.reset();
          setValidationResult(null);
        },
      },
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <CommandBar
        activeMode={studio.activeMode}
        isDirty={studio.isDirty}
        hasDraft={hasDraft}
        isValidating={validateMutation.isPending}
        isPublishing={publishMutation.isPending}
        isPublishable={isPublishable}
        onModeChange={studio.setMode}
        onValidate={handleValidate}
        onPublish={handlePublish}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <HierarchyRail
          draft={draft ?? null}
          isLoading={isDraftLoading}
          selectedZoneId={studio.selectedZoneId}
          selectedPointId={studio.selectedPointId}
          onSelectZone={studio.selectZone}
          onSelectPoint={studio.selectPoint}
        />

        <StudioCanvas
          floor={floor}
          draft={draft}
          activeMode={studio.activeMode}
          selectedZoneId={studio.selectedZoneId}
          selectedPointId={studio.selectedPointId}
          onSelectZone={studio.selectZone}
          onSelectPoint={studio.selectPoint}
          onCreateDraft={handleOpenDraft}
          isCreatingDraft={createDraft.isPending}
        />

        <InspectorPanel
          zone={selectedZone}
          plantId={plantId}
          floorId={floorId}
          revisionId={revisionId}
          onDeselectZone={() => studio.selectZone(null)}
          validationResult={validationResult}
        />
      </div>

      <PublishDialog
        isOpen={showPublishDialog}
        isPending={publishMutation.isPending}
        reason={publishReason}
        onReasonChange={setPublishReason}
        onConfirm={handlePublishConfirm}
        onCancel={() => { setShowPublishDialog(false); setPublishReason(''); }}
      />
    </div>
  );
}
