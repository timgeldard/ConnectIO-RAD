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
  GROUP_NODE_TYPE,
  LINEAGE_NODE_TYPE,
} from './types'

/**
 * Data payload attached to the focal React Flow node.
 *
 * Used by {@link FocalNodeView} to render the focal card and by the
 * `onNodeClick` callback to disambiguate focal selection from regular
 * lineage selection.
 */
export interface FocalNodeData extends Record<string, unknown> {
  kind: 'focal'
  focal: AdvancedLineageFocal
}

/**
 * Data payload attached to each non-focal React Flow node.
 *
 * Carries both the underlying lineage row and the side (`upstream` /
 * `downstream`) so {@link LineageNodeView} can pick the correct
 * background tint without an extra parent-walk.
 */
export interface LineageNodeData extends Record<string, unknown> {
  kind: 'lineage'
  direction: 'upstream' | 'downstream'
  node: AdvancedLineageNode
}

/** Compound node introduced by {@link buildLineageGraph} when grouping is on. */
export interface GroupNodeData extends Record<string, unknown> {
  kind: 'group'
  /** Display label, e.g. "Plant RCN1" or "Material PRT1519". */
  label: string
  /** The key the underlying rows shared (plant id or material id). */
  groupKey: string
  /** Number of contained lineage nodes (excluding the focal). */
  childCount: number
  /** Roll-up of the contained rows' `qty`, in their (possibly mixed) UOMs. */
  totalQty: number | null
}

/**
 * Data payload attached to each React Flow edge.
 *
 * The renderer uses `link` to colour the stroke, `direction` for arrow
 * orientation, `qty` for the inline label, and `weight` for stroke
 * width.  `weight` is always in `1..6`; `qty` is `null` when no parallel
 * row contributed a numeric value.
 */
export interface LineageEdgeData extends Record<string, unknown> {
  link: AdvancedLinkType
  direction: 'upstream' | 'downstream'
  qty: number | null
  weight: number
}

/** Union of every node shape `buildLineageGraph` can emit. */
export type LineageReactFlowNode =
  | Node<FocalNodeData, typeof FOCAL_NODE_TYPE>
  | Node<LineageNodeData, typeof LINEAGE_NODE_TYPE>
  | Node<GroupNodeData, typeof GROUP_NODE_TYPE>

/** Concrete edge type produced by `buildLineageGraph`. */
export type LineageReactFlowEdge = Edge<LineageEdgeData>

/**
 * Compound-grouping strategy.
 *
 * - `'none'` — no grouping; one node per lineage row.
 * - `'plant'` — same-plant rows on the same side wrap in a compound node.
 * - `'material'` — same `material_id` rows wrap in a compound node.
 */
export type GroupByMode = 'none' | 'plant' | 'material'

/** Optional filter / shape inputs accepted by {@link buildLineageGraph}. */
export interface TransformOptions {
  /** Which side(s) to include.  Defaults to `'both'`. */
  direction?: LineageDirection
  /** Cap upstream depth (1-based).  Defaults to no cap. */
  maxUpstreamLevel?: number
  /** Cap downstream depth (1-based).  Defaults to no cap. */
  maxDownstreamLevel?: number
  /** Subset of link types to keep; empty/undefined means "all". */
  enabledLinks?: ReadonlySet<AdvancedLinkType>
  /** Compound-node grouping strategy.  Defaults to `'none'`. */
  groupBy?: GroupByMode
}

/**
 * Convert the classic `{focal, upstream[], downstream[]}` payload into
 * React Flow's node/edge arrays.
 *
 * Node positions are left at `(0, 0)` — the layout engine
 * (`layoutEngines.ts`) is responsible for assigning final coordinates.
 *
 * Rules of the transform
 * ----------------------
 * - **Self-references** (rows whose `id` equals the focal's `id`) are
 *   dropped — they belong to a "self-transfer" badge that lives outside
 *   the graph topology.
 * - **Depth caps** drop rows whose `level` exceeds the per-side limit,
 *   and any edges whose endpoint was dropped go with them (no dangling).
 * - **Link filter** (`enabledLinks`) — when non-empty, only rows whose
 *   `link` is in the set are kept.  This is applied **before** the
 *   depth/dedup pass so a row excluded by link does not consume a
 *   dedup slot for the same node id arriving via a different link.
 * - **Edge weights** — parallel edges between the same (source, target)
 *   pair are aggregated; the resulting edge carries a `qty` sum and a
 *   `weight` in 1..6 scaled across the whole graph for stroke width.
 * - **Grouping** (`groupBy`) — when not `'none'`, rows on the same side
 *   sharing the chosen attribute are wrapped in a compound parent node
 *   (`GROUP_NODE_TYPE`) and the child layout becomes that group's
 *   `parentNode`.  Edges connecting two rows in the same group are
 *   dropped (they become an internal detail of the compound node);
 *   edges crossing groups are kept and rewritten to point at the
 *   group node.
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
  const enabledLinks = options.enabledLinks
  const groupBy: GroupByMode = options.groupBy ?? 'none'

  // ----- 1. flatten & filter rows ----------------------------------------
  interface Side {
    side: 'upstream' | 'downstream'
    rows: readonly AdvancedLineageNode[]
    maxLevel: number
  }
  const sides: Side[] = []
  if (direction !== 'downstream') {
    sides.push({ side: 'upstream', rows: data.upstream, maxLevel: maxUpstream })
  }
  if (direction !== 'upstream') {
    sides.push({ side: 'downstream', rows: data.downstream, maxLevel: maxDownstream })
  }

  type KeptRow = { side: 'upstream' | 'downstream'; row: AdvancedLineageNode }
  // All rows that pass the filters — used for edge derivation so parallel
  // edges (same source/target, different `link`) survive.
  const keptRows: KeptRow[] = []
  // Distinct node ids — used for node emission so each batch is rendered once
  // even when the recursive CTE walked it via multiple paths.
  const nodeRowFor = new Map<string, KeptRow>()
  const keptIds = new Set<string>([FOCAL_NODE_ID])
  for (const { side, rows, maxLevel } of sides) {
    for (const row of rows) {
      if (row.id === data.focal.id) continue
      if (row.level > maxLevel) continue
      if (enabledLinks && enabledLinks.size > 0 && !enabledLinks.has(row.link)) continue
      keptRows.push({ side, row })
      if (!nodeRowFor.has(row.id)) {
        nodeRowFor.set(row.id, { side, row })
        keptIds.add(row.id)
      }
    }
  }

  // ----- 2. build raw edges (may collapse during grouping) ---------------
  interface RawEdge {
    source: string
    target: string
    link: AdvancedLinkType
    direction: 'upstream' | 'downstream'
    qty: number | null
  }
  const rawEdges: RawEdge[] = []
  for (const { side, row } of keptRows) {
    const parentId = row.parent === data.focal.id ? FOCAL_NODE_ID : row.parent
    if (!keptIds.has(parentId)) continue // dangling
    const source = side === 'upstream' ? row.id : parentId
    const target = side === 'upstream' ? parentId : row.id
    // Prefer per-edge ``flow_qty`` when the backend supplied it; otherwise
    // fall back to the per-node ``qty`` so older payloads still produce
    // a sensible weight.  Negative / non-finite values are treated as
    // "no qty contribution" — flow weights must always be positive.
    const edgeQty =
      row.flow_qty != null && Number.isFinite(row.flow_qty)
        ? row.flow_qty
        : Number.isFinite(row.qty)
          ? row.qty
          : null
    rawEdges.push({
      source,
      target,
      link: row.link,
      direction: side,
      qty: edgeQty,
    })
  }

  // ----- 3. (optional) build group mapping -------------------------------
  // groupOf maps each kept row id (or the focal id) → group id.  When
  // grouping is off, the map is the identity.
  const groupOf = new Map<string, string>()
  // Focal is its own group regardless — never collapsed.
  groupOf.set(FOCAL_NODE_ID, FOCAL_NODE_ID)

  interface GroupBucket {
    id: string
    label: string
    groupKey: string
    rows: AdvancedLineageNode[]
  }
  const groups: GroupBucket[] = []

  if (groupBy !== 'none') {
    const buckets = new Map<string, GroupBucket>()
    // Iterate over distinct nodes (not raw kept rows) so multi-link
    // duplicates do not inflate the bucket counts.
    for (const { side, row } of nodeRowFor.values()) {
      const { key, label } = groupingKeyFor(row, groupBy)
      // Each side × group pair is a single bucket so an upstream
      // RCN1 stays distinct from a downstream RCN1 in the visual graph
      // (mass balance might cross the focal at the same plant).
      // The bucket key MUST include the side, otherwise rows from
      // upstream and downstream at the same plant collapse together
      // when direction is 'both' — losing the two-halves topology
      // the layout engine relies on.
      const bucketKey = `${side}:${groupBy}:${key}`
      let bucket = buckets.get(bucketKey)
      if (!bucket) {
        bucket = {
          id: `group::${bucketKey}`,
          label,
          groupKey: key,
          rows: [],
        }
        buckets.set(bucketKey, bucket)
        groups.push(bucket)
      }
      bucket.rows.push(row)
      groupOf.set(row.id, bucket.id)
    }
  } else {
    for (const { row } of nodeRowFor.values()) {
      groupOf.set(row.id, row.id)
    }
  }

  // ----- 4. emit nodes ---------------------------------------------------
  const outNodes: LineageReactFlowNode[] = []
  outNodes.push({
    id: FOCAL_NODE_ID,
    type: FOCAL_NODE_TYPE,
    position: { x: 0, y: 0 },
    data: { kind: 'focal', focal: data.focal },
  })

  if (groupBy !== 'none') {
    // Group nodes first; children reference them as `parentNode`.
    for (const g of groups) {
      const qtyValues = g.rows
        .map((r) => r.qty)
        .filter((q): q is number => Number.isFinite(q))
      const totalQty = qtyValues.length > 0 ? qtyValues.reduce((a, b) => a + b, 0) : null
      outNodes.push({
        id: g.id,
        type: GROUP_NODE_TYPE,
        position: { x: 0, y: 0 },
        data: {
          kind: 'group',
          label: g.label,
          groupKey: g.groupKey,
          childCount: g.rows.length,
          totalQty,
        },
        // React Flow honours these on parent nodes for compound layout.
        // The actual subgraph dimensions are sized by ELK during layout.
        style: { width: 300, height: 200, backgroundColor: 'transparent' },
      })
    }
    for (const { side, row } of nodeRowFor.values()) {
      outNodes.push({
        id: row.id,
        type: LINEAGE_NODE_TYPE,
        position: { x: 0, y: 0 },
        parentId: groupOf.get(row.id),
        extent: 'parent',
        data: { kind: 'lineage', direction: side, node: row },
      })
    }
  } else {
    for (const { side, row } of nodeRowFor.values()) {
      outNodes.push({
        id: row.id,
        type: LINEAGE_NODE_TYPE,
        position: { x: 0, y: 0 },
        data: { kind: 'lineage', direction: side, node: row },
      })
    }
  }

  // ----- 5. collapse + aggregate edges -----------------------------------
  // Edges between nodes in the same group are dropped; edges crossing
  // groups are rewritten to the group ids and aggregated.
  interface EdgeAgg {
    source: string
    target: string
    link: AdvancedLinkType
    direction: 'upstream' | 'downstream'
    qtyTotal: number
    qtyCount: number
  }
  const aggMap = new Map<string, EdgeAgg>()
  for (const e of rawEdges) {
    const groupedSource = groupOf.get(e.source) ?? e.source
    const groupedTarget = groupOf.get(e.target) ?? e.target
    if (groupedSource === groupedTarget) continue // intra-group, drop
    const key = `${groupedSource}->${groupedTarget}::${e.link}`
    let agg = aggMap.get(key)
    if (!agg) {
      agg = {
        source: groupedSource,
        target: groupedTarget,
        link: e.link,
        direction: e.direction,
        qtyTotal: 0,
        qtyCount: 0,
      }
      aggMap.set(key, agg)
    }
    if (e.qty != null) {
      agg.qtyTotal += e.qty
      agg.qtyCount += 1
    }
  }

  // ----- 6. derive stroke weights ----------------------------------------
  // Map qtyTotal (positive) into [1..6] using log-scaled normalisation so
  // a few outsized edges don't squash everything else to width 1.  Edges
  // with no qty contribution fall back to width 1.
  const totals = [...aggMap.values()]
    .map((a) => a.qtyTotal)
    .filter((q) => q > 0)
  const minQ = totals.length > 0 ? Math.min(...totals) : 0
  const maxQ = totals.length > 0 ? Math.max(...totals) : 0
  const useLog = maxQ > 0 && maxQ / Math.max(minQ, 1) > 10

  const outEdges: LineageReactFlowEdge[] = []
  for (const agg of aggMap.values()) {
    const qty = agg.qtyCount > 0 ? agg.qtyTotal : null
    let weight = 1
    if (qty != null && qty > 0 && maxQ > 0) {
      const ratio = useLog
        ? Math.log(qty + 1) / Math.log(maxQ + 1)
        : qty / maxQ
      weight = clamp(Math.round(1 + ratio * 5), 1, 6)
    }
    outEdges.push({
      id: `${agg.source}->${agg.target}::${agg.link}`,
      source: agg.source,
      target: agg.target,
      data: {
        link: agg.link,
        direction: agg.direction,
        qty,
        weight,
      },
    })
  }

  return { nodes: outNodes, edges: outEdges }
}

/** Determine the (key, label) used to bucket a row under the chosen mode. */
function groupingKeyFor(
  row: AdvancedLineageNode,
  mode: GroupByMode,
): { key: string; label: string } {
  if (mode === 'plant') {
    const key = row.plant || 'UNKNOWN'
    return { key, label: `Plant ${key}` }
  }
  if (mode === 'material') {
    const key = row.material_id || 'UNKNOWN'
    return { key, label: `Material ${key}` }
  }
  return { key: row.id, label: row.id }
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo
  if (n > hi) return hi
  return n
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
