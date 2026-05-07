const STANDALONE_API_BASE = '/api'
const PLATFORM_API_BASE = '/api/wh'
const PLATFORM_ROUTE_BASE = '/warehouse360'

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const normaliseApiBase = (value: string | undefined): string => {
  const trimmed = trimTrailingSlash((value ?? '').trim())
  return trimmed || STANDALONE_API_BASE
}

export const getWarehouseApiBase = (): string => {
  const configuredBase = import.meta.env.VITE_WAREHOUSE360_API_BASE
  if (configuredBase) return normaliseApiBase(configuredBase)

  if (window.location.pathname === PLATFORM_ROUTE_BASE || window.location.pathname.startsWith(`${PLATFORM_ROUTE_BASE}/`)) {
    return PLATFORM_API_BASE
  }

  return STANDALONE_API_BASE
}

export const resolveWarehouseApiPath = (path: string, apiBase = getWarehouseApiBase()): string => {
  if (!path.startsWith('/')) return path

  const base = normaliseApiBase(apiBase)
  if (path === base || path.startsWith(`${base}/`)) return path

  if (path === STANDALONE_API_BASE) return base
  if (path.startsWith(`${STANDALONE_API_BASE}/`)) {
    return `${base}${path.slice(STANDALONE_API_BASE.length)}`
  }

  return path
}
