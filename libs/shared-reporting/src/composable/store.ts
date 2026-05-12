/**
 * Zustand store for composable dashboard edit state.
 *
 * Holds the in-progress dashboard config while the user is in edit mode.
 * The store is reset on mode toggle or when a different dashboard is loaded.
 * Persistence to the backend is triggered explicitly via the toolbar Save action.
 */
import { create } from 'zustand'
import type {
  ComposableDashboardConfig,
  ComposableWidget,
  DashboardDetail,
  DashboardMode,
} from './types'

/** Shape of the dashboard edit store. */
export interface DashboardEditStore {
  /** The dashboard currently open (null when no dashboard is loaded). */
  dashboard: DashboardDetail | null
  /** Current interaction mode — 'view' renders the grid, 'edit' enables drag/resize/palette. */
  mode: DashboardMode
  /** Whether there are unsaved changes since the last save or load. */
  isDirty: boolean
  /** The live editable config; mirrors dashboard.config in view mode. */
  editConfig: ComposableDashboardConfig | null
  /** ID of the widget currently selected in the property inspector (edit mode only). */
  selectedWidgetId: string | null

  /** Load a dashboard and reset edit state. Switches to view mode. */
  loadDashboard: (dashboard: DashboardDetail) => void
  /** Switch between view and edit modes. Entering edit mode clones the config. */
  setMode: (mode: DashboardMode) => void
  /** Update widget layouts after a drag or resize. Marks dirty. */
  updateLayouts: (layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void
  /** Add a new widget to the grid. Marks dirty. */
  addWidget: (widget: ComposableWidget) => void
  /** Remove a widget by ID. Marks dirty. */
  removeWidget: (widgetId: string) => void
  /** Update a widget's props (property inspector changes). Marks dirty. */
  updateWidgetProps: (widgetId: string, props: Record<string, unknown>) => void
  /** Update a widget's data binding configuration. Marks dirty. */
  updateWidgetData: (widgetId: string, data: Record<string, unknown> | null) => void
  /** Update a widget's title. Marks dirty. */
  updateWidgetTitle: (widgetId: string, title: string) => void
  /** Select a widget for property inspection. */
  selectWidget: (widgetId: string | null) => void
  /** Mark the store as clean after a successful save. */
  markSaved: () => void
  /** Discard all edits and return to the last-saved state. */
  discardEdits: () => void
}

export const useDashboardEditStore = create<DashboardEditStore>((set, get) => ({
  dashboard: null,
  mode: 'view',
  isDirty: false,
  editConfig: null,
  selectedWidgetId: null,

  loadDashboard(dashboard) {
    set({
      dashboard,
      mode: 'view',
      isDirty: false,
      editConfig: structuredClone(dashboard.config),
      selectedWidgetId: null,
    })
  },

  setMode(mode) {
    const { dashboard } = get()
    if (mode === 'edit' && dashboard) {
      set({ mode, editConfig: structuredClone(dashboard.config), isDirty: false })
    } else {
      set({ mode })
    }
  },

  updateLayouts(layouts) {
    const { editConfig } = get()
    if (!editConfig) return
    const layoutMap = new Map(layouts.map((l) => [l.i, l]))
    set({
      editConfig: {
        ...editConfig,
        widgets: editConfig.widgets.map((w) => {
          const l = layoutMap.get(w.id)
          return l ? { ...w, layout: { ...w.layout, x: l.x, y: l.y, w: l.w, h: l.h } } : w
        }),
      },
      isDirty: true,
    })
  },

  addWidget(widget) {
    const { editConfig } = get()
    if (!editConfig) return
    set({
      editConfig: { ...editConfig, widgets: [...editConfig.widgets, widget] },
      isDirty: true,
      selectedWidgetId: widget.id,
    })
  },

  removeWidget(widgetId) {
    const { editConfig, selectedWidgetId } = get()
    if (!editConfig) return
    set({
      editConfig: { ...editConfig, widgets: editConfig.widgets.filter((w) => w.id !== widgetId) },
      isDirty: true,
      selectedWidgetId: selectedWidgetId === widgetId ? null : selectedWidgetId,
    })
  },

  updateWidgetProps(widgetId, props) {
    const { editConfig } = get()
    if (!editConfig) return
    set({
      editConfig: {
        ...editConfig,
        widgets: editConfig.widgets.map((w) =>
          w.id === widgetId ? { ...w, props: { ...w.props, ...props } } : w,
        ),
      },
      isDirty: true,
    })
  },

  updateWidgetData(widgetId, data) {
    const { editConfig } = get()
    if (!editConfig) return
    
    const widgetIndex = editConfig.widgets.findIndex((w) => w.id === widgetId)
    if (widgetIndex === -1) return

    const currentWidget = editConfig.widgets[widgetIndex]
    if (JSON.stringify(currentWidget.data) === JSON.stringify(data)) return

    set({
      editConfig: {
        ...editConfig,
        widgets: editConfig.widgets.map((w) =>
          w.id === widgetId ? { ...w, data } : w,
        ),
      },
      isDirty: true,
    })
  },

  updateWidgetTitle(widgetId, title) {
    const { editConfig } = get()
    if (!editConfig) return
    set({
      editConfig: {
        ...editConfig,
        widgets: editConfig.widgets.map((w) =>
          w.id === widgetId ? { ...w, title } : w,
        ),
      },
      isDirty: true,
    })
  },

  selectWidget(widgetId) {
    set({ selectedWidgetId: widgetId })
  },

  markSaved() {
    const { dashboard, editConfig } = get()
    if (!dashboard || !editConfig) return
    set({ isDirty: false, dashboard: { ...dashboard, config: editConfig } })
  },

  discardEdits() {
    const { dashboard } = get()
    if (!dashboard) return
    set({ editConfig: structuredClone(dashboard.config), isDirty: false, selectedWidgetId: null })
  },
}))
