/**
 * TanStack Query hooks for the composable dashboard REST API.
 *
 * All hooks target `/api/dashboards` on the platform backend. Error handling
 * surfaces FastAPI error responses as thrown `Error` instances so callers can
 * render appropriate fallback UI via React error boundaries or `isError` state.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardDetailSchema, dashboardListResponseSchema } from '../schema/composable'
import type { ComposableDashboardConfig, DashboardDetail, DashboardSummary } from '../composable/types'

const BASE = '/api/dashboards'

async function apiFetch<T>(
  url: string,
  schema: { parse: (data: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { detail?: string }).detail ?? `HTTP ${res.status}`)
  }
  return schema.parse(await res.json())
}

// ── Query keys ──────────────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ['dashboards'] as const,
  list: (filters: object) => [...dashboardKeys.all, 'list', filters] as const,
  detail: (id: string) => [...dashboardKeys.all, 'detail', id] as const,
}

// ── List dashboards ──────────────────────────────────────────────────────────

interface ListDashboardsOptions {
  ownedByMe?: boolean
  sharedWithMe?: boolean
  search?: string
}

/**
 * Fetches the list of dashboards visible to the authenticated user.
 *
 * @param options - Optional visibility filters and search term.
 * @returns TanStack Query result containing `dashboards[]` and `total`.
 */
export function useDashboardList(options: ListDashboardsOptions = {}) {
  const params = new URLSearchParams()
  if (options.ownedByMe) params.set('ownedByMe', 'true')
  if (options.sharedWithMe) params.set('sharedWithMe', 'true')
  if (options.search) params.set('search', options.search)
  const qs = params.toString()

  return useQuery({
    queryKey: dashboardKeys.list(options),
    queryFn: () =>
      apiFetch(`${BASE}${qs ? `?${qs}` : ''}`, dashboardListResponseSchema),
    select: (data) => data.dashboards,
    staleTime: 30_000,
  })
}

// ── Get single dashboard ─────────────────────────────────────────────────────

/**
 * Fetches the full definition of a single dashboard.
 *
 * @param id - Dashboard UUID. Query is disabled when id is falsy.
 * @returns TanStack Query result containing the full `DashboardDetail`.
 */
export function useDashboard(id: string | null | undefined) {
  return useQuery({
    queryKey: dashboardKeys.detail(id ?? ''),
    queryFn: () => apiFetch(`${BASE}/${id}`, dashboardDetailSchema),
    enabled: Boolean(id),
    staleTime: 60_000,
  })
}

// ── Create dashboard ─────────────────────────────────────────────────────────

interface CreateDashboardPayload {
  title: string
  description?: string
  config?: ComposableDashboardConfig
  isPublic?: boolean
  tags?: string[]
}

/**
 * Mutation hook for creating a new composable dashboard.
 *
 * On success the dashboard list cache is invalidated so the new item
 * appears immediately.
 *
 * @returns TanStack Mutation with `mutate(payload)` to trigger creation.
 */
export function useCreateDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateDashboardPayload) =>
      apiFetch(BASE, dashboardDetailSchema, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

// ── Update dashboard ─────────────────────────────────────────────────────────

interface UpdateDashboardPayload {
  id: string
  title?: string
  description?: string
  config?: ComposableDashboardConfig
  isPublic?: boolean
  tags?: string[]
}

/**
 * Mutation hook for updating an existing composable dashboard.
 *
 * Creates a new version on the backend (PUT). Invalidates both the list
 * cache and the specific dashboard detail cache on success.
 *
 * @returns TanStack Mutation with `mutate(payload)` to trigger the update.
 */
export function useUpdateDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateDashboardPayload) =>
      apiFetch(`${BASE}/${id}`, dashboardDetailSchema, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data: DashboardDetail) => {
      qc.setQueryData(dashboardKeys.detail(data.id), data)
      qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}

// ── Delete dashboard ─────────────────────────────────────────────────────────

/**
 * Mutation hook for soft-deleting a composable dashboard.
 *
 * @returns TanStack Mutation with `mutate(id)` to trigger deletion.
 */
export function useDeleteDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`${BASE}/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
      }),
    onSuccess: (_: void, id: string) => {
      qc.removeQueries({ queryKey: dashboardKeys.detail(id) })
      qc.invalidateQueries({ queryKey: dashboardKeys.all })
    },
  })
}
