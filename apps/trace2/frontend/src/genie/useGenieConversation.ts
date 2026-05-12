/**
 * trace2 Genie conversation hook.
 *
 * Behaviour mirrors POH's `useGenieConversation` — start / followup
 * pattern, polling with exponential backoff up to 24 attempts, optional
 * tabular result hydration when an attachment carries an
 * `attachmentId`.  The `getPageContext` callback is queried lazily on
 * every `ask()` so a stale focal-batch value never reaches the prompt.
 *
 * Why duplicate from POH instead of factoring out: same reason as the
 * backend — POH and trace2 each have their own Genie Space and own the
 * page-context schema.  A shared hook with a generic context-type
 * generic would expose an API surface that only two consumers use
 * today; the duplication is acceptable while we're at two apps and
 * tracked in the Phase 3b commit message for consolidation later.
 */
import { useCallback, useMemo, useRef, useState } from 'react'

import {
  fetchGenieMessage,
  fetchGenieQueryResult,
  sendGenieFollowup,
  startGenieConversation,
  type GenieAttachment,
  type GeniePageContext,
  type GenieQueryResult,
} from './api'

/** A single turn in the assistant transcript. */
export interface GenieTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  status?: string | null
  attachments?: GenieAttachment[]
  results?: Record<string, GenieQueryResult>
  error?: string | null
}

const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED'])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * React hook that owns a trace2 Genie conversation.
 *
 * @param getPageContext Callback returning the current page context.
 *   Called lazily on each `ask()` so the latest focal-batch / selected
 *   node makes it into the prompt even if the user navigates between
 *   sending and the next turn.
 * @returns The conversation state and the `ask()` / `reset()`
 *   imperative handles.
 */
export function useGenieConversation(getPageContext: () => GeniePageContext) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [turns, setTurns] = useState<GenieTurn[]>([])
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Per-ask runId guards against late responses overwriting a newer
  // turn — the assistant turn placeholder is only updated if the
  // current run matches the one that fired the request.
  const activeRun = useRef(0)

  const reset = useCallback(() => {
    activeRun.current += 1
    setConversationId(null)
    setTurns([])
    setThinking(false)
    setError(null)
  }, [])

  const hydrateResults = useCallback(
    async (
      cid: string,
      messageId: string,
      attachments: GenieAttachment[],
    ): Promise<Record<string, GenieQueryResult>> => {
      const entries = await Promise.all(
        attachments
          .filter((a) => a.attachmentId)
          .map(async (a) => {
            const result = await fetchGenieQueryResult(cid, messageId, a.attachmentId as string)
            return [a.attachmentId as string, result] as const
          }),
      )
      return Object.fromEntries(entries)
    },
    [],
  )

  const ask = useCallback(
    async (prompt: string) => {
      const text = prompt.trim()
      if (!text) return

      const runId = ++activeRun.current
      const userTurn: GenieTurn = { id: `u-${Date.now()}`, role: 'user', content: text }
      const assistantId = `a-${Date.now()}`
      setTurns((prev) => [
        ...prev,
        userTurn,
        { id: assistantId, role: 'assistant', content: '', status: 'IN_PROGRESS' },
      ])
      setThinking(true)
      setError(null)

      try {
        const context = getPageContext()
        const initial = conversationId
          ? await sendGenieFollowup(conversationId, text, context)
          : await startGenieConversation(text, context)

        const cid = initial.conversationId
        const mid = initial.messageId
        if (!cid || !mid) {
          throw new Error('Genie did not return conversation/message identifiers.')
        }

        if (activeRun.current !== runId) return
        setConversationId(cid)

        let message = initial
        let delay = 900
        // Exponential-ish backoff up to ~3.5s per poll, 24 polls cap.
        // Genie typically completes within 4-8 polls; the high cap is
        // a safety net for long-running SQL on big plants.
        for (let i = 0; i < 24 && !TERMINAL.has(String(message.status)); i += 1) {
          await sleep(delay)
          if (activeRun.current !== runId) return
          message = await fetchGenieMessage(cid, mid)
          delay = Math.min(Math.round(delay * 1.25), 3500)
        }

        if (activeRun.current !== runId) return
        if (!TERMINAL.has(String(message.status))) {
          message.status = 'FAILED'
          message.error = 'Conversation timed out while waiting for a response.'
        }

        const attachments = message.attachments ?? []
        const results =
          String(message.status) === 'COMPLETED'
            ? await hydrateResults(cid, mid, attachments).catch(() => ({}))
            : {}
        const failure = message.error ? JSON.stringify(message.error) : null

        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantId
              ? {
                  ...t,
                  content:
                    message.answer ||
                    (failure
                      ? 'Genie could not complete this request.'
                      : 'No text response returned.'),
                  status: message.status,
                  attachments,
                  results,
                  error: failure,
                }
              : t,
          ),
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantId
              ? { ...t, content: 'Genie is unavailable for this request.', status: 'FAILED', error: msg }
              : t,
          ),
        )
      } finally {
        if (activeRun.current === runId) setThinking(false)
      }
    },
    [conversationId, getPageContext, hydrateResults],
  )

  return useMemo(
    () => ({
      conversationId,
      turns,
      thinking,
      error,
      ask,
      reset,
    }),
    [conversationId, turns, thinking, error, ask, reset],
  )
}
