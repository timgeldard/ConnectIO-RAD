/**
 * Genie Conversation API client for the platform app.
 *
 * Implements the multi-space contract: every request carries moduleId so the
 * backend can route to the correct Genie space, and spaceId is threaded on
 * follow-up / polling calls to pin the conversation to its origin space.
 */

export interface PlatformGenieContext {
  selected_process_order?: string | null
  selected_material?: string | null
  selected_plant?: string | null
  selected_batch?: string | null
  active_date_range?: string | null
  active_filters?: string | null
  selected_row_count?: number | null
}

export interface GenieAttachment {
  attachmentId: string | null
  text: string | null
  sql: string | null
  type?: string | null
}

export interface GenieMessageResponse {
  conversationId: string | null
  messageId: string | null
  /** Space ID returned by /genie/start — must be stored and resent on all follow-ups. */
  spaceId?: string
  status: string | null
  error?: unknown
  answer: string
  attachments: GenieAttachment[]
}

export interface GenieQueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  raw: unknown
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Genie API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Genie API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

/** Start a new Genie conversation routed to the correct space for moduleId. */
export function startGenieConversation(
  prompt: string,
  pageContext: PlatformGenieContext,
  moduleId: string,
): Promise<GenieMessageResponse> {
  return postJson<GenieMessageResponse>('/api/genie/start', { prompt, pageContext, moduleId })
}

/** Send a follow-up message, pinning the conversation to its origin spaceId. */
export function sendGenieFollowup(
  conversationId: string,
  spaceId: string,
  prompt: string,
  pageContext: PlatformGenieContext,
  moduleId: string,
): Promise<GenieMessageResponse> {
  return postJson<GenieMessageResponse>('/api/genie/followup', {
    conversationId,
    spaceId,
    prompt,
    pageContext,
    moduleId,
  })
}

/** Poll a Genie message for its completion status. */
export function fetchGenieMessage(
  conversationId: string,
  messageId: string,
  spaceId: string,
  moduleId: string,
): Promise<GenieMessageResponse> {
  const params = new URLSearchParams({ conversationId, messageId, spaceId, moduleId })
  return getJson<GenieMessageResponse>(`/api/genie/message?${params}`)
}

/** Fetch structured query results for a Genie attachment. */
export function fetchGenieQueryResult(
  conversationId: string,
  messageId: string,
  attachmentId: string,
  spaceId: string,
  moduleId: string,
): Promise<GenieQueryResult> {
  const params = new URLSearchParams({ conversationId, messageId, attachmentId, spaceId, moduleId })
  return getJson<GenieQueryResult>(`/api/genie/query-result?${params}`)
}
