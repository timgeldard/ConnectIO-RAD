/**
 * Layout engine wrapper around elkjs.
 *
 * The classic `LineageGraph` uses a hand-rolled column-and-row layout
 * (`apps/trace2/frontend/src/components/LineageGraph.tsx`).  For the
 * advanced view we delegate to ELK's layered algorithm, which:
 *
 * - Produces deterministic positions (good for visual regression).
 * - Handles cross-site loops and multi-parent nodes without overlaps.
 * - Lets us flip layout direction (`RIGHT` for downstream emphasis,
 *   `LEFT` for bottom-up upstream emphasis, etc.) with one option flip.
 *
 * The wrapper is async because ELK runs in a Web Worker by default; we
 * await the promise and return positions the caller can fold into the
 * React Flow node array.
 */
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js'

import { FOCAL_NODE_ID } from './types'
import type { LineageReactFlowEdge, LineageReactFlowNode } from './graphTransformers'

/** Approximate node dimensions used as ELK hints. Matches AdvancedLineageGraph CSS. */
const DEFAULT_NODE_WIDTH = 240
const DEFAULT_NODE_HEIGHT = 96
const FOCAL_NODE_WIDTH = 280
const FOCAL_NODE_HEIGHT = 112

/** ELK direction codes; we expose only the two we use today. */
export type LayoutDirection = 'LR' | 'RL'

export interface LayoutOptions {
  /** Direction the graph flows visually.  `LR` puts upstream on the left of
   * the focal and downstream on the right; `RL` is the mirror image, which
   * suits bottom-up pages that read right-to-left semantically. */
  direction?: LayoutDirection
}

let elkInstance: InstanceType<typeof ELK> | null = null

/** Lazily instantiate ELK on first use; one instance is reused per page. */
function getElk(): InstanceType<typeof ELK> {
  if (!elkInstance) elkInstance = new ELK()
  return elkInstance
}

/**
 * Run ELK on a set of React Flow nodes + edges and return new nodes with
 * `position` filled in.  Input nodes are not mutated.
 *
 * If ELK throws (very rare; usually a malformed graph), we fall back to a
 * naive grid layout so the UI still renders something — losing pretty
 * routing is better than throwing a blank screen during an investigation.
 */
export async function applyLayout(
  nodes: LineageReactFlowNode[],
  edges: LineageReactFlowEdge[],
  options: LayoutOptions = {},
): Promise<LineageReactFlowNode[]> {
  const direction = options.direction ?? 'LR'

  const elk = getElk()

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction === 'LR' ? 'RIGHT' : 'LEFT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '40',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
      // Stable ordering — investigations should see the same layout each
      // visit unless data changes.  `NODES_AND_EDGES` keeps both axes pinned.
      'elk.layered.crossingMinimization.semiInteractive': 'true',
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: n.id === FOCAL_NODE_ID ? FOCAL_NODE_WIDTH : DEFAULT_NODE_WIDTH,
      height: n.id === FOCAL_NODE_ID ? FOCAL_NODE_HEIGHT : DEFAULT_NODE_HEIGHT,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  }

  try {
    const laidOut = await elk.layout(elkGraph)
    const positions = new Map<string, { x: number; y: number }>()
    for (const child of laidOut.children ?? []) {
      positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 })
    }
    return nodes.map((n) => ({
      ...n,
      position: positions.get(n.id) ?? n.position,
    }))
  } catch (err) {
    // Fall back to a simple grid; React Flow will still render and the
    // user can pan around manually.  Worth a console.warn so QA notices.
    // eslint-disable-next-line no-console
    console.warn('[AdvancedLineageGraph] ELK layout failed, using fallback grid:', err)
    return fallbackGrid(nodes)
  }
}

/**
 * Deterministic grid fallback used when ELK throws.
 *
 * The focal sits at (0,0); other nodes are spread on a coarse grid scaled
 * so React Flow's fit-view still produces a sensible viewport.
 */
function fallbackGrid(nodes: LineageReactFlowNode[]): LineageReactFlowNode[] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)))
  return nodes.map((n, i) => {
    if (n.id === FOCAL_NODE_ID) {
      return { ...n, position: { x: 0, y: 0 } }
    }
    const col = (i % cols) - Math.floor(cols / 2)
    const row = Math.floor(i / cols) + 1
    return {
      ...n,
      position: { x: col * (DEFAULT_NODE_WIDTH + 40), y: row * (DEFAULT_NODE_HEIGHT + 40) },
    }
  })
}
