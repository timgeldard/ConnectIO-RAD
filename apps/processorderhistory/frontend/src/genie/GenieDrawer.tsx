import { useCallback, useState } from 'react'
import { useT } from '../i18n/context'
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

/** Props for the contextual Genie assistant drawer. */
export interface GenieDrawerProps {
  /** Whether the Genie drawer is currently visible. */
  open: boolean
  /** Opens the Genie drawer from the fixed trigger button. */
  onOpen: () => void
  /** Closes the Genie drawer. */
  onClose: () => void
  /** Ephemeral context from the active Process Order History page. */
  pageContext: GeniePageContext
}

/** Contextual right-side assistant for Databricks Genie conversations. */
export function GenieDrawer({
  open,
  onOpen,
  onClose,
  pageContext,
}: GenieDrawerProps) {
  const { t } = useT()
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
        {I.message}<span>{t.genieAsk}</span>
      </button>
      {open && (
      <>
      <div className="genie-backdrop" onClick={onClose} />
      <aside className="genie-drawer open">
        <div className="genie-head">
          <div>
            <div className="genie-eyebrow">{t.genieEyebrow}</div>
            <h2>{I.message}<span>{t.genieAsk}</span></h2>
          </div>
          <div className="genie-head-actions">
            <button className="btn secondary" onClick={genie.reset}>{I.refresh}<span>{t.genieNewChat}</span></button>
            <button className="icon-btn" onClick={onClose} title={t.genieClose}>{I.x}</button>
          </div>
        </div>

        <div className="genie-context">
          <span>{pageContext.mode.replaceAll('_', ' ')}</span>
          <strong>{pageContext.selected_process_order || pageContext.selected_material || pageContext.selected_plant || t.genieGlobalContext}</strong>
        </div>

        <div className="genie-messages">
          {genie.turns.length === 0 && (
            <div className="genie-welcome">
              {t.genieWelcome}
            </div>
          )}
          {genie.turns.map(turn => (
            <div key={turn.id} className={`genie-msg ${turn.role}`}>
              <div className="genie-msg-role">{turn.role === 'user' ? t.genieYou : t.genieName}</div>
              <div className="genie-msg-body">
                {turn.content || (turn.status === 'IN_PROGRESS' ? t.genieThinking : '')}
                {turn.error && <div className="genie-error">{turn.error}</div>}
                {turn.attachments?.map((a, i) => (
                  <div className="genie-attachment" key={a.attachmentId || `${turn.id}-${i}`}>
                    {a.text && <p>{a.text}</p>}
                    {a.sql && (
                      <details>
                        <summary>{t.genieShowSql}</summary>
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
            placeholder={t.geniePlaceholder}
          />
          <button className="btn primary" disabled={!prompt.trim() || genie.thinking} onClick={submit}>
            {genie.thinking ? I.clock : I.arrowR}<span>{genie.thinking ? t.genieThinkingShort : t.genieSend}</span>
          </button>
        </div>
      </aside>
      </>
      )}
    </>
  )
}
