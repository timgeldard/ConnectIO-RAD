/**
 * Public API for the traceability visualisation module.
 *
 * Consumers should import from `@connectio/shared-reporting` (the
 * top-level barrel re-exports everything here) rather than from this
 * file directly, so internal restructuring stays a non-breaking change.
 */
export {
  AdvancedLineageGraph,
  type AdvancedLineageGraphProps,
} from './AdvancedLineageGraph'
export {
  HybridTraceabilityPanel,
  type HybridTraceabilityPanelProps,
} from './HybridTraceabilityPanel'
export {
  buildLineageGraph,
  countNodesBySide,
  type FocalNodeData,
  type LineageEdgeData,
  type LineageNodeData,
  type LineageReactFlowEdge,
  type LineageReactFlowNode,
  type TransformOptions,
} from './graphTransformers'
export {
  applyLayout,
  type LayoutDirection,
  type LayoutOptions,
} from './layoutEngines'
export { colourForLink } from './nodes'
export {
  parseTraceViewState,
  serialiseTraceViewState,
  useTraceViewState,
  type TraceViewMode,
  type TraceViewState,
} from './viewState'
export {
  FOCAL_NODE_ID,
  FOCAL_NODE_TYPE,
  LINEAGE_NODE_TYPE,
  type AdvancedLinkType,
  type AdvancedLineageData,
  type AdvancedLineageFocal,
  type AdvancedLineageNode,
  type LineageDirection,
} from './types'
