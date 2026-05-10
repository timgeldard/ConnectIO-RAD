import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query'

export interface CodexQueryState<TData> {
  data: TData | undefined
  isLoading: boolean
  isError: boolean
  errorMessage: string | null
  isEmpty: boolean
  refetch: () => void
}

export function normalizeQueryError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unable to load report data.'
}

export function useCodexQuery<TData>(
  options: UseQueryOptions<TData, unknown, TData, QueryKey>
): CodexQueryState<TData> {
  const query = useQuery(options)
  const data = query.data
  // Arrays are empty when length is 0; scalar responses are empty when null/undefined.
  const isEmpty = Array.isArray(data) ? data.length === 0 : data == null

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    errorMessage: query.error ? normalizeQueryError(query.error) : null,
    isEmpty,
    refetch: () => { void query.refetch() },
  }
}
