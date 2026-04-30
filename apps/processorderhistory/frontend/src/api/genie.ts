export interface GeniePageContext {
  mode: 'process_order' | 'filtered_result_set' | 'global'
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

async function parseOrThrow(res: Response, label: string) {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${label} failed (${res.status}): ${text}`)
  }
  return res.json()
}

export async function startGenieConversation(prompt: string, pageContext: GeniePageContext): Promise<GenieMessageResponse> {
  const res = await fetch('/api/genie/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ prompt, pageContext }),
  })
  return parseOrThrow(res, 'Genie start')
}

export async function sendGenieFollowup(
  conversationId: string,
  prompt: string,
  pageContext: GeniePageContext,
): Promise<GenieMessageResponse> {
  const res = await fetch('/api/genie/followup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ conversationId, prompt, pageContext }),
  })
  return parseOrThrow(res, 'Genie follow-up')
}

export async function fetchGenieMessage(conversationId: string, messageId: string): Promise<GenieMessageResponse> {
  const params = new URLSearchParams({ conversationId, messageId })
  const res = await fetch(`/api/genie/message?${params.toString()}`, { credentials: 'include' })
  return parseOrThrow(res, 'Genie message')
}

export async function fetchGenieQueryResult(
  conversationId: string,
  messageId: string,
  attachmentId: string,
): Promise<GenieQueryResult> {
  const params = new URLSearchParams({ conversationId, messageId, attachmentId })
  const res = await fetch(`/api/genie/query-result?${params.toString()}`, { credentials: 'include' })
  return parseOrThrow(res, 'Genie query result')
}
