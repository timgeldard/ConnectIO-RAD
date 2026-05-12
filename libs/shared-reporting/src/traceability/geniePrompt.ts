/**
 * Genie prompt-builder utilities for the traceability views.
 *
 * The host app (trace2 frontend) is responsible for *delivering* the
 * prompt to an actual Genie endpoint, but composing the prompt itself
 * should be deterministic and reviewable — investigators reading a
 * Genie answer should be able to see exactly what was asked.
 *
 * Keeping the builder in `shared-reporting` means every host app that
 * mounts the advanced lineage graph (trace2 today, potentially others
 * later) sends Genie the same shape of prompt, and reviewers don't have
 * to chase prompt drift across apps.
 *
 * The Genie *transport* is intentionally NOT in this module — that's a
 * host concern (each app may target a different Genie space).  Hosts
 * call `buildExplainTransferPrompt(context)` and POST the result to
 * their `/genie/start` endpoint with a structured `page_context`.
 */
import type { LineageNodeContext } from './AdvancedLineageGraph'

/**
 * The shape host apps should send as the Genie `page_context` block.
 *
 * Mirrors POH's existing context schema (selected_*, mode) so the
 * `compose_genie_content` helper on the backend can apply the same
 * "Application context:" prefix it already knows.
 */
export interface GenieLineageContext {
  mode: 'lineage_transfer'
  side: 'upstream' | 'downstream'
  focal: {
    material_id: string
    material: string
    batch_id: string
    plant: string
  }
  selected: {
    material_id: string
    material: string
    batch_id: string
    plant: string
    link: string
    flow_qty?: number
    qty: number
    uom: string
  }
}

/**
 * Build the user-facing prompt string for "Explain this transfer".
 *
 * The wording is deliberate:
 * - Frames the question from the operator's point of view ("Explain how…").
 * - Always names both batches so Genie can join into our gold lineage
 *   tables without having to infer ids from context.
 * - Includes the link type so Genie can disambiguate PRODUCTION vs
 *   BATCH_TRANSFER without an extra lookup.
 * - Includes `flow_qty` + uom when present; this is the single most
 *   useful number for a recall conversation.
 *
 * @param ctx The clicked-node context from {@link LineageNodeContext}.
 * @returns A single-paragraph natural-language prompt suitable as the
 *   `prompt` field of `/genie/start`.
 */
export function buildExplainTransferPrompt(ctx: LineageNodeContext): string {
  const flow =
    ctx.flow_qty != null && Number.isFinite(ctx.flow_qty)
      ? `${ctx.flow_qty.toLocaleString()} ${ctx.uom}`
      : null
  const direction =
    ctx.side === 'upstream'
      ? `upstream batch ${ctx.material} (${ctx.batch_id}) at ${ctx.plant} fed into focal batch ${ctx.focal.material} (${ctx.focal.batch_id}) at ${ctx.focal.plant}`
      : `focal batch ${ctx.focal.material} (${ctx.focal.batch_id}) at ${ctx.focal.plant} produced downstream batch ${ctx.material} (${ctx.batch_id}) at ${ctx.plant}`
  const flowClause = flow != null ? ` The recorded flow was ${flow}.` : ''
  return (
    `Explain how ${direction} via a ${ctx.link} link.${flowClause} ` +
    `Include the goods movement date, process order id if any, and any quality holds along the path.`
  )
}

/**
 * Project a {@link LineageNodeContext} into the Genie `page_context` block.
 *
 * Splitting prompt + context lets the Genie space's prompt template
 * stay short — the structured context handles the deterministic
 * "who/what/where" so the prompt itself only needs to ask the question.
 *
 * @param ctx The clicked-node context.
 * @returns A `GenieLineageContext` ready to POST as `page_context`.
 */
export function buildExplainTransferContext(
  ctx: LineageNodeContext,
): GenieLineageContext {
  return {
    mode: 'lineage_transfer',
    side: ctx.side,
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
      flow_qty: ctx.flow_qty,
      qty: ctx.qty,
      uom: ctx.uom,
    },
  }
}
