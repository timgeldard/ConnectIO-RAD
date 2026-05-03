import { fetchJson, postJson } from './client'

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

export async function startGenieConversation(prompt: string, pageContext: GeniePageContext): Promise<GenieMessageResponse> {
  return postJson<GenieMessageResponse>('/api/genie/start', { prompt, pageContext })
}

export async function sendGenieFollowup(
  conversationId: string,
  prompt: string,
  pageContext: GeniePageContext,
): Promise<GenieMessageResponse> {
  return postJson<GenieMessageResponse>('/api/genie/followup', { conversationId, prompt, pageContext })
}

export async function fetchGenieMessage(conversationId: string, messageId: string): Promise<GenieMessageResponse> {
  const params = new URLSearchParams({ conversationId, messageId })
  return fetchJson<GenieMessageResponse>(`/api/genie/message?${params.toString()}`, { credentials: 'include' })
}

export async function fetchGenieQueryResult(
  conversationId: string,
  messageId: string,
  attachmentId: string,
): Promise<GenieQueryResult> {
  const params = new URLSearchParams({ conversationId, messageId, attachmentId })
  return fetchJson<GenieQueryResult>(`/api/genie/query-result?${params.toString()}`, { credentials: 'include' })
}
