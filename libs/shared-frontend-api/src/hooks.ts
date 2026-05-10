import { useMemo, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { createApiClient, type ApiClientOptions, type ApiRequestOptions } from './client'
import type { ChartSeriesPoint, ManufacturingFilters, PageRequest, PageResponse } from './types'

/**
 * Options for configuring an API resource query.
 *
 * @template T - The type of data returned by the API.
 */
export interface ResourceQueryOptions<T> {
  /** API client configuration. */
  client?: ApiClientOptions
  /** Options for the fetch request. */
  request?: ApiRequestOptions
  /** Options for the React Query useQuery hook. */
  query?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
}

/**
 * Generic GET hook for generated modules and small bounded contexts.
 */
export function useApiResource<T>(
  queryKey: readonly unknown[],
  path: string,
  options: ResourceQueryOptions<T> = {},
) {
  const client = createApiClient(options.client)
  return useQuery<T>({
    queryKey,
    queryFn: () => client.get<T>(path, options.request),
    ...options.query,
  })
}

export interface EntityQueryOptions<T> extends ResourceQueryOptions<T> {
  id?: string | number | null
  enabled?: boolean
}

export function useEntityQuery<T>(
  resource: string,
  id: string | number | null | undefined,
  options: EntityQueryOptions<T> = {},
) {
  const enabled = (options.enabled ?? true) && id !== null && id !== undefined && id !== ''
  return useApiResource<T>(
    [resource, id],
    `/${resource}/${id}`,
    {
      ...options,
      query: {
        enabled,
        ...options.query,
      },
    },
  )
}

export interface EntityListOptions<T> extends ResourceQueryOptions<T[]> {
  filters?: ManufacturingFilters
}

export function useEntityListQuery<T>(resource: string, options: EntityListOptions<T> = {}) {
  return useApiResource<T[]>(
    [resource, 'list', options.filters ?? {}],
    `/${resource}`,
    {
      ...options,
      request: {
        ...options.request,
        query: { ...filtersToQuery(options.filters), ...options.request?.query },
      },
    },
  )
}

export interface EntityMutationOptions<TData, TVariables> {
  client?: ApiClientOptions
  invalidate?: readonly unknown[][]
  mutation?: UseMutationOptions<TData, Error, TVariables>
}

export function useEntityMutation<TData, TVariables extends Record<string, unknown>>(
  method: 'post' | 'patch' | 'delete',
  path: string,
  options: EntityMutationOptions<TData, TVariables> = {},
) {
  const client = createApiClient(options.client)
  const queryClient = useQueryClient()
  const { mutation: mutationOptions } = options

  return useMutation<TData, Error, TVariables>({
    ...mutationOptions,
    mutationFn: (variables) => {
      if (method === 'delete') {
        return client.delete<TData>(path, { query: variables as ApiRequestOptions['query'] })
      }
      return client[method]<TData>(path, variables)
    },
    onSuccess: async (data, variables, context) => {
      await Promise.all(
        (options.invalidate ?? []).map((key) => queryClient.invalidateQueries({ queryKey: key })),
      )
      if (mutationOptions?.onSuccess) {
        await mutationOptions.onSuccess(data, variables, context)
      }
    },
  })
}

export function usePagedEntityQuery<T>(
  resource: string,
  pageRequest: PageRequest,
  options: ResourceQueryOptions<PageResponse<T>> = {},
) {
  return useApiResource<PageResponse<T>>(
    [resource, 'page', pageRequest],
    `/${resource}`,
    {
      ...options,
      request: {
        ...options.request,
        query: {
          page: pageRequest.page ?? 1,
          page_size: pageRequest.pageSize ?? 25,
          ...options.request?.query,
        },
      },
    },
  )
}

export function useManufacturingFilters(initial: ManufacturingFilters = {}) {
  const [filters, setFilters] = useState<ManufacturingFilters>(initial)
  const query = useMemo(() => filtersToQuery(filters), [filters])
  return { filters, setFilters, query }
}

export function useChartQuery(
  resource: string,
  filters: ManufacturingFilters,
  options: ResourceQueryOptions<ChartSeriesPoint[]> = {},
) {
  return useApiResource<ChartSeriesPoint[]>(
    [resource, 'chart', filters],
    `/${resource}/chart`,
    {
      ...options,
      request: {
        ...options.request,
        query: { ...filtersToQuery(filters), ...options.request?.query },
      },
    },
  )
}

export function filtersToQuery(filters: ManufacturingFilters | undefined): ApiRequestOptions['query'] {
  return {
    plant_id: filters?.plantId ?? undefined,
    material_id: filters?.materialId ?? undefined,
    batch_id: filters?.batchId ?? undefined,
    date_from: filters?.dateFrom ?? undefined,
    date_to: filters?.dateTo ?? undefined,
    status: filters?.status ?? undefined,
  }
}
