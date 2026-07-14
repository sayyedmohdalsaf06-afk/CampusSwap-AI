import { QueryClient } from "@tanstack/react-query";

/**
 * Shared TanStack Query client. Defaults tuned for a mobile marketplace feed:
 * modest stale time and a single retry to avoid hammering PostgREST on flaky
 * networks.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
