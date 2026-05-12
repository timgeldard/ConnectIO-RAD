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
import type { LineageNodeContext } from '@connectio/shared-reporting'

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
  const flowQty = node.flow_qty
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

/**
 * Adapt the {@link LineageNodeContext} that
 * `AdvancedLineageGraph.onExplainNode` emits into the trace2
 * {@link GeniePageContext} shape its backend `compose_genie_content`
 * understands.
 *
 * The two shapes are intentionally similar but not identical — the
 * shared-reporting context is library-generic (no `view` field, side
 * at the top level), while the trace2 context carries the active page
 * id and nests `side` inside `selected` (so the backend prompt
 * composer can list "selected_side" alongside the other selected_*
 * fields uniformly).  This adapter is the single point of impedance
 * matching; if a future version of shared-reporting adopts the
 * trace2 shape, this function becomes a one-liner identity.
 *
 * @param ctx The clicked-node context from `onExplainNode`.
 * @param viewLabel The trace2 page identifier (e.g. `'bottom-up'`).
 * @returns A `GeniePageContext` ready to POST to `/api/genie/start`.
 */
export function fromLineageNodeContext(
  ctx: LineageNodeContext,
  viewLabel: string,
): GeniePageContext {
  return {
    mode: 'lineage_transfer',
    view: viewLabel,
    focal: {
      material_id: ctx.focal.material_id,
      material: ctx.focal.material,
      batch_id: ctx.focal.batch_id,
      plant: ctx.focal.plant,
    },
    selected: {
      material_id: ctx.material_id,
      material: ctx.material,
      batch_id: ctx.batch_id,
      plant: ctx.plant,
      link: ctx.link,
      side: ctx.side,
      flow_qty:
        typeof ctx.flow_qty === 'number' && Number.isFinite(ctx.flow_qty)
          ? ctx.flow_qty
          : null,
      qty: typeof ctx.qty === 'number' && Number.isFinite(ctx.qty) ? ctx.qty : null,
      uom: ctx.uom ?? null,
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
