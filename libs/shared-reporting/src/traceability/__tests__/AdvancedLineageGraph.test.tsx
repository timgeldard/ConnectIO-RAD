import { describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { AdvancedLineageGraph } from '../AdvancedLineageGraph'
import type {
  AdvancedLineageData,
  AdvancedLineageFocal,
  AdvancedLineageNode,
} from '../types'

// React Flow needs ResizeObserver in jsdom; vi stub satisfies the constructor.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
  ResizeObserverMock as unknown as typeof ResizeObserver

// jsdom's HTMLElement does not implement DOMMatrix, which React Flow uses for
// its viewport transform.  A no-op stub is enough — we are only checking
// that the component mounts and emits its container element.
if (!('DOMMatrix' in globalThis)) {
  ;(globalThis as { DOMMatrix?: unknown }).DOMMatrix = class {
    a = 1
    b = 0
    c = 0
    d = 1
    e = 0
    f = 0
    multiply() {
      return this
    }
  }
}

const focal: AdvancedLineageFocal = {
  id: 'MAT-A::B1',
  material_id: 'MAT-A',
  material: 'Alpha',
  batch_id: 'B1',
  plant: 'RCN1',
  qty: 100,
  uom: 'KG',
}

const upstream: AdvancedLineageNode[] = [
  {
    id: 'U1',
    level: 1,
    parent: focal.id,
    link: 'RECEIPT',
    material_id: 'MAT-X',
    material: 'X',
    batch: 'B-X',
    plant: 'RCN1',
    qty: 50,
    uom: 'KG',
  },
]

const data: AdvancedLineageData = { focal, upstream, downstream: [] }

describe('AdvancedLineageGraph (smoke)', () => {
  test('mounts and renders a React Flow container', () => {
    render(<AdvancedLineageGraph data={data} />)
    expect(screen.getByTestId('advanced-lineage-graph')).toBeTruthy()
  })

  test('shows the "Laying out…" hint until ELK resolves', () => {
    render(<AdvancedLineageGraph data={data} />)
    // ELK runs asynchronously; the hint should appear synchronously on mount.
    expect(screen.getByText(/Laying out graph/i)).toBeTruthy()
  })

  test('does not invoke onNodeClick on initial render', () => {
    const cb = vi.fn()
    render(<AdvancedLineageGraph data={data} onNodeClick={cb} />)
    expect(cb).not.toHaveBeenCalled()
  })

  test('renders without crashing when both upstream and downstream are empty', async () => {
    render(<AdvancedLineageGraph data={{ focal, upstream: [], downstream: [] }} />)
    await waitFor(() => {
      expect(screen.getByTestId('advanced-lineage-graph')).toBeTruthy()
    })
  })
})
