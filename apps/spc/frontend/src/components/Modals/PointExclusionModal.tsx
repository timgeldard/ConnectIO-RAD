import { useEffect, useRef, useState } from 'react'

interface PointExclusionModalProps {
  isOpen: boolean
  onClose: () => void
  chartTitle?: string
  pointDetails?: string
  onConfirm?: (payload: { reason: string; justification: string; signature: string }) => void
}

const EXCLUSION_REASONS = [
  { value: 'measurement-error', label: 'Measurement / Gage Error' },
  { value: 'special-cause',     label: 'Known Special Cause'       },
  { value: 'setup-change',      label: 'Setup or Tool Change'      },
  { value: 'other',             label: 'Other'                     },
]

export default function PointExclusionModal({
  isOpen,
  onClose,
  chartTitle = 'Selected Point',
  pointDetails = 'Sample #14 • Value: 15.67',
  onConfirm,
}: PointExclusionModalProps) {
  const [reason,        setReason]        = useState('')
  const [justification, setJustification] = useState('')
  const [signature,     setSignature]     = useState('')
  const [error,         setError]         = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (isOpen) { if (!d.open) d.showModal() } else { if (d.open) d.close() }
  }, [isOpen])

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    const onClose = () => {
      setReason(''); setJustification(''); setSignature(''); setError(null)
    }
    d.addEventListener('close', onClose)
    return () => d.removeEventListener('close', onClose)
  }, [])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose()
  }

  const handleSubmit = () => {
    if (!reason || !justification.trim() || !signature.trim()) {
      setError('All fields are required for compliance.')
      return
    }

    console.log('Point exclusion audit trail', {
      chartTitle, pointDetails, reason,
      justification: justification.trim(),
      signature: signature.trim(),
      recordedAt: new Date().toISOString(),
    })

    onConfirm?.({ reason, justification: justification.trim(), signature: signature.trim() })
    onClose()
  }

  return (
    <dialog ref={dialogRef} onClick={handleBackdropClick}>
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 320 }}>
        <div>
          <p className="eyebrow" style={{ margin: '0 0 2px' }}>{chartTitle} — {pointDetails}</p>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-1)' }}>Exclude Point</h2>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>Reason for Exclusion</span>
          <select
            className="field"
            value={reason}
            onChange={e => { setReason(e.target.value); setError(null) }}
            required
          >
            <option value="">Select reason…</option>
            {EXCLUSION_REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>Justification / Comments</span>
          <textarea
            className="field"
            placeholder="Detailed explanation required for audit…"
            value={justification}
            onChange={e => { setJustification(e.target.value); setError(null) }}
            rows={4}
            required
            style={{ resize: 'vertical' }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-4)' }}>Detailed explanation required for the audit trail.</span>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>Electronic Signature</span>
          <input
            className="field"
            type="text"
            placeholder="Type your full name to sign"
            value={signature}
            onChange={e => { setSignature(e.target.value); setError(null) }}
            required
          />
          <span style={{ fontSize: 11, color: 'var(--text-4)' }}>Type your full name to sign this exclusion.</span>
        </label>

        {error && (
          <div role="alert" style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--status-risk-bg)', color: 'var(--status-risk)', fontSize: '0.8125rem', border: '1px solid var(--status-risk)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" type="button" onClick={handleSubmit}>Confirm Exclusion</button>
        </div>
      </div>
    </dialog>
  )
}
