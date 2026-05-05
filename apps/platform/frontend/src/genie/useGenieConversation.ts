/**
 * State machine for a multi-turn Genie conversation in the platform app.
 *
 * Key behaviours vs the POH equivalent:
 * - Accepts `moduleId` and resets automatically when it changes (cross-space
 *   follow-ups would 404, so we start fresh on every module switch).
 * - Stores `spaceId` from the start response in a ref and threads it on all
 *   subsequent polling and follow-up calls so the backend routes correctly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchGenieMessage,
  fetchGenieQueryResult,
  sendGenieFollowup,
  startGenieConversation,
  type GenieAttachment,
  type GenieMessageResponse,
  type GenieQueryResult,
  type PlatformGenieContext,
} from './api'

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
 * Manages conversation state, polling, result hydration, and module-switch resets.
 *
 * @param moduleId - Active platform module. Changing this resets the conversation.
 * @param getPageContext - Stable getter for the current page context snapshot.
 */
export function useGenieConversation(
  moduleId: string,
  getPageContext: () => PlatformGenieContext,
) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [turns, setTurns] = useState<GenieTurn[]>([])
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeRun = useRef(0)
  const spaceIdRef = useRef('')

  const reset = useCallback(() => {
    activeRun.current += 1
    setConversationId(null)
    setTurns([])
    setThinking(false)
    setError(null)
    spaceIdRef.current = ''
  }, [])

  useEffect(() => {
    reset()
  }, [moduleId, reset])

  const hydrateResults = useCallback(
    async (cid: string, messageId: string, attachments: GenieAttachment[]) => {
      const entries = await Promise.all(
        attachments
          .filter((a) => a.attachmentId)
          .map(async (a) => {
            const result = await fetchGenieQueryResult(
              cid,
              messageId,
              a.attachmentId as string,
              spaceIdRef.current,
              moduleId,
            )
            return [a.attachmentId as string, result] as const
          }),
      )
      return Object.fromEntries(entries)
    },
    [moduleId],
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
        let initial: GenieMessageResponse

        if (conversationId && spaceIdRef.current) {
          initial = await sendGenieFollowup(
            conversationId,
            spaceIdRef.current,
            text,
            context,
            moduleId,
          )
        } else {
          initial = await startGenieConversation(text, context, moduleId)
          if (initial.spaceId) spaceIdRef.current = initial.spaceId
        }

        const cid = initial.conversationId
        const mid = initial.messageId
        if (!cid || !mid) throw new Error('Genie did not return conversation/message identifiers.')
        setConversationId(cid)

        let message = initial
        let delay = 900
        for (let i = 0; i < 24 && !TERMINAL.has(String(message.status)); i += 1) {
          await sleep(delay)
          if (activeRun.current !== runId) return
          message = await fetchGenieMessage(cid, mid, spaceIdRef.current, moduleId)
          delay = Math.min(Math.round(delay * 1.25), 3500)
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
              ? {
                  ...t,
                  content: 'Genie is unavailable for this request.',
                  status: 'FAILED',
                  error: msg,
                }
              : t,
          ),
        )
      } finally {
        if (activeRun.current === runId) setThinking(false)
      }
    },
    [conversationId, moduleId, getPageContext, hydrateResults],
  )

  return useMemo(
    () => ({ conversationId, turns, thinking, error, ask, reset }),
    [conversationId, turns, thinking, error, ask, reset],
  )
}
