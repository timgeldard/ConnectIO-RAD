/* eslint-disable jsdoc/require-jsdoc */
const REWRITE_SOURCE = '/api'
const STANDALONE_API_BASE = '/api/poh'
const PLATFORM_API_BASE = '/api/poh'
const PLATFORM_ROUTE_BASE = '/poh'

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const normaliseApiBase = (value: string | undefined): string => {
  const trimmed = trimTrailingSlash((value ?? '').trim())
  if (!trimmed) return STANDALONE_API_BASE
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/** Returns the resolved API base path for all POH fetch calls. */
export const getPohApiBase = (): string => {
  const configuredBase = import.meta.env.VITE_POH_API_BASE
  if (configuredBase) return normaliseApiBase(configuredBase)

  if (window.location.pathname === PLATFORM_ROUTE_BASE || window.location.pathname.startsWith(`${PLATFORM_ROUTE_BASE}/`)) {
    return PLATFORM_API_BASE
  }

  return STANDALONE_API_BASE
}

/** Rewrites an API path so it targets the correct base for the current deployment context. */
export const resolvePohApiPath = (path: string, apiBase = getPohApiBase()): string => {
  if (!path.startsWith('/')) return path

  const base = normaliseApiBase(apiBase)
  if (path === base || path.startsWith(`${base}/`)) return path

  if (path === REWRITE_SOURCE) return base
  if (path.startsWith(`${REWRITE_SOURCE}/`)) {
    return `${base}${path.slice(REWRITE_SOURCE.length)}`
  }

  return path
}
