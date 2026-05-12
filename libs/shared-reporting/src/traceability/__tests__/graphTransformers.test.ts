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

describe('buildLineageGraph link filter', () => {
  test('drops rows whose link is not in enabledLinks', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [
        up('U1', 1, focal.id, 'RECEIPT'),
        up('U2', 1, focal.id, 'INTERNAL'),
      ],
      downstream: [],
    }
    const { nodes } = buildLineageGraph(data, {
      enabledLinks: new Set(['RECEIPT']),
    })
    expect(new Set(nodes.map((n) => n.id))).toEqual(new Set([FOCAL_NODE_ID, 'U1']))
  })

  test('empty enabledLinks set means "all"', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [up('U1', 1, focal.id, 'INTERNAL')],
      downstream: [],
    }
    const { nodes } = buildLineageGraph(data, { enabledLinks: new Set() })
    expect(new Set(nodes.map((n) => n.id))).toEqual(new Set([FOCAL_NODE_ID, 'U1']))
  })
})

describe('buildLineageGraph qty overlay', () => {
  test('every edge carries a numeric weight in [1, 6]', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [
        up('U1', 1, focal.id, 'RECEIPT'),
        up('U2', 2, 'U1', 'RECEIPT'),
      ],
      downstream: [],
    }
    const { edges } = buildLineageGraph(data)
    for (const e of edges) {
      expect(e.data?.weight).toBeGreaterThanOrEqual(1)
      expect(e.data?.weight).toBeLessThanOrEqual(6)
    }
  })

  test('weight scales with qty across the graph (heavier edge gets higher weight)', () => {
    const heavy = { ...up('U1', 1, focal.id), qty: 10_000 }
    const light = { ...up('U2', 1, focal.id), qty: 100 }
    const data: AdvancedLineageData = {
      focal,
      upstream: [heavy, light],
      downstream: [],
    }
    const { edges } = buildLineageGraph(data)
    const heavyEdge = edges.find((e) => e.source === 'U1')
    const lightEdge = edges.find((e) => e.source === 'U2')
    expect(heavyEdge?.data?.weight).toBeGreaterThan(lightEdge?.data?.weight ?? 0)
  })

  test('edges with no qty contribution fall back to weight 1', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [{ ...up('U1', 1, focal.id), qty: Number.NaN }],
      downstream: [],
    }
    const { edges } = buildLineageGraph(data)
    expect(edges[0].data?.qty).toBeNull()
    expect(edges[0].data?.weight).toBe(1)
  })
})

describe('buildLineageGraph grouping', () => {
  function row(
    id: string,
    plant: string,
    material: string,
    parent = focal.id,
  ): AdvancedLineageNode {
    return {
      id,
      level: 1,
      parent,
      link: 'RECEIPT',
      material_id: material,
      material,
      batch: id,
      plant,
      qty: 50,
      uom: 'KG',
    }
  }

  test('groupBy="plant" wraps same-plant rows in a single compound parent', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [
        row('U1', 'RCN1', 'MAT-A'),
        row('U2', 'RCN1', 'MAT-B'),
        row('U3', 'RCN2', 'MAT-C'),
      ],
      downstream: [],
    }
    const { nodes } = buildLineageGraph(data, { groupBy: 'plant' })
    const groups = nodes.filter((n) => n.id.startsWith('group::'))
    expect(groups).toHaveLength(2)
    const rcn1 = nodes.find((n) => n.id === 'group::plant:RCN1')
    expect(rcn1?.data).toMatchObject({ kind: 'group', childCount: 2 })
    // Children carry parentId pointing at their group
    const u1 = nodes.find((n) => n.id === 'U1') as { parentId?: string }
    expect(u1?.parentId).toBe('group::plant:RCN1')
  })

  test('groupBy="material" buckets by material_id', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [
        row('U1', 'RCN1', 'MAT-A'),
        row('U2', 'RCN2', 'MAT-A'),
        row('U3', 'RCN1', 'MAT-B'),
      ],
      downstream: [],
    }
    const { nodes } = buildLineageGraph(data, { groupBy: 'material' })
    const groupIds = nodes
      .filter((n) => n.id.startsWith('group::'))
      .map((n) => n.id)
      .sort()
    expect(groupIds).toEqual([
      'group::material:MAT-A',
      'group::material:MAT-B',
    ])
  })

  test('edges between two nodes in the same group are dropped', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [
        row('U1', 'RCN1', 'MAT-A'),
        { ...row('U2', 'RCN1', 'MAT-B', 'U1'), level: 2 },
      ],
      downstream: [],
    }
    const { edges } = buildLineageGraph(data, { groupBy: 'plant' })
    const intra = edges.find((e) => e.source === 'U2' && e.target === 'U1')
    expect(intra).toBeUndefined()
  })

  test('cross-group edges are rewritten to point at the group ids', () => {
    const data: AdvancedLineageData = {
      focal,
      upstream: [
        row('U1', 'RCN1', 'MAT-A'),
        { ...row('U2', 'RCN2', 'MAT-B', 'U1'), level: 2 },
      ],
      downstream: [],
    }
    const { edges } = buildLineageGraph(data, { groupBy: 'plant' })
    const crossing = edges.find(
      (e) => e.source === 'group::plant:RCN2' && e.target === 'group::plant:RCN1',
    )
    expect(crossing).toBeDefined()
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
