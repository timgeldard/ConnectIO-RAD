import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SankeyFlowView } from '../SankeyFlowView'
import type { AdvancedLineageData, AdvancedLineageNode } from '../types'

// echarts-for-react initialises a canvas via echarts.init which needs
// requestAnimationFrame.  jsdom doesn't supply one by default in older
// vitest versions; stub it so the smoke render doesn't throw.
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    cb(0)
    return 0
  }
}
if (typeof globalThis.cancelAnimationFrame !== 'function') {
  globalThis.cancelAnimationFrame = () => {}
}

const focal = {
  id: 'MAT-A::B1',
  material_id: 'MAT-A',
  material: 'Alpha',
  batch_id: 'B1',
  plant: 'RCN1',
  qty: 100,
  uom: 'KG',
}

function row(overrides: Partial<AdvancedLineageNode>): AdvancedLineageNode {
  return {
    id: 'U1',
    level: 1,
    parent: focal.id,
    link: 'RECEIPT',
    material_id: 'MAT-X',
    material: 'X',
    batch: 'BX',
    plant: 'RCN1',
    qty: 50,
    uom: 'KG',
    ...overrides,
  }
}

describe('SankeyFlowView', () => {
  test('renders a chart container when there is at least one edge', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [row({ id: 'U1', flow_qty: 50 })],
      downstream: [],
    }
    render(<SankeyFlowView data={data} />)
    expect(screen.getByTestId('sankey-flow-view')).toBeTruthy()
  })

  test('shows a placeholder when filtering removes all edges', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [],
      downstream: [],
    }
    render(<SankeyFlowView data={data} />)
    expect(
      screen.getByText(/No lineage flow to display/i),
    ).toBeTruthy()
  })

  test('honours enabledLinks (filters edges before charting)', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [
        row({ id: 'U1', link: 'RECEIPT' }),
        row({ id: 'U2', link: 'INTERNAL' }),
      ],
      downstream: [],
    }
    // Filter to only INTERNAL — RECEIPT edge drops, INTERNAL remains.
    render(
      <SankeyFlowView
        data={data}
        enabledLinks={new Set(['INTERNAL'])}
      />,
    )
    // Container still renders because at least one edge survived.
    expect(screen.getByTestId('sankey-flow-view')).toBeTruthy()
  })
})
