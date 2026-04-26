/**
 * Standard configuration for TanStack Query (React Query) clients.
 * Optimized for Databricks App performance (caching, retries).
 */
export const queryClientDefaultOptions = {
  queries: {
    retry: 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: 0,
  },
};
