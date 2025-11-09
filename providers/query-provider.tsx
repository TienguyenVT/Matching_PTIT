'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // ✅ Stale-while-revalidate: Show cached data immediately
        staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
        gcTime: 10 * 60 * 1000, // Keep unused cache for 10 minutes
        
        // ✅ Request Cancellation: Auto-cancel old requests
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: false, // Don't refetch if data exists
        
        // ✅ Background Revalidation
        // staleTime: 30 * 1000, // Data becomes stale after 30s (overridden by the first staleTime)
        refetchInterval: false, // Don't poll by default
        
        retry: 1,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        // ✅ Retry failed mutations
        retry: 2,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
