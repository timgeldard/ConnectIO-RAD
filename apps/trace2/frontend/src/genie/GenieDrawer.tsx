/**
 * Right-side Genie drawer for trace2 — minimal, inline-styled, opens
 * via a floating trigger and closes on backdrop / escape / explicit
 * close.
 *
 * Styled inline rather than via POH's stylesheet because trace2's UI
 * convention is inline styles + Kerry CSS variables (no shared genie
 * CSS exists yet).  The drawer is deliberately compact — most of the
 * value comes from the conversation hook + page context; the chrome
 * stays out of the way.
 */
import { useCallback, useEffect, useState } from 'react'

import { useGenieConversation } from './useGenieConversation'
import type { GenieAttachment, GenieQueryResult, GeniePageContext } from './api'

export interface GenieDrawerProps {
  /** Whether the drawer is currently open. */
  open: boolean
  /** Handler to open the drawer (used by the floating trigger button). */
  onOpen: () => void
  /** Handler to close the drawer (backdrop / Escape / close button). */
  onClose: () => void
  /** Ephemeral page context — what the operator is looking at right now. */
  pageContext: GeniePageContext
  /** Optional initial prompt — prefilled into the textarea when the drawer
   * is opened programmatically (e.g. via the "Explain this transfer" menu
   * item). */
  initialPrompt?: string | null
}

/**
 * Render the Genie drawer + its floating trigger button.
 *
 * @param props See {@link GenieDrawerProps}.
 * @returns The trigger button (always rendered) and the drawer
 *   (rendered conditionally on `open`).
 */
export function GenieDrawer({
  open,
  onOpen,
  onClose,
  pageContext,
  initialPrompt = null,
}: GenieDrawerProps) {
  const [prompt, setPrompt] = useState('')
  const getContext = useCallback(() => pageContext, [pageContext])
  const genie = useGenieConversation(getContext)

  // When the drawer is opened with a pre-filled prompt, hydrate the
  // textarea so the operator can edit or send as-is.  We only do this
  // when the drawer transitions from closed → open with an
  // `initialPrompt`; otherwise the textarea preserves whatever the
  // operator was typing.
  useEffect(() => {
    if (open && initialPrompt) setPrompt(initialPrompt)
  }, [open, initialPrompt])

  // Close on Escape — operators on a tablet use the back-button on the
  // bezel which fires Escape, so this is the primary dismiss path.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const submit = () => {
    const text = prompt.trim()
    if (!text || genie.thinking) return
    setPrompt('')
    void genie.ask(text)
  }

  return (
    <>
      <button
        type="button"
        onClick={open ? onClose : onOpen}
        data-testid="trace2-genie-trigger"
        style={triggerStyle}
        aria-expanded={open}
        aria-controls="trace2-genie-drawer"
      >
        ✦ Ask Genie
      </button>
      {open && (
        <>
          <div onClick={onClose} style={backdropStyle} data-testid="trace2-genie-backdrop" />
          <aside
            id="trace2-genie-drawer"
            role="dialog"
            aria-label="Genie assistant"
            data-testid="trace2-genie-drawer"
            style={drawerStyle}
          >
            <header style={headerStyle}>
              <div>
                <div style={eyebrowStyle}>trace2 · Genie</div>
                <h2 style={titleStyle}>Ask about this lineage</h2>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={genie.reset} style={secondaryBtnStyle}>
                  New chat
                </button>
                <button type="button" onClick={onClose} style={iconBtnStyle} aria-label="Close">
                  ×
                </button>
              </div>
            </header>

            <ContextBadge ctx={pageContext} />

            <div style={messagesStyle} data-testid="trace2-genie-messages">
              {genie.turns.length === 0 && (
                <div style={welcomeStyle}>
                  Ask Genie about the focal batch, an upstream supplier, or a downstream
                  customer.  Genie will use the current page context unless you say otherwise.
                </div>
              )}
              {genie.turns.map((turn) => (
                <div key={turn.id} style={msgStyle(turn.role)}>
                  <div style={msgRoleStyle}>{turn.role === 'user' ? 'You' : 'Genie'}</div>
                  <div style={msgBodyStyle}>
                    {turn.content || (turn.status === 'IN_PROGRESS' ? 'Thinking…' : '')}
                    {turn.error && <div style={errorStyle}>{turn.error}</div>}
                    {turn.attachments?.map((a, i) => (
                      <Attachment
                        key={a.attachmentId || `${turn.id}-${i}`}
                        attachment={a}
                        result={a.attachmentId ? turn.results?.[a.attachmentId] : undefined}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {genie.error && <div style={globalErrorStyle}>{genie.error}</div>}

            <div style={inputStyle}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submit()
                  }
                }}
                placeholder="Ask about this batch, lineage, or transfer…"
                rows={3}
                style={textareaStyle}
                data-testid="trace2-genie-input"
              />
              <button
                type="button"
                onClick={submit}
                disabled={!prompt.trim() || genie.thinking}
                style={primaryBtnStyle(!prompt.trim() || genie.thinking)}
                data-testid="trace2-genie-send"
              >
                {genie.thinking ? '…' : 'Send'}
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* internal building blocks                                           */
/* ------------------------------------------------------------------ */

function ContextBadge({ ctx }: { ctx: GeniePageContext }) {
  const label =
    ctx.mode === 'lineage_transfer' && ctx.selected
      ? `${ctx.focal.material_id} / ${ctx.focal.batch_id} → ${ctx.selected.material_id} / ${ctx.selected.batch_id}`
      : `${ctx.focal.material_id} / ${ctx.focal.batch_id}`
  return (
    <div style={ctxBadgeStyle} data-testid="trace2-genie-context">
      <span style={{ fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {ctx.mode === 'lineage_transfer' ? 'Transfer' : 'Lineage'}
      </span>
      <strong style={{ fontSize: 12.5 }}>{label}</strong>
    </div>
  )
}

function Attachment({
  attachment,
  result,
}: {
  attachment: GenieAttachment
  result?: GenieQueryResult
}) {
  return (
    <div style={attachmentStyle}>
      {attachment.text && <p style={{ margin: '4px 0' }}>{attachment.text}</p>}
      {attachment.sql && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--ink-3, #6b7280)' }}>
            Show SQL
          </summary>
          <pre style={preStyle}>{attachment.sql}</pre>
        </details>
      )}
      {result && <AttachmentTable result={result} />}
    </div>
  )
}

function AttachmentTable({ result }: { result: GenieQueryResult }) {
  if (!result.rows.length || !result.columns.length) {
    return <div style={{ fontSize: 11, color: 'var(--ink-3, #6b7280)' }}>No rows returned.</div>
  }
  return (
    <div style={{ overflowX: 'auto', marginTop: 4 }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {result.columns.map((c) => (
              <th key={c} style={thStyle}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.slice(0, 20).map((row, i) => (
            <tr key={i}>
              {result.columns.map((c) => (
                <td key={c} style={tdStyle}>
                  {String(row[c] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length > 20 && (
        <div style={{ fontSize: 11, color: 'var(--ink-3, #6b7280)' }}>
          {result.rows.length - 20} more rows returned.
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* styles                                                             */
/* ------------------------------------------------------------------ */

const triggerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  zIndex: 90,
  padding: '8px 14px',
  background: 'var(--brand, #003C52)',
  color: '#fff',
  border: 'none',
  borderRadius: 999,
  fontSize: 13,
  fontFamily: 'var(--font-sans, system-ui)',
  boxShadow: '0 6px 18px rgba(0, 60, 82, 0.25)',
  cursor: 'pointer',
}
const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.18)',
  zIndex: 95,
}
const drawerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 420,
  maxWidth: '92vw',
  zIndex: 100,
  background: 'var(--bg-surface, #ffffff)',
  borderLeft: '1px solid var(--line, #e3e7ec)',
  boxShadow: '-12px 0 28px rgba(0,0,0,0.10)',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'var(--font-sans, system-ui)',
}
const headerStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--line, #e3e7ec)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
}
const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--ink-3, #6b7280)',
}
const titleStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 16,
  color: 'var(--ink-1, #16202a)',
}
const secondaryBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  background: 'transparent',
  border: '1px solid var(--line, #e3e7ec)',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--ink-2, #4b5563)',
}
const iconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  background: 'transparent',
  border: 'none',
  fontSize: 20,
  cursor: 'pointer',
  color: 'var(--ink-3, #6b7280)',
}
const ctxBadgeStyle: React.CSSProperties = {
  padding: '6px 16px',
  background: 'var(--bg-surface-2, #f1f5f9)',
  borderBottom: '1px solid var(--line, #e3e7ec)',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}
const messagesStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: 12,
}
const welcomeStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--ink-3, #6b7280)',
  padding: '24px 8px',
  textAlign: 'center',
  lineHeight: 1.5,
}
const msgStyle = (role: 'user' | 'assistant'): React.CSSProperties => ({
  marginBottom: 14,
  display: 'flex',
  flexDirection: 'column',
  alignItems: role === 'user' ? 'flex-end' : 'flex-start',
})
const msgRoleStyle: React.CSSProperties = {
  fontSize: 10.5,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--ink-3, #6b7280)',
  marginBottom: 4,
}
const msgBodyStyle: React.CSSProperties = {
  fontSize: 13,
  background: 'var(--bg-surface-2, #f1f5f9)',
  padding: '8px 12px',
  borderRadius: 8,
  maxWidth: '92%',
  whiteSpace: 'pre-wrap',
  color: 'var(--ink-1, #16202a)',
}
const errorStyle: React.CSSProperties = {
  marginTop: 6,
  padding: '4px 8px',
  background: '#fee2e2',
  color: '#991b1b',
  fontSize: 11,
  borderRadius: 4,
}
const globalErrorStyle: React.CSSProperties = {
  margin: 8,
  padding: '6px 10px',
  background: '#fee2e2',
  color: '#991b1b',
  fontSize: 12,
  borderRadius: 4,
}
const attachmentStyle: React.CSSProperties = {
  marginTop: 6,
  padding: '6px 8px',
  background: 'var(--bg-surface, #ffffff)',
  border: '1px solid var(--line, #e3e7ec)',
  borderRadius: 4,
}
const preStyle: React.CSSProperties = {
  margin: '4px 0 0',
  padding: 6,
  background: 'var(--bg-surface-2, #f1f5f9)',
  fontSize: 11,
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}
const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 11.5,
}
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 6px',
  borderBottom: '1px solid var(--line, #e3e7ec)',
  color: 'var(--ink-2, #4b5563)',
  fontWeight: 600,
}
const tdStyle: React.CSSProperties = {
  padding: '4px 6px',
  borderBottom: '1px solid var(--line, #e3e7ec)',
  color: 'var(--ink-1, #16202a)',
}
const inputStyle: React.CSSProperties = {
  padding: 10,
  borderTop: '1px solid var(--line, #e3e7ec)',
  display: 'flex',
  gap: 8,
}
const textareaStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 60,
  resize: 'vertical',
  padding: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  border: '1px solid var(--line, #e3e7ec)',
  borderRadius: 4,
  background: 'var(--bg-surface, #ffffff)',
  color: 'var(--ink-1, #16202a)',
}
const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '8px 14px',
  background: disabled ? 'var(--ink-4, #cbd5e1)' : 'var(--brand, #003C52)',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 13,
  alignSelf: 'flex-end',
})
