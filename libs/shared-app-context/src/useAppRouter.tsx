/**
 * Typed, URL-synced app router for ConnectIO-RAD single-page apps.
 *
 * This is the M-1 architecture-review fix.  Each app previously invented its
 * own navigation pattern — enum-driven `navigate(pageId)`, ad-hoc
 * `MODULE_TO_ROUTE` maps, `useState(route)` with manual URL sync.  This hook
 * standardises the pattern without forcing every app onto React Router.
 *
 * Usage
 * -----
 *
 * ```tsx
 * type SpcRoute = 'overview' | 'imr' | 'xbar' | 'attribute' | 'capability'
 *
 * const routes: SpcRoute[] = ['overview', 'imr', 'xbar', 'attribute', 'capability']
 *
 * function SpcApp() {
 *   const { route, navigate } = useAppRouter<SpcRoute>({
 *     routes,
 *     defaultRoute: 'overview',
 *     queryParam: 'view',
 *   })
 *   return (
 *     <>
 *       <NavBar onSelect={navigate} active={route} />
 *       {route === 'overview' && <Overview />}
 *       {route === 'imr' && <ImrChart />}
 *       ...
 *     </>
 *   )
 * }
 * ```
 *
 * The hook keeps the URL `?view=imr` query parameter in sync with `route` and
 * uses `history.replaceState` so navigation is non-destructive — back/forward
 * still work and the page does not reload.  When mounted inside the platform
 * shell, callers can pass `onNavigate` to forward the navigation up to the
 * shell's own router (which manages the cross-app deep-link surface).
 *
 * The hook does NOT depend on React Router; it is a tiny ~40-line primitive
 * that keeps single-app navigation predictable.  Apps that genuinely need
 * nested routes, route loaders, etc. should adopt React Router proper rather
 * than extending this hook.
 */
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/** Options passed to `useAppRouter`. */
export interface UseAppRouterOptions<R extends string> {
  /** The exhaustive list of valid routes — used to validate URL input. */
  routes: readonly R[]
  /** The route used when the URL is missing the param or carries an unknown value. */
  defaultRoute: R
  /** The URL query parameter name used to encode the current route. Default: `'view'`. */
  queryParam?: string
  /**
   * Optional callback invoked when navigation happens.  When the app is hosted
   * inside the platform shell, the shell passes a handler so it can forward
   * the change to its own deep-link state.  Standalone apps can omit it.
   */
  onNavigate?: (route: R) => void
}

/** Value returned by `useAppRouter`. */
export interface UseAppRouterValue<R extends string> {
  /** The currently active route. */
  route: R
  /** Navigate to a different route. Updates URL and (optionally) parent shell. */
  navigate: (next: R) => void
  /** True when `route` matches `defaultRoute` — convenience for "home" UI hints. */
  isDefault: boolean
}

/** Props for an app-specific router action provider. */
export interface AppRouterActionsProviderProps<A extends object> {
  /** Typed navigation actions exposed to descendants. */
  value: A
  /** Descendant app routes and panels that need to trigger navigation. */
  children: ReactNode
}

/**
 * Creates a typed navigation action context for app-local routes.
 *
 * Use this for richer app-specific actions such as "open process order" where
 * passing callbacks through every route component would be noisy, but globals
 * would make ownership and cleanup ambiguous.
 */
export function createAppRouterActions<A extends object>(displayName = 'AppRouterActions') {
  const ActionsContext = createContext<A | null>(null)
  ActionsContext.displayName = displayName

  function AppRouterActionsProvider({ value, children }: AppRouterActionsProviderProps<A>) {
    return (
      <ActionsContext.Provider value={value}>
        {children}
      </ActionsContext.Provider>
    )
  }
  AppRouterActionsProvider.displayName = `${displayName}.Provider`

  function useAppRouterActions(): A {
    const value = useContext(ActionsContext)
    if (!value) {
      throw new Error(`${displayName} must be used within its provider`)
    }
    return value
  }

  return {
    Provider: AppRouterActionsProvider,
    useActions: useAppRouterActions,
  } as const
}

/**
 * Read the current route from the URL.
 *
 * Returns `defaultRoute` when the param is absent or carries an unknown value.
 * Defensive: `URLSearchParams` is safe to call even on SSR-style empty
 * `window`, so the only failure mode is the route enum mismatch.
 *
 * @param routes The exhaustive list of valid routes for this app.
 * @param defaultRoute Fallback when the URL has no usable route.
 * @param queryParam URL query parameter name carrying the route.
 * @returns A valid route from the supplied list.
 */
function readRouteFromUrl<R extends string>(
  routes: readonly R[],
  defaultRoute: R,
  queryParam: string,
): R {
  if (typeof window === 'undefined') return defaultRoute
  const params = new URLSearchParams(window.location.search)
  const raw = params.get(queryParam)
  if (raw && (routes as readonly string[]).includes(raw)) {
    return raw as R
  }
  return defaultRoute
}

/**
 * Typed, URL-synced single-page app router hook.
 *
 * See the module-level documentation at the top of this file for the
 * intended usage pattern and design tradeoffs.
 *
 * @template R String-literal union of the app's route identifiers.
 * @param options Router configuration:
 *   - `routes` — exhaustive list of valid route identifiers; values outside
 *     this list are rejected (URL fallback applies).
 *   - `defaultRoute` — used when the URL is missing the param or carries
 *     an unknown value.
 *   - `queryParam` — URL query parameter name (default `'view'`).
 *   - `onNavigate` — optional callback fired after a navigation; the
 *     platform shell uses this to forward operator navigation to its own
 *     deep-link state.
 * @returns An object with the current `route`, a typed `navigate(next)`
 *   callback that updates URL state via `history.replaceState`, and an
 *   `isDefault` boolean for "home" UI hints.
 */
export function useAppRouter<R extends string>(
  options: UseAppRouterOptions<R>,
): UseAppRouterValue<R> {
  const { routes, defaultRoute, queryParam = 'view', onNavigate } = options

  const [route, setRoute] = useState<R>(() =>
    readRouteFromUrl(routes, defaultRoute, queryParam),
  )

  // Listen for browser back/forward so the route stays in sync with the URL.
  useEffect(() => {
    const handlePop = () => setRoute(readRouteFromUrl(routes, defaultRoute, queryParam))
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [routes, defaultRoute, queryParam])

  const navigate = useCallback(
    (next: R) => {
      setRoute(next)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        if (next === defaultRoute) {
          url.searchParams.delete(queryParam)
        } else {
          url.searchParams.set(queryParam, next)
        }
        window.history.replaceState({}, '', url.toString())
      }
      onNavigate?.(next)
    },
    [defaultRoute, queryParam, onNavigate],
  )

  return {
    route,
    navigate,
    isDefault: route === defaultRoute,
  }
}
