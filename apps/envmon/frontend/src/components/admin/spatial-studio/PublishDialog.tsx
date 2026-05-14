/* eslint-disable jsdoc/require-jsdoc */
/**
 * PublishDialog — modal confirmation dialog for publishing a draft layout.
 *
 * Requires a non-empty change reason before the confirm button is enabled.
 * Displays the verbatim historical-impact warning required by the product spec.
 */

/** Props for {@link PublishDialog}. */
export interface PublishDialogProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Whether a publish mutation is in flight. */
  isPending: boolean;
  /** Controlled value for the reason textarea. */
  reason: string;
  /** Called on every keystroke in the reason textarea. */
  onReasonChange: (reason: string) => void;
  /** Called when the user confirms the publish. */
  onConfirm: () => void;
  /** Called when the user cancels or closes the dialog. */
  onCancel: () => void;
}

/** Publish confirmation modal with historical-impact warning and reason input. */
export default function PublishDialog({
  isOpen,
  isPending,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
}: PublishDialogProps) {
  if (!isOpen) return null;

  return (
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
          Publishing this layout will affect how current and historical EnvMon results are
          spatially displayed. Inspection result values are unchanged; only their spatial
          interpretation may change.
        </div>

        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 4 }}>
          Reason for change <span style={{ color: 'var(--sunset)' }}>*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
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
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={onConfirm}
            disabled={!reason.trim() || isPending}
            data-testid="publish-confirm-btn"
          >
            {isPending ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
