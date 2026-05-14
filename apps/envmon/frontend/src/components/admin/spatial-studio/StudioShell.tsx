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
import { useStudioState } from './hooks/useStudioState';
import {
  useDraftLayout,
  useCreateDraft,
  useValidate,
  usePublish,
} from '~/api/client';
import type { ValidationResult } from '~/types';

/** Props for {@link StudioShell}. */
export interface StudioShellProps {
  /** SAP plant code. */
  plantId: string;
  /** Floor ID currently being authored. */
  floorId: string;
}

/** Three-column Studio layout shell with command bar. */
export default function StudioShell({ plantId, floorId }: StudioShellProps) {
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

        {/* Canvas placeholder — replaced by StudioCanvas in Slice 8 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface-sunken)',
            color: 'var(--text-3)',
            fontSize: 13,
          }}
          data-testid="studio-canvas-placeholder"
        >
          {!hasDraft ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 12, color: 'var(--text-2)' }}>
                No draft is open for this floor.
              </div>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleOpenDraft}
                disabled={createDraft.isPending}
              >
                {createDraft.isPending ? 'Opening…' : 'Open draft'}
              </button>
            </div>
          ) : (
            <span>Canvas coming in Slice 8</span>
          )}
        </div>

        {/* Inspector placeholder — replaced by InspectorPanel in Slice 9 */}
        <div
          style={{
            width: 260,
            flexShrink: 0,
            borderLeft: '1px solid var(--border)',
            background: 'var(--surface)',
            overflow: 'auto',
            padding: 12,
          }}
          data-testid="studio-inspector-placeholder"
        >
          {validationResult && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
                Validation
              </div>
              {validationResult.issues.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--jade)' }}>✓ No issues found</div>
              ) : (
                validationResult.issues.map((issue, i) => (
                  <div key={i} style={{ fontSize: 12, marginBottom: 6, color: issue.severity === 'blocking_error' ? 'var(--sunset)' : 'var(--sunrise)' }}>
                    <span style={{ fontWeight: 600 }}>{issue.code}</span>
                    <span style={{ marginLeft: 4 }}>{issue.message}</span>
                  </div>
                ))
              )}
            </div>
          )}
          {!validationResult && (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Inspector coming in Slice 9</div>
          )}
        </div>
      </div>

      {/* Publish dialog */}
      {showPublishDialog && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Publish layout"
        >
          <div style={{
            background: 'var(--surface)', borderRadius: 8, padding: 24,
            width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Publish layout</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>
              Publishing will update the live heatmap coordinates for this floor.
              Historical analytics will reflect the new zone assignments.
            </div>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>
              Reason for change <span style={{ color: 'var(--sunset)' }}>*</span>
            </label>
            <textarea
              value={publishReason}
              onChange={(e) => setPublishReason(e.target.value)}
              placeholder="Describe what changed and why…"
              rows={3}
              style={{
                width: '100%', fontSize: 13, padding: 8,
                border: '1px solid var(--border)', borderRadius: 4,
                background: 'var(--surface-sunken)', color: 'var(--text-1)',
                resize: 'vertical', boxSizing: 'border-box',
              }}
              data-testid="publish-reason-input"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => { setShowPublishDialog(false); setPublishReason(''); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={handlePublishConfirm}
                disabled={!publishReason.trim() || publishMutation.isPending}
                data-testid="publish-confirm-btn"
              >
                {publishMutation.isPending ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
