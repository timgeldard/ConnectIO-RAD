/* eslint-disable jsdoc/require-jsdoc */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { DashboardFilters, FilterConfig, FilterValue } from '../core/types'

export interface DashboardFilterContextValue {
  filters: DashboardFilters
  setFilter(id: string, value: FilterValue): void
  resetFilters(): void
}

const DashboardFilterContext = createContext<DashboardFilterContextValue | null>(null)

function filtersFromConfig(configs: FilterConfig[]): DashboardFilters {
  return Object.fromEntries(
    configs
      .filter((filter): filter is FilterConfig & { defaultValue: FilterValue } => filter.defaultValue !== undefined)
      .map((filter) => [filter.id, filter.defaultValue])
  )
}

export interface DashboardFilterProviderProps {
  filters: FilterConfig[]
  initialValues?: DashboardFilters
  children: ReactNode
}

export function DashboardFilterProvider({ filters, initialValues, children }: DashboardFilterProviderProps) {
  const defaults = useMemo(() => filtersFromConfig(filters), [filters])
  const [values, setValues] = useState<DashboardFilters>({ ...defaults, ...initialValues })

  const setFilter = useCallback((id: string, value: FilterValue) => {
    setValues((current) => ({ ...current, [id]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setValues(defaults)
  }, [defaults])

  const context = useMemo(() => ({ filters: values, setFilter, resetFilters }), [resetFilters, setFilter, values])

  return (
    <DashboardFilterContext.Provider value={context}>
      {children}
    </DashboardFilterContext.Provider>
  )
}

export function useDashboardFilters(): DashboardFilterContextValue {
  const context = useContext(DashboardFilterContext)
  if (!context) {
    throw new Error('useDashboardFilters must be used within DashboardFilterProvider.')
  }
  return context
}

export function serializeFiltersToSearchParams(filters: DashboardFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value == null) continue
    params.set(key, typeof value === 'string' ? value : JSON.stringify(value))
  }
  return params
}

export function parseFiltersFromSearchParams(params: URLSearchParams): DashboardFilters {
  const filters: DashboardFilters = {}
  params.forEach((value, key) => {
    try {
      filters[key] = JSON.parse(value) as FilterValue
    } catch {
      filters[key] = value
    }
  })
  return filters
}
