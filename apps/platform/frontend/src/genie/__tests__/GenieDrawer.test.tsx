/* eslint-disable jsdoc/require-jsdoc */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GenieDrawer } from '../GenieDrawer'
import { useGenieConversation } from '../useGenieConversation'

// Mock the hook
vi.mock('../useGenieConversation', () => ({
  useGenieConversation: vi.fn(),
}))

describe('GenieDrawer', () => {
  const defaultProps = {
    open: true,
    onOpen: vi.fn(),
    onClose: vi.fn(),
    moduleId: 'spc',
    pageContext: {},
  }

  const mockGenie = {
    conversationId: null,
    turns: [],
    thinking: false,
    error: null,
    ask: vi.fn(),
    reset: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useGenieConversation).mockReturnValue(mockGenie as any)
  })

  it('renders trigger button and drawer when open', () => {
    render(<GenieDrawer {...defaultProps} />)
    
    expect(screen.getByText('Ask Genie', { selector: 'button span' })).toBeDefined()
    expect(screen.getByRole('complementary', { name: 'Genie assistant' })).toBeDefined()
  })

  it('shows welcome message and starters when conversation is empty', () => {
    render(<GenieDrawer {...defaultProps} />)
    
    expect(screen.getByText(/Ask a question about your data/)).toBeDefined()
    // For SPC (quality), it should show quality starters
    expect(screen.getByText('Which MICs have Cpk below 1.33?')).toBeDefined()
  })

  it('calls ask when a starter is clicked', () => {
    render(<GenieDrawer {...defaultProps} />)
    
    const starter = screen.getByText('Which MICs have Cpk below 1.33?')
    fireEvent.click(starter)
    
    expect(mockGenie.ask).toHaveBeenCalledWith('Which MICs have Cpk below 1.33?')
  })

  it('renders conversation turns', () => {
    const turnsWithData = [
      { id: 'u1', role: 'user', content: 'hello' },
      { id: 'a1', role: 'assistant', content: 'world', status: 'COMPLETED' },
    ]
    vi.mocked(useGenieConversation).mockReturnValue({
      ...mockGenie,
      turns: turnsWithData,
    } as any)

    render(<GenieDrawer {...defaultProps} />)
    
    expect(screen.getByText('You')).toBeDefined()
    expect(screen.getByText('hello')).toBeDefined()
    expect(screen.getByText('Genie')).toBeDefined()
    expect(screen.getByText('world')).toBeDefined()
  })

  it('handles user input and submission', () => {
    render(<GenieDrawer {...defaultProps} />)
    
    const textarea = screen.getByPlaceholderText(/Ask about your data/)
    fireEvent.change(textarea, { target: { value: 'custom prompt' } })
    
    const sendButton = screen.getByText('↑')
    fireEvent.click(sendButton)
    
    expect(mockGenie.ask).toHaveBeenCalledWith('custom prompt')
    expect((textarea as HTMLTextAreaElement).value).toBe('')
  })

  it('shows thinking state when assistant is processing', () => {
    vi.mocked(useGenieConversation).mockReturnValue({
      ...mockGenie,
      turns: [{ id: 'a1', role: 'assistant', content: '', status: 'IN_PROGRESS' }],
      thinking: true,
    } as any)

    render(<GenieDrawer {...defaultProps} />)
    
    expect(screen.getByText('Thinking…')).toBeDefined()
    expect(screen.getByText('…')).toBeDefined() // Send button text
  })

  it('renders result table for query attachments', () => {
    const turnsWithTable = [
      {
        id: 'a1',
        role: 'assistant',
        content: 'Here is data',
        status: 'COMPLETED',
        attachments: [{ attachmentId: 'att1', type: 'query' }],
        results: {
          att1: {
            columns: ['plant', 'score'],
            rows: [{ plant: 'C351', score: 0.9 }],
          },
        },
      },
    ]
    vi.mocked(useGenieConversation).mockReturnValue({
      ...mockGenie,
      turns: turnsWithTable,
    } as any)

    render(<GenieDrawer {...defaultProps} />)
    
    expect(screen.getByRole('table')).toBeDefined()
    expect(screen.getByText('plant')).toBeDefined()
    expect(screen.getByText('C351')).toBeDefined()
  })
})
