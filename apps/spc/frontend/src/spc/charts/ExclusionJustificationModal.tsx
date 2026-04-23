import { useEffect, useRef, useState } from 'react'
import type { ExclusionDialogState } from '../types'

const REASONS = [
  'Special-cause investigation',
  'Sampling / transcription error',
  'Instrument or lab issue',
  'Phase I stabilization',
  'Manual review override',
]

interface ExclusionSubmitPayload {
  reason: string
  comment: string
  justification: string
}

interface ExclusionJustificationModalProps {
  dialog: ExclusionDialogState | null
  saving: boolean
  onCancel: () => void
  onSubmit: (payload: ExclusionSubmitPayload) => void
}

function resolveContent(action: string) {
  switch (action) {
    case 'manual_restore':
      return {
        heading:           'Restore Point to Calculation Set',
        description:       'Restoring a point changes the active control limits and capability results. Provide an attributable reason before continuing.',
        primaryButtonText: 'Restore',
        danger:            false,
        defaultReason:     'Manual review override',
      }
    case 'clear_exclusions':
      return {
        heading:           'Restore All Excluded Points',
        description:       'This will restore every excluded point for the active chart scope. Provide a justification for the audit trail.',
        primaryButtonText: 'Restore All',
        danger:            true,
        defaultReason:     REASONS[0],
      }
    case 'auto_clean_phase_i':
      return {
        heading:           'Apply Phase I Auto-clean',
        description:       'This will persist the auto-cleaned exclusion set as the active baseline. Confirm the rationale before applying it.',
        primaryButtonText: 'Apply',
        danger:            false,
        defaultReason:     'Phase I stabilization',
      }
    default:
      return {
        heading:           'Exclude Point from Control Limits',
        description:       'Excluding a point changes the active control limits and capability results. Provide a justification before continuing.',
        primaryButtonText: 'Confirm',
        danger:            true,
        defaultReason:     REASONS[0],
      }
  }
}

export default function ExclusionJustificationModal({
  dialog,
  saving,
  onCancel,
  onSubmit,
}: ExclusionJustificationModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [reason, setReason]   = useState(REASONS[0])
  const [comment, setComment] = useState('')

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (dialog) {
      if (!d.open) d.showModal()
    } else {
      if (d.open) d.close()
    }
  }, [!!dialog]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    const onClose = () => onCancel()
    d.addEventListener('close', onClose)
    return () => d.removeEventListener('close', onClose)
  }, [onCancel])

  useEffect(() => {
    if (!dialog) return
    const { defaultReason } = resolveContent(dialog.action)
    setReason(defaultReason)
    setComment('')
  }, [dialog])

  const handleSubmit = () => {
    const justification = comment.trim()
      ? `${reason} — ${comment.trim()}`
      : reason
    onSubmit({ reason, comment: comment.trim(), justification })
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onCancel()
  }

  const content = dialog ? resolveContent(dialog.action) : null

  const targetLabel = dialog?.point
    ? `${dialog.point.batch_id ?? 'Point'} · sample ${dialog.point.sample_seq ?? '—'}`
    : `${dialog?.excludedCount ?? 0} point${dialog?.excludedCount === 1 ? '' : 's'}`

  const isOptionalComment =
    dialog?.action === 'manual_exclude' || dialog?.action === 'manual_restore'

  return (
    <dialog ref={dialogRef} onClick={handleBackdropClick}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line-1)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
          {content?.heading ?? ''}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
          {content?.description}
        </p>

        {/* Target info */}
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--surface-2)',
            borderLeft: '3px solid var(--valentia-slate)',
            borderRadius: '0 6px 6px 0',
          }}
        >
          <span
            style={{
              display: 'block', marginBottom: 3,
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: 'var(--text-3)',
            }}
          >
            Target
          </span>
          <strong style={{ fontSize: 13, color: 'var(--text-1)' }}>{targetLabel}</strong>
          {dialog?.point?.value != null && (
            <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--text-3)' }}>
              Value {Number(dialog.point.value).toFixed(4)}
            </span>
          )}
          {dialog?.point?.batch_date && (
            <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--text-3)' }}>
              {String(dialog.point.batch_date).slice(0, 10)}
            </span>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="field-label" htmlFor="exclusion-reason">Reason</label>
          <select
            id="exclusion-reason"
            className="field"
            value={reason}
            onChange={e => setReason(e.target.value)}
            disabled={saving}
          >
            {REASONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        {/* Comment */}
        <div>
          <label className="field-label" htmlFor="exclusion-comment">
            {isOptionalComment ? 'Comment (optional)' : 'Comment'}
          </label>
          <textarea
            id="exclusion-comment"
            className="field"
            style={{ height: 'auto', padding: '8px 10px', resize: 'vertical' }}
            rows={4}
            placeholder="Additional context for the audit trail"
            value={comment}
            onChange={e => setComment(e.target.value)}
            disabled={saving}
          />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 24px', borderTop: '1px solid var(--line-1)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}
      >
        <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          className={`btn ${content?.danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Saving…' : (content?.primaryButtonText ?? 'Confirm')}
        </button>
      </div>
    </dialog>
  )
}
