/* eslint-disable jsdoc/require-jsdoc */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  startGenieConversation,
  sendGenieFollowup,
  fetchGenieMessage,
  fetchGenieQueryResult
} from '../genie/api'

describe('Genie API', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('startGenieConversation calls POST /api/genie/start', async () => {
    const mockRes = { conversationId: 'c1', messageId: 'm1', status: 'OK' }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRes)
    } as Response)

    const res = await startGenieConversation('hello', { selected_plant: 'P1' }, 'spc')

    expect(fetch).toHaveBeenCalledWith('/api/genie/start', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ prompt: 'hello', pageContext: { selected_plant: 'P1' }, moduleId: 'spc' })
    }))
    expect(res).toEqual(mockRes)
  })

  it('sendGenieFollowup calls POST /api/genie/followup', async () => {
    const mockRes = { conversationId: 'c1', messageId: 'm2', status: 'OK' }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRes)
    } as Response)

    const res = await sendGenieFollowup('c1', 's1', 'next', {}, 'spc')

    expect(fetch).toHaveBeenCalledWith('/api/genie/followup', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ conversationId: 'c1', spaceId: 's1', prompt: 'next', pageContext: {}, moduleId: 'spc' })
    }))
    expect(res).toEqual(mockRes)
  })

  it('fetchGenieMessage calls GET /api/genie/message', async () => {
    const mockRes = { status: 'COMPLETED' }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRes)
    } as Response)

    const res = await fetchGenieMessage('c1', 'm1', 's1', 'spc')

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/genie/message?'), expect.anything())
    expect(res).toEqual(mockRes)
  })

  it('fetchGenieQueryResult calls GET /api/genie/query-result', async () => {
    const mockRes = { columns: [], rows: [] }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRes)
    } as Response)

    const res = await fetchGenieQueryResult('c1', 'm1', 'a1', 's1', 'spc')

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/genie/query-result?'), expect.anything())
    expect(res).toEqual(mockRes)
  })

  it('throws error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Error',
      text: () => Promise.resolve('boom')
    } as Response)

    await expect(startGenieConversation('h', {}, 'm')).rejects.toThrow('Genie API 500: boom')
  })
})
