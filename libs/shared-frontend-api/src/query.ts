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
