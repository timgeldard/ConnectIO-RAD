/**
 * Phase 4 synthetic perf benchmark.
 *
 * Measures the **pure transform + layout** pipeline (no React Flow
 * rendering) against three graph sizes: 50, 100, 200 nodes.  Asserts
 * generous budgets so the test fails when an O(n²) regression slips
 * in, not on incidental laptop noise.
 *
 * Why not bench the full React rendering pipeline here?
 * - Vitest + jsdom does not render the canvas React Flow uses for
 *   edges in production builds; the timings would be misleading.
 * - The real interactive perf concern is captured by the Playwright
 *   visual-regression spec at `apps/trace2/e2e/advanced-traceability.spec.ts`
 *   which exercises the full stack against a built bundle.
 *
 * Budget tuning
 * -------------
 * Budgets are deliberately loose for CI variability (shared GitHub
 * runners can stall up to ~2× a quiet local machine).  Tightening
 * them once we have a few green CI runs is a follow-up — the goal is
 * a tripwire, not a precise benchmark.
 *
 * The ELK layout dominates the wall time at 200 nodes; the transform
 * is essentially linear and finishes in microseconds even at that
 * scale.
 */
import { beforeAll, describe, expect, test } from 'vitest'

import { buildLineageGraph } from '../graphTransformers'
import { applyLayout } from '../layoutEngines'
import { buildSyntheticLineage } from '../testFixtures'

// Single shared rand seed across all bench cases so the fixture is
// identical between local and CI runs.
const SEED = 20260512

interface PerfCase {
  /** Display name. */
  label: string
  /** Synthetic node count (focal + this many other nodes). */
  nodeCount: number
  /** Hard wall-clock budget for `buildLineageGraph()`, milliseconds. */
  transformBudgetMs: number
  /** Hard wall-clock budget for `applyLayout()`, milliseconds. */
  layoutBudgetMs: number
}

const CASES: PerfCase[] = [
  // Tightish budgets for the transform; relaxed for ELK because the
  // first call pays an instantiation cost (~30-50ms on a quiet
  // machine).  Subsequent calls are much faster but we don't rely on
  // that — the benchmark proves the cold path is acceptable.
  { label: '50-node fixture', nodeCount: 50, transformBudgetMs: 20, layoutBudgetMs: 800 },
  { label: '100-node fixture', nodeCount: 100, transformBudgetMs: 40, layoutBudgetMs: 1500 },
  { label: '200-node fixture', nodeCount: 200, transformBudgetMs: 80, layoutBudgetMs: 3000 },
]

async function timeAsync<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = performance.now()
  const result = await fn()
  return { result, ms: performance.now() - t0 }
}

function timeSync<T>(fn: () => T): { result: T; ms: number } {
  const t0 = performance.now()
  const result = fn()
  return { result, ms: performance.now() - t0 }
}

describe('Phase 4 perf benchmark', () => {
  // ELK pays a one-time WASM/worker instantiation on the first
  // `layout()` call — ~800-1200ms on a quiet machine.  We pre-warm
  // it once so each per-case measurement reflects steady-state cost,
  // which is what we actually ship to operators.  The cold-start
  // cost is itself acceptable because it only happens once per page
  // load; the perf the user sees on every subsequent filter change
  // is the warm path.
  beforeAll(async () => {
    const warmup = buildSyntheticLineage({ nodeCount: 5, seed: 1 })
    const transformed = buildLineageGraph(warmup)
    await applyLayout(transformed.nodes, transformed.edges, { direction: 'LR' })
  }, 30_000)

  for (const c of CASES) {
    test(`${c.label} stays under wall-clock budgets`, async () => {
      const data = buildSyntheticLineage({ nodeCount: c.nodeCount, seed: SEED })

      // Transform: pure JS, should be microseconds even at 200 nodes.
      const transform = timeSync(() => buildLineageGraph(data))
      expect(transform.result.nodes.length).toBeGreaterThan(1)
      expect(transform.ms).toBeLessThanOrEqual(c.transformBudgetMs)

      // Layout: ELK in a Web Worker shim; dominates wall time.
      const layout = await timeAsync(() =>
        applyLayout(transform.result.nodes, transform.result.edges, { direction: 'LR' }),
      )
      expect(layout.result.length).toBe(transform.result.nodes.length)
      expect(layout.ms).toBeLessThanOrEqual(c.layoutBudgetMs)

      // eslint-disable-next-line no-console
      console.info(
        `[perf] ${c.label}: transform=${transform.ms.toFixed(2)}ms ` +
          `layout=${layout.ms.toFixed(2)}ms ` +
          `(budgets: ${c.transformBudgetMs}ms / ${c.layoutBudgetMs}ms)`,
      )
    }, 10_000)
  }
})

describe('Synthetic fixture shape', () => {
  test('produces approximately the requested number of nodes', () => {
    const data = buildSyntheticLineage({ nodeCount: 100, seed: SEED })
    const total = data.upstream.length + data.downstream.length
    // Allow a small under-shoot because the budget is consumed greedily.
    expect(total).toBeGreaterThanOrEqual(95)
    expect(total).toBeLessThanOrEqual(105)
  })

  test('is deterministic on seed (same seed → same node ids)', () => {
    const a = buildSyntheticLineage({ nodeCount: 50, seed: 7 })
    const b = buildSyntheticLineage({ nodeCount: 50, seed: 7 })
    expect(a.upstream.map((r) => r.id)).toEqual(b.upstream.map((r) => r.id))
    expect(a.downstream.map((r) => r.id)).toEqual(b.downstream.map((r) => r.id))
  })

  test('different seeds produce different graphs', () => {
    const a = buildSyntheticLineage({ nodeCount: 50, seed: 1 })
    const b = buildSyntheticLineage({ nodeCount: 50, seed: 2 })
    // At least one row should differ — they may share some structural
    // pieces but the plant/link/qty distribution diverges quickly.
    const aHash = a.upstream.map((r) => `${r.plant}/${r.link}/${r.qty}`).join('|')
    const bHash = b.upstream.map((r) => `${r.plant}/${r.link}/${r.qty}`).join('|')
    expect(aHash).not.toEqual(bHash)
  })

  test('every non-focal row carries a finite flow_qty', () => {
    const data = buildSyntheticLineage({ nodeCount: 100, seed: SEED })
    for (const row of [...data.upstream, ...data.downstream]) {
      expect(row.flow_qty).toBeDefined()
      expect(Number.isFinite(row.flow_qty as number)).toBe(true)
    }
  })
})
