import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { GenieDrawer } from '../GenieDrawer'
import type { GeniePageContext } from '../api'

// shared-frontend-api's `postJson` is the underlying transport for the
// Genie API calls.  We stub it module-wide so the drawer never actually
// fires network requests in the smoke test.  Each test that exercises a
// flow re-asserts what it expects to be called with.
vi.mock('@connectio/shared-frontend-api', () => ({
  ApiError: class ApiError extends Error {},
  fetchJson: vi.fn(),
  postJson: vi.fn().mockResolvedValue({
    conversationId: 'conv-1',
    messageId: 'msg-1',
    status: 'COMPLETED',
    answer: 'stubbed answer',
    attachments: [],
  }),
}))

const lineageCtx: GeniePageContext = {
  mode: 'lineage',
  view: 'bottom-up',
  focal: { material_id: 'MAT-A', material: 'Alpha', batch_id: 'B1', plant: 'RCN1' },
  selected: null,
}

describe('GenieDrawer (smoke)', () => {
  test('renders the floating trigger button by default', () => {
    render(
      <GenieDrawer open={false} onOpen={() => {}} onClose={() => {}} pageContext={lineageCtx} />,
    )
    expect(screen.getByTestId('trace2-genie-trigger')).toBeTruthy()
    // Drawer body is not present when closed
    expect(screen.queryByTestId('trace2-genie-drawer')).toBeNull()
  })

  test('renders the drawer body when open with focal identity in the context badge', () => {
    render(
      <GenieDrawer open={true} onOpen={() => {}} onClose={() => {}} pageContext={lineageCtx} />,
    )
    expect(screen.getByTestId('trace2-genie-drawer')).toBeTruthy()
    const badge = screen.getByTestId('trace2-genie-context')
    expect(badge.textContent).toContain('MAT-A')
    expect(badge.textContent).toContain('B1')
  })

  test('clicking the trigger when closed calls onOpen', async () => {
    const onOpen = vi.fn()
    render(
      <GenieDrawer open={false} onOpen={onOpen} onClose={() => {}} pageContext={lineageCtx} />,
    )
    await userEvent.click(screen.getByTestId('trace2-genie-trigger'))
    expect(onOpen).toHaveBeenCalled()
  })

  test('clicking the backdrop when open calls onClose', async () => {
    const onClose = vi.fn()
    render(
      <GenieDrawer open={true} onOpen={() => {}} onClose={onClose} pageContext={lineageCtx} />,
    )
    await userEvent.click(screen.getByTestId('trace2-genie-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  test('Send button is disabled until the textarea has content', () => {
    render(
      <GenieDrawer open={true} onOpen={() => {}} onClose={() => {}} pageContext={lineageCtx} />,
    )
    const send = screen.getByTestId('trace2-genie-send') as HTMLButtonElement
    expect(send.disabled).toBe(true)
  })

  test('badge mode label switches to "Transfer" when given a lineage_transfer context', () => {
    const transferCtx: GeniePageContext = {
      ...lineageCtx,
      mode: 'lineage_transfer',
      selected: {
        material_id: 'MAT-X',
        material: 'Aroma',
        batch_id: 'BX',
        plant: 'RCN1',
        link: 'RECEIPT',
        side: 'upstream',
        flow_qty: 150,
        qty: 200,
        uom: 'KG',
      },
    }
    render(
      <GenieDrawer
        open={true}
        onOpen={() => {}}
        onClose={() => {}}
        pageContext={transferCtx}
      />,
    )
    const badge = screen.getByTestId('trace2-genie-context')
    expect(badge.textContent).toContain('Transfer')
    // Cross-batch label shows focal → selected
    expect(badge.textContent).toContain('MAT-A')
    expect(badge.textContent).toContain('MAT-X')
  })

  test('initialPrompt prefills the textarea when the drawer opens', () => {
    render(
      <GenieDrawer
        open={true}
        onOpen={() => {}}
        onClose={() => {}}
        pageContext={lineageCtx}
        initialPrompt="Explain this transfer."
      />,
    )
    const textarea = screen.getByTestId('trace2-genie-input') as HTMLTextAreaElement
    expect(textarea.value).toBe('Explain this transfer.')
  })
})
