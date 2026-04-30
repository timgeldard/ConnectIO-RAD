import { useCallback, useState } from 'react'
import { I } from '../ui'
import type { GeniePageContext } from '../api/genie'
import { useGenieConversation } from './useGenieConversation'

function ResultTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: string[] }) {
  if (!rows.length || !columns.length) return <div className="genie-empty">No rows returned.</div>
  return (
    <div className="genie-table-wrap">
      <table className="genie-table">
        <thead>
          <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, i) => (
            <tr key={i}>{columns.map(c => <td key={c}>{String(row[c] ?? '')}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {rows.length > 20 && <div className="genie-empty">{rows.length - 20} more rows returned.</div>}
    </div>
  )
}

export function GenieDrawer({
  open,
  onOpen,
  onClose,
  pageContext,
}: {
  open: boolean
  onOpen: () => void
  onClose: () => void
  pageContext: GeniePageContext
}) {
  const [prompt, setPrompt] = useState('')
  const getContext = useCallback(() => pageContext, [pageContext])
  const genie = useGenieConversation(getContext)

  const submit = () => {
    const text = prompt.trim()
    if (!text || genie.thinking) return
    setPrompt('')
    genie.ask(text)
  }

  return (
    <>
      <button className="genie-trigger" onClick={open ? onClose : onOpen}>
        {I.message}<span>Ask Genie</span>
      </button>
      {open && <div className="genie-backdrop" onClick={onClose} />}
      <aside className={`genie-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="genie-head">
          <div>
            <div className="genie-eyebrow">Databricks Genie</div>
            <h2>{I.message}<span>Ask Genie</span></h2>
          </div>
          <div className="genie-head-actions">
            <button className="btn secondary" onClick={genie.reset}>{I.refresh}<span>New chat</span></button>
            <button className="icon-btn" onClick={onClose} title="Close Genie">{I.x}</button>
          </div>
        </div>

        <div className="genie-context">
          <span>{pageContext.mode.replaceAll('_', ' ')}</span>
          <strong>{pageContext.selected_process_order || pageContext.selected_material || pageContext.selected_plant || 'Global context'}</strong>
        </div>

        <div className="genie-messages">
          {genie.turns.length === 0 && (
            <div className="genie-welcome">
              Ask about the current order, filtered list, or analytics screen. Genie will receive this page context with your question.
            </div>
          )}
          {genie.turns.map(turn => (
            <div key={turn.id} className={`genie-msg ${turn.role}`}>
              <div className="genie-msg-role">{turn.role === 'user' ? 'You' : 'Genie'}</div>
              <div className="genie-msg-body">
                {turn.content || (turn.status === 'IN_PROGRESS' ? 'Thinking...' : '')}
                {turn.error && <div className="genie-error">{turn.error}</div>}
                {turn.attachments?.map((a, i) => (
                  <div className="genie-attachment" key={a.attachmentId || `${turn.id}-${i}`}>
                    {a.text && <p>{a.text}</p>}
                    {a.sql && (
                      <details>
                        <summary>Show SQL</summary>
                        <pre>{a.sql}</pre>
                      </details>
                    )}
                    {a.attachmentId && turn.results?.[a.attachmentId] && (
                      <ResultTable
                        columns={turn.results[a.attachmentId].columns}
                        rows={turn.results[a.attachmentId].rows}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {genie.error && <div className="genie-global-error">{genie.error}</div>}

        <div className="genie-input">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Ask about this screen..."
          />
          <button className="btn primary" disabled={!prompt.trim() || genie.thinking} onClick={submit}>
            {genie.thinking ? I.clock : I.arrowR}<span>{genie.thinking ? 'Thinking' : 'Send'}</span>
          </button>
        </div>
      </aside>
    </>
  )
}
