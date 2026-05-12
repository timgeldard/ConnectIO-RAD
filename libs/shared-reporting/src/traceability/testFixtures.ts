/**
 * Synthetic lineage fixtures for Phase 4 benchmarks + visual regression.
 *
 * Produces deterministic payloads at any node count so the React Flow +
 * ELK layout pipeline can be exercised against a stable input — perf
 * runs need fixtures that don't depend on whatever happens to be in
 * a UAT warehouse on a given day.
 *
 * The shape of the synthetic data is intentionally realistic for a
 * food / flavour recall investigation:
 * - One focal batch at the centre.
 * - A tree of upstream raw materials + intermediate batches at varied
 *   plants, with depth scaling to the requested node count.
 * - A symmetric tree of downstream consumers (split between RECEIPT /
 *   SALES_ORDER links) so both halves of the graph layout exercise.
 *
 * The generator is deterministic on `seed` so two CI runs produce the
 * same fixture and `toHaveScreenshot()` baselines remain stable.
 */
import type {
  AdvancedLineageData,
  AdvancedLineageFocal,
  AdvancedLineageNode,
  AdvancedLinkType,
} from './types'

const PLANTS = ['RCN1', 'RCN2', 'TRL1', 'NWB1', 'CHE1'] as const
const UPSTREAM_LINKS: AdvancedLinkType[] = ['RECEIPT', 'INTERNAL', 'CONSUMPTION']
const DOWNSTREAM_LINKS: AdvancedLinkType[] = ['SALES_ORDER', 'INTERNAL']

/** Tiny deterministic PRNG so the fixture is stable across runs. */
function lcg(seed: number): () => number {
  // Numerical Recipes LCG — not cryptographic; just enough to spread
  // a few hundred ids without correlating to seed bits.
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

/** Pick one element of a list using the supplied rand. */
function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]
}

/**
 * Options accepted by {@link buildSyntheticLineage}.
 */
export interface SyntheticGraphOptions {
  /** Total non-focal nodes to emit (split roughly 50/50 between sides). */
  nodeCount: number
  /** PRNG seed.  Same seed → identical output. */
  seed?: number
  /** Override the focal id prefix.  Useful when comparing fixtures. */
  focalPrefix?: string
}

/**
 * Build a deterministic synthetic lineage payload of approximately
 * ``nodeCount`` non-focal nodes (plus the focal).
 *
 * @param options Sizing + seed.
 * @returns A {@link AdvancedLineageData} ready to feed
 *   `buildLineageGraph` or `applyLayout`.
 */
export function buildSyntheticLineage(
  options: SyntheticGraphOptions,
): AdvancedLineageData {
  const seed = options.seed ?? 42
  const rand = lcg(seed)
  const prefix = options.focalPrefix ?? 'SYN'

  const focal: AdvancedLineageFocal = {
    id: `${prefix}::FOCAL`,
    material_id: `${prefix}-MAT-FOCAL`,
    material: 'Synthetic Focal Batch',
    batch_id: `${prefix}-BATCH-FOCAL`,
    plant: PLANTS[0],
    qty: 1000,
    uom: 'KG',
  }

  // Split node budget roughly 60/40 upstream/downstream — recalls tend
  // to fan downstream more aggressively, but the upstream tree carries
  // more level-2+ depth (raw materials → suppliers).
  const upstreamBudget = Math.ceil(options.nodeCount * 0.6)
  const downstreamBudget = options.nodeCount - upstreamBudget

  const upstream = buildSide({
    rand,
    side: 'upstream',
    budget: upstreamBudget,
    focalId: focal.id,
    prefix,
    links: UPSTREAM_LINKS,
  })
  const downstream = buildSide({
    rand,
    side: 'downstream',
    budget: downstreamBudget,
    focalId: focal.id,
    prefix,
    links: DOWNSTREAM_LINKS,
  })

  return { focal, upstream, downstream }
}

interface SideOptions {
  rand: () => number
  side: 'upstream' | 'downstream'
  budget: number
  focalId: string
  prefix: string
  links: AdvancedLinkType[]
}

/**
 * Emit one half of the lineage tree.
 *
 * Walks level-by-level: each existing node at level L has a small
 * fanout of children at level L+1, until the budget is consumed.  The
 * resulting tree has realistic shape (1 → 3 → 6 → …) rather than a
 * uniform fan that would render unnaturally regular.
 */
function buildSide(options: SideOptions): AdvancedLineageNode[] {
  const { rand, side, budget, focalId, prefix, links } = options
  const out: AdvancedLineageNode[] = []
  if (budget === 0) return out

  // Level 1: direct connections to the focal.  Slightly fewer for
  // upstream (recalls typically show 2-4 raw-material inputs) than
  // downstream (a popular batch ships to many customers).
  const level1Count = Math.min(side === 'upstream' ? 3 : 5, budget)
  const currentLevelIds: string[] = []
  for (let i = 0; i < level1Count; i += 1) {
    const node = emit({
      rand,
      side,
      level: 1,
      idx: i,
      parent: focalId,
      prefix,
      links,
    })
    out.push(node)
    currentLevelIds.push(node.id)
  }
  let remaining = budget - level1Count
  let level = 2
  let frontier = currentLevelIds

  // Subsequent levels: each parent fans out to 1-3 children.  Cap at
  // a depth that keeps the tree visually sensible (deeper than ~6
  // makes the graph unreadable even with virtualisation).
  while (remaining > 0 && level <= 8) {
    const nextFrontier: string[] = []
    for (const parentId of frontier) {
      if (remaining <= 0) break
      const fan = Math.min(1 + Math.floor(rand() * 3), remaining)
      for (let i = 0; i < fan; i += 1) {
        const node = emit({
          rand,
          side,
          level,
          idx: out.length,
          parent: parentId,
          prefix,
          links,
        })
        out.push(node)
        nextFrontier.push(node.id)
        remaining -= 1
      }
    }
    if (nextFrontier.length === 0) break
    frontier = nextFrontier
    level += 1
  }

  return out
}

/** Emit one synthetic lineage row. */
function emit({
  rand,
  side,
  level,
  idx,
  parent,
  prefix,
  links,
}: {
  rand: () => number
  side: 'upstream' | 'downstream'
  level: number
  idx: number
  parent: string
  prefix: string
  links: AdvancedLinkType[]
}): AdvancedLineageNode {
  const id = `${prefix}::${side[0].toUpperCase()}-${level}-${idx}`
  const plant = pick(rand, PLANTS)
  const link = pick(rand, links)
  const qty = Math.round(50 + rand() * 950)
  // Realistic: flow_qty is usually < node qty for upstream
  // (multiple inputs aggregate) and ≈ qty for downstream
  // (one shipment per row).
  const flow_qty = side === 'upstream' ? Math.round(qty * (0.3 + rand() * 0.6)) : qty
  return {
    id,
    level,
    material_id: `${prefix}-MAT-${level}-${idx}`,
    material: `Synthetic ${side === 'upstream' ? 'Input' : 'Output'} ${level}.${idx}`,
    batch: `${prefix}-BATCH-${level}-${idx}`,
    plant,
    qty,
    flow_qty,
    uom: 'KG',
    supplier: side === 'upstream' ? `Supplier ${(idx % 6) + 1}` : undefined,
    customer: side === 'downstream' ? `Customer ${(idx % 8) + 1}` : undefined,
    link,
    parent,
  }
}
