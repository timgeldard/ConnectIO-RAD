import { createAppRouterActions } from '@connectio/shared-app-context'

/** Source view identifiers that can open a POH order detail screen. */
export type PohDetailSource =
  | 'list'
  | 'planning'
  | 'day-view'
  | 'pours'
  | 'yield'
  | 'quality'
  | 'vessel-planning'

/** Context passed when navigating from an analytics/planning surface to an order. */
export interface PohOrderNavigationContext {
  /** Source view to return to when the order detail closes. */
  _from?: PohDetailSource | string
  /** Human-readable label shown by callers while opening the order. */
  label?: string | null
  /** Optional material identifier associated with the selected order. */
  materialId?: string | null
  /** Additional caller-specific metadata passed through to the detail route. */
  [key: string]: unknown
}

/** Typed navigation actions exposed to POH route components. */
export interface PohNavigationActions {
  /** Navigate to the pour analytics view. */
  navigateToPourAnalytics: () => void
  /** Navigate to an order detail view by process order ID. */
  navigateToOrder: (poId: string | number, context?: PohOrderNavigationContext) => void
}

const pohNavigation = createAppRouterActions<PohNavigationActions>('PohNavigation')

export const PohNavigationProvider = pohNavigation.Provider
export const usePohNavigation = pohNavigation.useActions
