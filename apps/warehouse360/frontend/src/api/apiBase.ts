const REWRITE_SOURCE = '/api'
const STANDALONE_API_BASE = '/api/wh360'
const PLATFORM_API_BASE = '/api/wh360'
const PLATFORM_ROUTE_BASE = '/warehouse360'

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const normaliseApiBase = (value: string | undefined): string => {
  const trimmed = trimTrailingSlash((value ?? '').trim())
  if (!trimmed) return STANDALONE_API_BASE
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/** Returns the resolved API base path for all warehouse fetch calls.
 * Reads `VITE_WAREHOUSE360_API_BASE` when set, otherwise selects between
 * `PLATFORM_API_BASE` (when embedded in the platform shell) and `STANDALONE_API_BASE`.
 * @returns Absolute path string with no trailing slash.
 */
export const getWarehouseApiBase = (): string => {
  const configuredBase = import.meta.env.VITE_WAREHOUSE360_API_BASE
  if (configuredBase) return normaliseApiBase(configuredBase)

  if (window.location.pathname === PLATFORM_ROUTE_BASE || window.location.pathname.startsWith(`${PLATFORM_ROUTE_BASE}/`)) {
    return PLATFORM_API_BASE
  }

  return STANDALONE_API_BASE
}

/** Rewrites an API path so it targets the correct base for the current deployment context.
 * @param path - Absolute path starting with `/api/...`.
 * @param apiBase - Optional override; defaults to `getWarehouseApiBase()`.
 * @returns Normalised absolute path with the deployment-correct prefix applied.
 */
export const resolveWarehouseApiPath = (path: string, apiBase = getWarehouseApiBase()): string => {
  if (!path.startsWith('/')) return path

  const base = normaliseApiBase(apiBase)
  if (path === base || path.startsWith(`${base}/`)) return path

  if (path === REWRITE_SOURCE) return base
  if (path.startsWith(`${REWRITE_SOURCE}/`)) {
    return `${base}${path.slice(REWRITE_SOURCE.length)}`
  }

  return path
}
