/* eslint-disable jsdoc/require-jsdoc */
/**
 * Internal route names <-> PlatformShell module IDs.
 *
 * Older Warehouse360 page components were written before the platform-
 * shell migration and call `onNav('staging')` etc. with route strings.
 * The shell, on the other hand, deals in `moduleId`s. These two helpers
 * are the bidirectional bridge: when a page navigates internally we map
 * to a moduleId for the shell rail; when the shell selects a module we
 * map back to a route string the legacy pages understand.
 *
 * Adding a new module means appending an entry to BOTH maps.
 */

const MODULE_TO_ROUTE: Record<string, string> = {
  home: 'today',
  'wh-cockpit': 'staging',
  deliveries: 'outbound',
  inbound: 'inbound',
  inventory: 'inventory',
  imwm: 'imwm',
  dispensary: 'dispensary',
  exceptions: 'exceptions',
  performance: 'performance',
}

const ROUTE_TO_MODULE: Record<string, string> = {
  today: 'home',
  staging: 'wh-cockpit',
  outbound: 'deliveries',
  inbound: 'inbound',
  inventory: 'inventory',
  imwm: 'imwm',
  dispensary: 'dispensary',
  exceptions: 'exceptions',
  performance: 'performance',
  // Docs is internal-only; fallback to home so the rail doesn't show a
  // missing-module state.
  docs: 'home',
}

/**
 * Map a PlatformShell module ID to the internal page route string.
 *
 * @param moduleId  Module ID from the shell rail.
 * @returns         The matching route name, or the moduleId itself when
 *                  no mapping is registered (the page-switch then falls
 *                  through to its default).
 */
export function moduleToRoute(moduleId: string): string {
  return MODULE_TO_ROUTE[moduleId] ?? moduleId
}

/**
 * Map an internal route string back to a PlatformShell module ID.
 *
 * @param route  Route name a page may have called `onNav()` with.
 * @returns      The matching module ID, or `'home'` for unknown routes.
 */
export function routeToModule(route: string): string {
  return ROUTE_TO_MODULE[route] ?? 'home'
}
