/**
 * Input data contract for the AdvancedLineageGraph.
 *
 * Mirrors the existing `FocalNode` / `LineageNode` shapes used by the classic
 * SVG `LineageGraph` in `apps/trace2/frontend/src/components/LineageGraph.tsx`
 * so consumers can pass the same data through without remapping.  The fields
 * are intentionally the **minimum** the visualisation needs — adding richer
 * fields later (e.g. aggregated quantities for a Sankey overview) is a
 * follow-up that does not break this contract.
 *
 * Note: `LinkType` is widened to `string` here, in addition to the four
 * canonical values, so a backend that ships a new link kind degrades
 * gracefully (the new value is rendered with a default style instead of
 * crashing type-checking).
 */

/** Known link-type values; backends may extend with arbitrary strings. */
export type AdvancedLinkType =
  | 'RECEIPT'
  | 'INTERNAL'
  | 'CONSUMPTION'
  | 'SALES_ORDER'
  | (string & {})

/** The batch under investigation — the central node anchoring upstream / downstream views. */
export interface AdvancedLineageFocal {
  id: string
  material_id: string
  material: string
  batch_id: string
  plant: string
  qty: number
  uom: string
}

/** A single upstream-or-downstream lineage step from the backend recursive CTE. */
export interface AdvancedLineageNode {
  /** Unique node identifier (typically `${material_id}::${batch_id}` or similar). */
  id: string
  /** 1-based hop distance from the focal node. */
  level: number
  material_id: string
  material: string
  /** Batch identifier; named `batch` (not `batch_id`) to match the classic component. */
  batch: string
  plant: string
  qty: number
  uom: string
  supplier?: string
  customer?: string
  /** Link kind (RECEIPT/CONSUMPTION/INTERNAL/SALES_ORDER, or an extension). */
  link: AdvancedLinkType
  /** Identifier of the node this row hangs off (the focal, or another lineage node). */
  parent: string
}

/** Direction the graph flows from the focal node. */
export type LineageDirection = 'upstream' | 'downstream' | 'both'

/** Subset of the focal+arrays passed by the consumer. */
export interface AdvancedLineageData {
  focal: AdvancedLineageFocal
  upstream: AdvancedLineageNode[]
  downstream: AdvancedLineageNode[]
}

/**
 * Stable identifiers used by React Flow.
 *
 * The focal node always uses the literal `'__focal__'` id so consumers can
 * pin a stable selection marker even across refocus events.  Upstream and
 * downstream nodes use their backend `id` field directly.
 */
export const FOCAL_NODE_ID = '__focal__'

/** Custom node type registered with React Flow for the focal batch. */
export const FOCAL_NODE_TYPE = 'lineageFocal'

/** Custom node type registered with React Flow for each upstream/downstream batch. */
export const LINEAGE_NODE_TYPE = 'lineageBatch'
