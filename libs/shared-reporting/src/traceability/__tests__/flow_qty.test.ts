import { describe, expect, test } from 'vitest'

import { buildLineageGraph } from '../graphTransformers'
import type { AdvancedLineageData, AdvancedLineageNode } from '../types'

const focal = {
  id: 'MAT-A::B1',
  material_id: 'MAT-A',
  material: 'Alpha',
  batch_id: 'B1',
  plant: 'RCN1',
  qty: 100,
  uom: 'KG',
}

function row(overrides: Partial<AdvancedLineageNode> = {}): AdvancedLineageNode {
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

describe('buildLineageGraph honours flow_qty when present', () => {
  test('uses flow_qty for edge weight when the backend supplies it', () => {
    const data: AdvancedLineageData = {
      focal,
      // qty (per-node cumulative) is 200 — flow_qty (per-edge) is the
      // smaller, real edge contribution.  The transform should use
      // flow_qty for the weight ranking, not qty.
      upstream: [
        row({ id: 'U1', qty: 200, flow_qty: 50, level: 1 }),
        row({ id: 'U2', qty: 1000, flow_qty: 800, level: 1 }),
      ],
      downstream: [],
    }
    const { edges } = buildLineageGraph(data)
    const u1 = edges.find((e) => e.source === 'U1')
    const u2 = edges.find((e) => e.source === 'U2')
    // U2's flow_qty (800) >> U1's flow_qty (50) → heavier weight
    expect(u2?.data?.weight).toBeGreaterThan(u1?.data?.weight ?? 0)
    expect(u2?.data?.qty).toBe(800)
    expect(u1?.data?.qty).toBe(50)
  })

  test('falls back to per-node qty when flow_qty is missing', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [row({ id: 'U1', qty: 50, flow_qty: undefined })],
      downstream: [],
    }
    const { edges } = buildLineageGraph(data)
    expect(edges[0].data?.qty).toBe(50)
  })

  test('flow_qty of 0 is treated as a no-flow edge (weight 1)', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [row({ id: 'U1', qty: 0, flow_qty: 0 })],
      downstream: [],
    }
    const { edges } = buildLineageGraph(data)
    expect(edges[0].data?.weight).toBe(1)
  })

  test('non-finite flow_qty is ignored in favour of qty', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [row({ id: 'U1', qty: 75, flow_qty: Number.NaN })],
      downstream: [],
    }
    const { edges } = buildLineageGraph(data)
    expect(edges[0].data?.qty).toBe(75)
  })
})
