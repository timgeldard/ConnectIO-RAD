import { describe, expect, test } from 'vitest'

import { buildLineageGraph, countNodesBySide } from '../graphTransformers'
import { FOCAL_NODE_ID } from '../types'
import type {
  AdvancedLineageData,
  AdvancedLineageFocal,
  AdvancedLineageNode,
} from '../types'

const focal: AdvancedLineageFocal = {
  id: 'MAT-A::BATCH-1',
  material_id: 'MAT-A',
  material: 'Alpha Powder',
  batch_id: 'BATCH-1',
  plant: 'RCN1',
  qty: 1000,
  uom: 'KG',
}

function up(
  id: string,
  level: number,
  parent: string,
  link: AdvancedLineageNode['link'] = 'RECEIPT',
): AdvancedLineageNode {
  return {
    id,
    level,
    parent,
    link,
    material_id: 'MAT-X',
    material: `Mat ${id}`,
    batch: id,
    plant: 'RCN1',
    qty: 100,
    uom: 'KG',
  }
}

describe('buildLineageGraph', () => {
  test('emits the focal node at FOCAL_NODE_ID with stable position', () => {
    const { nodes } = buildLineageGraph({ focal, upstream: [], downstream: [] })
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe(FOCAL_NODE_ID)
    expect(nodes[0].position).toEqual({ x: 0, y: 0 })
  })

  test('rewrites a parent reference to the focal id', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [up('U1', 1, focal.id)],
      downstream: [],
    }
    const { nodes, edges } = buildLineageGraph(data)
    expect(new Set(nodes.map((n) => n.id))).toEqual(new Set([FOCAL_NODE_ID, 'U1']))
    // Upstream edge flows from the parent (further from focal) TOWARD the focal.
    expect(edges).toHaveLength(1)
    expect(edges[0].source).toBe('U1')
    expect(edges[0].target).toBe(FOCAL_NODE_ID)
    expect(edges[0].data?.direction).toBe('upstream')
  })

  test('downstream edges flow away from the focal', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [],
      downstream: [up('D1', 1, focal.id, 'SALES_ORDER')],
    }
    const { edges } = buildLineageGraph(data)
    expect(edges).toHaveLength(1)
    expect(edges[0].source).toBe(FOCAL_NODE_ID)
    expect(edges[0].target).toBe('D1')
    expect(edges[0].data?.direction).toBe('downstream')
  })

  test('drops self-transfers (rows whose id equals the focal id)', () => {
    const selfish = { ...up('self', 1, focal.id), id: focal.id }
    const data: AdvancedLineageData = {
      focal,
      upstream: [selfish],
      downstream: [],
    }
    const { nodes, edges } = buildLineageGraph(data)
    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })

  test('deduplicates nodes when the recursive CTE reaches them via two paths', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [
        up('U1', 1, focal.id),
        up('U2', 2, 'U1'),
        up('U2', 2, 'U1'), // duplicate
      ],
      downstream: [],
    }
    const { nodes } = buildLineageGraph(data)
    const u2 = nodes.filter((n) => n.id === 'U2')
    expect(u2).toHaveLength(1)
  })

  test('applies upstream depth cap and drops the now-orphaned edge', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [up('U1', 1, focal.id), up('U2', 2, 'U1')],
      downstream: [],
    }
    const { nodes, edges } = buildLineageGraph(data, { maxUpstreamLevel: 1 })
    expect(new Set(nodes.map((n) => n.id))).toEqual(new Set([FOCAL_NODE_ID, 'U1']))
    // Edge from U2 to U1 was dropped because U2 itself is gone.
    expect(edges).toHaveLength(1)
    expect(edges[0].source).toBe('U1')
  })

  test('respects direction="upstream"', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [up('U1', 1, focal.id)],
      downstream: [up('D1', 1, focal.id, 'SALES_ORDER')],
    }
    const { nodes } = buildLineageGraph(data, { direction: 'upstream' })
    expect(new Set(nodes.map((n) => n.id))).toEqual(new Set([FOCAL_NODE_ID, 'U1']))
  })

  test('encodes link type in the edge id so the same source/target with different links coexist', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [
        up('U1', 1, focal.id, 'RECEIPT'),
        up('U1', 1, focal.id, 'INTERNAL'),
      ],
      downstream: [],
    }
    // The dedup is by node id, so U1 is one node — but two edges with
    // different link types are *not* duplicates and should both survive.
    const { edges } = buildLineageGraph(data)
    expect(edges.map((e) => e.id).sort()).toEqual([
      `U1->${FOCAL_NODE_ID}::INTERNAL`,
      `U1->${FOCAL_NODE_ID}::RECEIPT`,
    ])
  })
})

describe('countNodesBySide', () => {
  test('counts unique non-focal node ids per side', () => {
    const counts = countNodesBySide({
      focal,
      upstream: [up('U1', 1, focal.id), up('U1', 1, focal.id), up('U2', 2, 'U1')],
      downstream: [up('D1', 1, focal.id, 'SALES_ORDER')],
    })
    expect(counts).toEqual({ upstream: 2, downstream: 1 })
  })
})
