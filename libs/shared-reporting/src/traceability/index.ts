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
  type LineageNodeContext,
} from './AdvancedLineageGraph'
export {
  buildSyntheticLineage,
  type SyntheticGraphOptions,
} from './testFixtures'
export {
  buildExplainTransferContext,
  buildExplainTransferPrompt,
  type GenieLineageContext,
} from './geniePrompt'
export {
  buildExportFilename,
  downloadBlob,
  pngDataUrlToBlob,
  svgStringToBlob,
  type LineageExportFormat,
} from './exportHelpers'
export {
  LineageExportMenu,
  type LineageExportMenuProps,
} from './LineageExportMenu'
export {
  paletteFor,
  LineageThemeContext,
  type LineagePalette,
  type LineageTheme,
} from './nodes'
export {
  HybridTraceabilityPanel,
  type HybridTraceabilityPanelProps,
} from './HybridTraceabilityPanel'
export {
  SankeyFlowView,
  type SankeyFlowViewProps,
} from './SankeyFlowView'
export {
  LineageTableView,
  type LineageTableViewProps,
} from './LineageTableView'
export {
  buildLineageGraph,
  countNodesBySide,
  type FocalNodeData,
  type GroupByMode,
  type GroupNodeData,
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
  TraceFilterControls,
  type TraceFilterControlsProps,
  type TraceFilterValue,
  type TraceFilterVisibility,
  type GroupByMode as ControlsGroupByMode,
} from './TraceFilterControls'
export {
  isLinkVisible,
  parseTraceViewState,
  serialiseTraceViewState,
  toFilterValue,
  useTraceViewState,
  TRACE_KNOWN_LINKS,
  type TraceGroupBy,
  type TraceViewMode,
  type TraceViewState,
} from './viewState'
export {
  FOCAL_NODE_ID,
  FOCAL_NODE_TYPE,
  GROUP_NODE_TYPE,
  LINEAGE_NODE_TYPE,
  type AdvancedLinkType,
  type AdvancedLineageData,
  type AdvancedLineageFocal,
  type AdvancedLineageNode,
  type LineageDirection,
} from './types'
