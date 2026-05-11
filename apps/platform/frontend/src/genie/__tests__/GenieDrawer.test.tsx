/* eslint-disable jsdoc/require-jsdoc */
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('shows different starters for different modules', () => {
    const { rerender } = render(<GenieDrawer {...defaultProps} moduleId="trace" />)
    expect(screen.getByText('Forward trace for the current batch')).toBeDefined()

    rerender(<GenieDrawer {...defaultProps} moduleId="imwm" />)
    expect(screen.getByText('IM/WM mismatches today')).toBeDefined()

    rerender(<GenieDrawer {...defaultProps} moduleId="home" />)
    expect(screen.getByText('What data is available across ConnectIO?')).toBeDefined()
    
    rerender(<GenieDrawer {...defaultProps} moduleId="poh" />)
    expect(screen.getByText('Show open process orders today')).toBeDefined()
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

  it('submits on Enter key', () => {
    render(<GenieDrawer {...defaultProps} />)
    const textarea = screen.getByPlaceholderText(/Ask about your data/)
    fireEvent.change(textarea, { target: { value: 'enter prompt' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(mockGenie.ask).toHaveBeenCalledWith('enter prompt')
  })

  it('does not submit on Shift+Enter', () => {
    render(<GenieDrawer {...defaultProps} />)
    const textarea = screen.getByPlaceholderText(/Ask about your data/)
    fireEvent.change(textarea, { target: { value: 'shift enter' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(mockGenie.ask).not.toHaveBeenCalled()
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
        attachments: [
          { attachmentId: 'att1', type: 'query', text: 'Attached text', sql: 'SELECT 1' }
        ],
        results: {
          att1: {
            columns: ['plant', 'score'],
            rows: Array(25).fill({ plant: 'C351', score: 0.9 }),
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
    expect(screen.getAllByText('C351').length).toBeGreaterThan(0)
    expect(screen.getByText('Attached text')).toBeDefined()
    expect(screen.getByText('SELECT 1')).toBeDefined()
    expect(screen.getByText(/5 more rows not shown/)).toBeDefined()
  })

  it('shows global and turn errors', () => {
    vi.mocked(useGenieConversation).mockReturnValue({
      ...mockGenie,
      error: 'Global crash',
      turns: [{ id: 'u1', role: 'user', content: 'h', error: 'Turn fail' }]
    } as any)

    render(<GenieDrawer {...defaultProps} />)
    expect(screen.getByText('Global crash')).toBeDefined()
    expect(screen.getByText('Turn fail')).toBeDefined()
  })

  it('resets conversation', () => {
    render(<GenieDrawer {...defaultProps} />)
    fireEvent.click(screen.getByText('New chat'))
    expect(mockGenie.reset).toHaveBeenCalled()
  })

  it('closes drawer', () => {
    render(<GenieDrawer {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Close Genie'))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })
})
