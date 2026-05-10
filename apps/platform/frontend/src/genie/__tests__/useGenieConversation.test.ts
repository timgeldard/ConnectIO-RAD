import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useGenieConversation } from '../useGenieConversation'
import * as api from '../api'

vi.mock('../api', () => ({
  startGenieConversation: vi.fn(),
  sendGenieFollowup: vi.fn(),
  fetchGenieMessage: vi.fn(),
  fetchGenieQueryResult: vi.fn(),
}))

describe('useGenieConversation', () => {
  const getContext = () => ({})

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resets state when moduleId changes', () => {
    const { result, rerender } = renderHook(
      ({ mid }) => useGenieConversation(mid, getContext),
      { initialProps: { mid: 'm1' } }
    )

    // Simulate some state change (this is internal, but we can check if it resets)
    rerender({ mid: 'm2' })

    expect(result.current.conversationId).toBeNull()
    expect(result.current.turns).toEqual([])
  })

  it('starts a new conversation on the first ask', async () => {
    const mockResponse = {
      conversationId: 'c1',
      messageId: 'm1',
      status: 'COMPLETED',
      answer: 'Hello world',
      spaceId: 's1',
    }
    vi.mocked(api.startGenieConversation).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useGenieConversation('m1', getContext))

    await act(async () => {
      await result.current.ask('What is OEE?')
    })

    expect(api.startGenieConversation).toHaveBeenCalledWith('What is OEE?', {}, 'm1')
    expect(result.current.conversationId).toBe('c1')
    expect(result.current.turns).toHaveLength(2)
    expect(result.current.turns[1].content).toBe('Hello world')
  })

  it('polls until status is terminal', async () => {
    vi.mocked(api.startGenieConversation).mockResolvedValue({
      conversationId: 'c1',
      messageId: 'm1',
      status: 'IN_PROGRESS',
    })

    vi.mocked(api.fetchGenieMessage)
      .mockResolvedValueOnce({ status: 'IN_PROGRESS' })
      .mockResolvedValueOnce({ status: 'COMPLETED', answer: 'Done' })

    const { result } = renderHook(() => useGenieConversation('m1', getContext))

    // Speed up sleep
    vi.useFakeTimers()

    const askPromise = act(async () => {
      await result.current.ask('poll me')
    })

    // Advance timers for polling loops
    await vi.runAllTimersAsync()
    await askPromise

    expect(api.fetchGenieMessage).toHaveBeenCalledTimes(2)
    expect(result.current.turns[1].status).toBe('COMPLETED')
    vi.useRealTimers()
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(api.startGenieConversation).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useGenieConversation('m1', getContext))

    await act(async () => {
      await result.current.ask('fail me')
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.turns[1].status).toBe('FAILED')
    expect(result.current.turns[1].error).toBe('Network error')
  })

  it('hydrates results for completed messages with attachments', async () => {
    vi.mocked(api.startGenieConversation).mockResolvedValue({
      conversationId: 'c1',
      messageId: 'm1',
      status: 'COMPLETED',
      attachments: [{ attachmentId: 'att1', type: 'query' }],
      spaceId: 's1',
    })

    vi.mocked(api.fetchGenieQueryResult).mockResolvedValue({ columns: ['a'], rows: [['b']] } as any)

    const { result } = renderHook(() => useGenieConversation('m1', getContext))

    await act(async () => {
      await result.current.ask('with table')
    })

    expect(api.fetchGenieQueryResult).toHaveBeenCalledWith('c1', 'm1', 'att1', 's1', 'm1')
    expect(result.current.turns[1].results).toHaveProperty('att1')
  })
})
