/**
 * Pure transformers from backend lineage shape to React Flow nodes/edges.
 *
 * Splitting the transform out from the component keeps it unit-testable
 * without touching React Flow's runtime, and lets a future Sankey view
 * reuse the same parent-child resolution logic.
 */
import type { Edge, Node } from '@xyflow/react'

import {
  type AdvancedLineageData,
  type AdvancedLineageFocal,
  type AdvancedLineageNode,
  type AdvancedLinkType,
  type LineageDirection,
  FOCAL_NODE_ID,
  FOCAL_NODE_TYPE,
  LINEAGE_NODE_TYPE,
} from './types'

/** Data attached to React Flow nodes for our custom renderers. */
export interface FocalNodeData extends Record<string, unknown> {
  kind: 'focal'
  focal: AdvancedLineageFocal
}

export interface LineageNodeData extends Record<string, unknown> {
  kind: 'lineage'
  direction: 'upstream' | 'downstream'
  node: AdvancedLineageNode
}

/** Data attached to React Flow edges so the custom edge can style by link type. */
export interface LineageEdgeData extends Record<string, unknown> {
  link: AdvancedLinkType
  direction: 'upstream' | 'downstream'
}

export type LineageReactFlowNode =
  | Node<FocalNodeData, typeof FOCAL_NODE_TYPE>
  | Node<LineageNodeData, typeof LINEAGE_NODE_TYPE>

export type LineageReactFlowEdge = Edge<LineageEdgeData>

export interface TransformOptions {
  /** Which side(s) to include.  Defaults to `'both'`. */
  direction?: LineageDirection
  /** Cap upstream depth (1-based).  Defaults to no cap. */
  maxUpstreamLevel?: number
  /** Cap downstream depth (1-based).  Defaults to no cap. */
  maxDownstreamLevel?: number
}

/**
 * Convert the classic `{focal, upstream[], downstream[]}` payload into
 * React Flow's node/edge arrays.
 *
 * Node positions are left at `(0, 0)` — the React Flow layout engine
 * (`layoutEngines.ts`) is responsible for assigning final coordinates.
 *
 * Rules of the transform:
 * - Self-references (nodes whose `id` equals the focal's `id`) are dropped;
 *   the classic component renders these as "self-transfer" badges, which
 *   we may layer in later but they are not part of the graph topology.
 * - Edge direction matches data direction: upstream edges flow from the
 *   parent (deeper into history) toward the child (closer to focal);
 *   downstream edges flow from the focal toward its consumers.  Both are
 *   modelled as React Flow edges from parent → child for hit-testing.
 * - Depth caps are applied after deduplication so a capped sub-tree never
 *   leaves a dangling edge whose target is missing.
 */
export function buildLineageGraph(
  data: AdvancedLineageData,
  options: TransformOptions = {},
): {
  nodes: LineageReactFlowNode[]
  edges: LineageReactFlowEdge[]
} {
  const direction: LineageDirection = options.direction ?? 'both'
  const maxUpstream = options.maxUpstreamLevel ?? Number.POSITIVE_INFINITY
  const maxDownstream = options.maxDownstreamLevel ?? Number.POSITIVE_INFINITY

  const nodes: LineageReactFlowNode[] = []
  const edges: LineageReactFlowEdge[] = []

  // Focal first so it has the lowest z-order and consumers can rely on
  // it being at index 0 for fast access.
  nodes.push({
    id: FOCAL_NODE_ID,
    type: FOCAL_NODE_TYPE,
    position: { x: 0, y: 0 },
    data: { kind: 'focal', focal: data.focal },
  })

  /**
   * Walk one side of the lineage, emit nodes and edges, and remember which
   * node ids we have actually emitted so we can skip orphan edges whose
   * target was filtered out by a depth cap.
   */
  const collectSide = (
    side: 'upstream' | 'downstream',
    rows: readonly AdvancedLineageNode[],
    maxLevel: number,
  ) => {
    const emittedIds = new Set<string>([FOCAL_NODE_ID])

    for (const row of rows) {
      if (row.id === data.focal.id) continue // self-transfer; not part of topology
      if (row.level > maxLevel) continue

      // De-duplicate — the same lineage node can arrive twice when the
      // recursive CTE walks via two different paths.  React Flow rejects
      // duplicate ids, so we keep the first instance.
      if (emittedIds.has(row.id)) continue
      emittedIds.add(row.id)

      nodes.push({
        id: row.id,
        type: LINEAGE_NODE_TYPE,
        position: { x: 0, y: 0 },
        data: { kind: 'lineage', direction: side, node: row },
      })
    }

    for (const row of rows) {
      if (row.id === data.focal.id) continue
      if (row.level > maxLevel) continue

      // Parent is either the focal (level 1) or another lineage row's id.
      // The focal-id check uses the raw focal.id; the backend emits this
      // as the parent for level-1 rows, so we rewrite it to FOCAL_NODE_ID.
      const parentId = row.parent === data.focal.id ? FOCAL_NODE_ID : row.parent
      if (!emittedIds.has(parentId)) continue // dangling — parent was capped

      // For upstream edges we visualise the *flow* of material toward the
      // focal: parent (further from focal) → child (closer).  Downstream
      // mirrors this but starts at the focal.  This is also the direction
      // ELK uses to layer the layout sensibly.
      const source = side === 'upstream' ? row.id : parentId
      const target = side === 'upstream' ? parentId : row.id

      edges.push({
        id: `${source}->${target}::${row.link}`,
        source,
        target,
        data: { link: row.link, direction: side },
      })
    }
  }

  if (direction !== 'downstream') {
    collectSide('upstream', data.upstream, maxUpstream)
  }
  if (direction !== 'upstream') {
    collectSide('downstream', data.downstream, maxDownstream)
  }

  return { nodes, edges }
}

/** Convenience: count nodes per side, used by UI badges. */
export function countNodesBySide(data: AdvancedLineageData): {
  upstream: number
  downstream: number
} {
  const focalId = data.focal.id
  const unique = (rows: readonly AdvancedLineageNode[]) =>
    new Set(rows.filter((r) => r.id !== focalId).map((r) => r.id)).size
  return {
    upstream: unique(data.upstream),
    downstream: unique(data.downstream),
  }
}
