/**
 * Frontend API client for the trace2 Genie endpoints.
 *
 * Path shape mirrors POH's pattern: hit `/api/genie/...`, let
 * `resolveTraceApiPath()` rewrite it to whichever base matches the
 * deployment context (standalone trace2 → `/api/t2/genie/...`; platform
 * shell → `/api/genie/...`).  The wire shape (camelCase, attachments,
 * conversation/message IDs) is identical to POH's Genie response —
 * both proxies are thin wrappers over the same Databricks Genie API.
 */
import { ApiError, fetchJson as baseFetch, postJson as basePost } from '@connectio/shared-frontend-api'

import { resolveTraceApiPath } from '../data/apiBase'

export { ApiError }

const fetchJson = <T>(path: string, init?: RequestInit) =>
  baseFetch<T>(resolveTraceApiPath(path), init)

const postJson = <T>(path: string, body: unknown, init?: RequestInit) =>
  basePost<T>(resolveTraceApiPath(path), body, init)

/**
 * The Genie page-context block sent alongside every prompt.
 *
 * Trace2-specific: `mode` distinguishes a general lineage view from a
 * specific transfer the user right-clicked.  `focal` is always
 * populated; `selected` is only set in transfer mode.
 */
export interface GeniePageContext {
  mode: 'lineage' | 'lineage_transfer'
  /** Which trace2 page the user is currently viewing. */
  view?: 'bottom-up' | 'top-down' | 'overview' | string | null
  focal: {
    material_id: string
    material: string
    batch_id: string
    plant: string
  }
  selected?: {
    material_id: string
    material: string
    batch_id: string
    plant: string
    link: string
    side: 'upstream' | 'downstream'
    flow_qty?: number | null
    qty?: number | null
    uom?: string | null
  } | null
}

/** A single Genie response attachment. */
export interface GenieAttachment {
  attachmentId: string | null
  text: string | null
  sql: string | null
  type?: string | null
}

/** Normalised Genie message response from the trace2 backend. */
export interface GenieMessageResponse {
  conversationId: string | null
  messageId: string | null
  status: string | null
  error?: unknown
  answer: string
  attachments: GenieAttachment[]
}

/** Tabular query result attached to a Genie message. */
export interface GenieQueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  raw: unknown
}

/** Start a new Genie conversation. */
export async function startGenieConversation(
  prompt: string,
  pageContext: GeniePageContext,
): Promise<GenieMessageResponse> {
  return postJson<GenieMessageResponse>('/api/genie/start', { prompt, pageContext })
}

/** Post a follow-up prompt to an existing Genie conversation. */
export async function sendGenieFollowup(
  conversationId: string,
  prompt: string,
  pageContext: GeniePageContext,
): Promise<GenieMessageResponse> {
  return postJson<GenieMessageResponse>('/api/genie/followup', {
    conversationId,
    prompt,
    pageContext,
  })
}

/** Poll for the latest status of a Genie message. */
export async function fetchGenieMessage(
  conversationId: string,
  messageId: string,
): Promise<GenieMessageResponse> {
  const params = new URLSearchParams({ conversationId, messageId })
  return fetchJson<GenieMessageResponse>(`/api/genie/message?${params.toString()}`, {
    credentials: 'include',
  })
}

/** Hydrate the tabular query result attached to a Genie message. */
export async function fetchGenieQueryResult(
  conversationId: string,
  messageId: string,
  attachmentId: string,
): Promise<GenieQueryResult> {
  const params = new URLSearchParams({ conversationId, messageId, attachmentId })
  return fetchJson<GenieQueryResult>(`/api/genie/query-result?${params.toString()}`, {
    credentials: 'include',
  })
}
