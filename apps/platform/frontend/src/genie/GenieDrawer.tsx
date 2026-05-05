/**
 * Genie contextual assistant drawer for the ConnectIO platform.
 *
 * Renders a fixed bottom-right trigger button and a right-side sliding panel.
 * Routes to the correct Genie space based on the active module; auto-resets
 * the conversation when the user switches modules.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { MODULES } from '../shell/modules'
import { useGenieConversation } from './useGenieConversation'
import type { PlatformGenieContext, GenieQueryResult } from './api'

// ── Module → starter prompts ──────────────────────────────────────────────────

const QUALITY_MODULES = new Set(['spc', 'envmon', 'lab', 'enzymes', 'pex-e-35'])
const TRACE_MODULES = new Set(['trace'])
const WAREHOUSE_MODULES = new Set(['process-orders', 'imwm', 'tpm', 'plant-maintenance'])

const STARTERS: Record<string, string[]> = {
  quality: [
    'OOC summary for the current material',
    'Which MICs have Cpk below 1.33?',
    'Show recent batches with signals',
    'Compare process capability by plant',
  ],
  poh: [
    'Show open process orders today',
    'Yield summary for this week',
    'Which lines are running behind schedule?',
    'Equipment with most downtime this month',
  ],
  trace: [
    'Forward trace for the current batch',
    'Supplier risk for this material',
    'Show recall readiness status',
    'Mass balance variance for recent batches',
  ],
  warehouse: [
    'IM/WM mismatches today',
    'Items at expiry risk this week',
    'Slow movers by storage location',
    'Open transfer requests by plant',
  ],
  default: [
    'What data is available across ConnectIO?',
    'Show quality summary for today',
    'Which process orders are open?',
    'Inventory status overview',
  ],
}

function startersForModule(moduleId: string): string[] {
  if (QUALITY_MODULES.has(moduleId)) return STARTERS.quality
  if (TRACE_MODULES.has(moduleId)) return STARTERS.trace
  if (WAREHOUSE_MODULES.has(moduleId)) return STARTERS.warehouse
  if (moduleId && moduleId !== 'home') return STARTERS.poh
  return STARTERS.default
}

function moduleShortName(moduleId: string): string {
  return MODULES.find((m) => m.moduleId === moduleId)?.shortName ?? moduleId.toUpperCase()
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResultTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: string[] }) {
  if (!rows.length || !columns.length) {
    return <div className="plat-genie-empty">No rows returned.</div>
  }
  return (
    <div className="plat-genie-table-wrap">
      <table className="plat-genie-table">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, i) => (
            <tr key={i}>
              {columns.map((c) => <td key={c}>{String(row[c] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 20 && (
        <div className="plat-genie-empty">{rows.length - 20} more rows not shown.</div>
      )}
    </div>
  )
}

// ── Sparkle SVG ───────────────────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0 L9.5 6.5 L16 8 L9.5 9.5 L8 16 L6.5 9.5 L0 8 L6.5 6.5 Z" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/** Props for the platform Genie contextual assistant drawer. */
export interface GenieDrawerProps {
  /** Whether the drawer is visible. */
  open: boolean
  /** Opens the drawer from the trigger button. */
  onOpen: () => void
  /** Closes the drawer. */
  onClose: () => void
  /** Active platform module — drives space routing and conversation reset. */
  moduleId: string
  /** Ephemeral page context passed to Genie with every message. */
  pageContext: PlatformGenieContext
}

/** Platform contextual Genie assistant — right-side sliding drawer. */
export function GenieDrawer({ open, onOpen, onClose, moduleId, pageContext }: GenieDrawerProps) {
  const [prompt, setPrompt] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const getContext = useCallback(() => pageContext, [pageContext])
  const genie = useGenieConversation(moduleId, getContext)

  const starters = startersForModule(moduleId)
  const contextLabel = moduleId ? moduleShortName(moduleId) : 'PLATFORM'
  const entityLabel = pageContext.selected_process_order
    ?? pageContext.selected_material
    ?? pageContext.selected_plant
    ?? null

  // Scroll messages to bottom on new turn
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [genie.turns])

  // Focus textarea when drawer opens
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 120)
  }, [open])

  const submit = useCallback(() => {
    const text = prompt.trim()
    if (!text || genie.thinking) return
    setPrompt('')
    genie.ask(text)
  }, [prompt, genie])

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submit()
      }
    },
    [submit],
  )

  const useStarter = useCallback(
    (text: string) => {
      setPrompt('')
      genie.ask(text)
    },
    [genie],
  )

  return (
    <>
      {/* Fixed trigger button */}
      <button
        className="plat-genie-trigger"
        onClick={open ? onClose : onOpen}
        aria-label="Open Genie assistant"
      >
        <SparkleIcon />
        <span>Ask Genie</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="plat-genie-backdrop" onClick={onClose} aria-hidden="true" />

          {/* Drawer */}
          <aside className="plat-genie-drawer" role="complementary" aria-label="Genie assistant">
            {/* Header */}
            <div className="plat-genie-head">
              <div>
                <div className="plat-genie-eyebrow">Databricks Genie</div>
                <h2 className="plat-genie-title">
                  <SparkleIcon />
                  Ask Genie
                </h2>
              </div>
              <div className="plat-genie-head-actions">
                <button
                  className="plat-genie-action-btn"
                  onClick={genie.reset}
                  title="New conversation"
                >
                  New chat
                </button>
                <button
                  className="plat-genie-icon-btn"
                  onClick={onClose}
                  aria-label="Close Genie"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Context strip */}
            <div className="plat-genie-context">
              <span className="plat-genie-context-module">{contextLabel}</span>
              {entityLabel && (
                <span className="plat-genie-context-entity">{entityLabel}</span>
              )}
            </div>

            {/* Messages */}
            <div className="plat-genie-messages" ref={messagesRef}>
              {genie.turns.length === 0 ? (
                <div className="plat-genie-empty-state">
                  <p className="plat-genie-welcome">
                    Ask a question about your data — Genie has access to the gold-layer views for
                    this domain.
                  </p>
                  <div className="plat-genie-starters">
                    {starters.map((s) => (
                      <button
                        key={s}
                        className="plat-genie-starter"
                        onClick={() => useStarter(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                genie.turns.map((turn) => (
                  <div key={turn.id} className={`plat-genie-msg plat-genie-msg--${turn.role}`}>
                    <div className="plat-genie-msg-role">
                      {turn.role === 'user' ? 'You' : 'Genie'}
                    </div>
                    <div className="plat-genie-msg-body">
                      {turn.status === 'IN_PROGRESS' && !turn.content ? (
                        <span className="plat-genie-thinking">Thinking…</span>
                      ) : (
                        turn.content
                      )}
                      {turn.error && (
                        <div className="plat-genie-msg-error">{turn.error}</div>
                      )}
                      {turn.attachments?.map((a, i) => (
                        <div
                          className="plat-genie-attachment"
                          key={a.attachmentId ?? `${turn.id}-${i}`}
                        >
                          {a.text && <p>{a.text}</p>}
                          {a.sql && (
                            <details>
                              <summary>Show SQL</summary>
                              <pre>{a.sql}</pre>
                            </details>
                          )}
                          {a.attachmentId &&
                            turn.results?.[a.attachmentId] && (
                              <ResultTable
                                columns={(turn.results[a.attachmentId] as GenieQueryResult).columns}
                                rows={(turn.results[a.attachmentId] as GenieQueryResult).rows}
                              />
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Global error */}
            {genie.error && (
              <div className="plat-genie-global-error">{genie.error}</div>
            )}

            {/* Input */}
            <div className="plat-genie-input">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about your data… (Enter to send)"
                rows={2}
              />
              <button
                className="plat-genie-send"
                disabled={!prompt.trim() || genie.thinking}
                onClick={submit}
              >
                {genie.thinking ? '…' : '↑'}
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
