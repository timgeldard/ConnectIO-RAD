import { createAppRouterActions } from '@connectio/shared-app-context'

export type PohDetailSource =
  | 'list'
  | 'planning'
  | 'day-view'
  | 'pours'
  | 'yield'
  | 'quality'
  | 'vessel-planning'

export interface PohOrderNavigationContext {
  _from?: PohDetailSource | string
  label?: string | null
  materialId?: string | null
  [key: string]: unknown
}

export interface PohNavigationActions {
  navigateToPourAnalytics: () => void
  navigateToOrder: (poId: string | number, context?: PohOrderNavigationContext) => void
}

const pohNavigation = createAppRouterActions<PohNavigationActions>('PohNavigation')

export const PohNavigationProvider = pohNavigation.Provider
export const usePohNavigation = pohNavigation.useActions
