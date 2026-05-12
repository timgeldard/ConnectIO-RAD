/**
 * Build the {@link GeniePageContext} payload from the trace2 view state.
 *
 * Two shapes are supported:
 *
 * - `lineage` — the operator is on a BottomUp or TopDown page with a
 *   focal batch in view but no specific transfer selected.  Used by
 *   the floating Genie trigger button.
 * - `lineage_transfer` — the operator right-clicked a node on the
 *   advanced lineage graph and chose "Explain this transfer".  Carries
 *   both the focal batch and the selected node's identity / link /
 *   flow_qty so Genie can answer specifically about that edge.
 *
 * The function is intentionally **pure** — no calls into stores or
 * URL parsing — so callers stay in control of which focal/node is
 * "current".  Trace2's pages already track that in component state.
 */
import type { Batch, FocalNode, LineageNode } from '../types'
import type { GeniePageContext } from './api'

/** What the operator is currently looking at (page-level + focal). */
export interface TraceLineageView {
  /** Trace2 page identifier — used in the Genie context so prompts
   * can distinguish upstream vs downstream investigations. */
  view: 'bottom-up' | 'top-down' | 'overview' | string
  /** The focal batch the user is investigating, either via header
   * lookup or via clicking a node in another view. */
  batch: Batch | FocalNode
}

/**
 * Build a `lineage`-mode page context from the current view state.
 *
 * @param view View identifier + focal batch.
 * @returns A {@link GeniePageContext} ready to POST to `/api/genie/start`.
 */
export function buildLineageContext(view: TraceLineageView): GeniePageContext {
  const focal = toFocal(view.batch)
  return {
    mode: 'lineage',
    view: view.view,
    focal,
    selected: null,
  }
}

/**
 * Build a `lineage_transfer`-mode page context when the user
 * right-clicks a specific lineage node.
 *
 * @param view View identifier + focal batch.
 * @param node The clicked lineage node.
 * @param side Which side of the focal the node lives on.
 * @returns A {@link GeniePageContext} including the selected node.
 */
export function buildTransferContext(
  view: TraceLineageView,
  node: LineageNode,
  side: 'upstream' | 'downstream',
): GeniePageContext {
  const focal = toFocal(view.batch)
  // `flow_qty` lives on `LineageNode` after PR #54 (Phase 0-3a) merges;
  // until then we read it via a defensive cast so this file typechecks
  // on either side of that merge.  Drop the cast in a follow-up once
  // #54 lands and flow_qty is part of the published LineageNode type.
  const flowQty = (node as unknown as { flow_qty?: number }).flow_qty
  return {
    mode: 'lineage_transfer',
    view: view.view,
    focal,
    selected: {
      material_id: node.material_id,
      material: node.material,
      batch_id: node.batch,
      plant: node.plant,
      link: String(node.link),
      side,
      flow_qty: typeof flowQty === 'number' && Number.isFinite(flowQty) ? flowQty : null,
      qty: node.qty ?? null,
      uom: node.uom ?? null,
    },
  }
}

/** Normalise either a full `Batch` or a precomputed `FocalNode` into the
 * compact `{material_id, material, batch_id, plant}` shape Genie needs. */
function toFocal(batch: Batch | FocalNode): GeniePageContext['focal'] {
  if (isFocal(batch)) {
    return {
      material_id: batch.material_id,
      material: batch.material,
      batch_id: batch.batch_id,
      plant: batch.plant,
    }
  }
  return {
    material_id: batch.material_id,
    material: batch.material_name || batch.material_id,
    batch_id: batch.batch_id,
    plant: batch.plant_name || batch.plant_id || '',
  }
}

function isFocal(b: Batch | FocalNode): b is FocalNode {
  return 'kind' in b && b.kind === 'focal'
}
