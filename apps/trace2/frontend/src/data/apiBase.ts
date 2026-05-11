/* eslint-disable jsdoc/require-jsdoc */
const REWRITE_SOURCE = '/api'
const STANDALONE_API_BASE = '/api/t2'
const PLATFORM_API_BASE = '/api/t2'
const PLATFORM_ROUTE_BASE = '/trace2'

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const normaliseApiBase = (value: string | undefined): string => {
  const trimmed = trimTrailingSlash((value ?? '').trim())
  if (!trimmed) return STANDALONE_API_BASE
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/** Returns the resolved API base path for all Trace2 fetch calls. */
export const getTraceApiBase = (): string => {
  const configuredBase = import.meta.env.VITE_TRACE2_API_BASE
  if (configuredBase) return normaliseApiBase(configuredBase)

  if (window.location.pathname === PLATFORM_ROUTE_BASE || window.location.pathname.startsWith(`${PLATFORM_ROUTE_BASE}/`)) {
    return PLATFORM_API_BASE
  }

  return STANDALONE_API_BASE
}

/** Rewrites an API path so it targets the correct base for the current deployment context. */
export const resolveTraceApiPath = (path: string, apiBase = getTraceApiBase()): string => {
  if (!path.startsWith('/')) return path

  const base = normaliseApiBase(apiBase)
  if (path === base || path.startsWith(`${base}/`)) return path

  if (path === REWRITE_SOURCE) return base
  if (path.startsWith(`${REWRITE_SOURCE}/`)) {
    return `${base}${path.slice(REWRITE_SOURCE.length)}`
  }

  return path
}
