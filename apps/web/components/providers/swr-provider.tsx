/**
 * SWR Provider component
 * Wraps the app with SWR configuration and cache invalidation strategies
 */

'use client';

import { SWRConfig } from 'swr';
import { swrConfig } from '@/lib/swr';

interface SWRProviderProps {
  children: React.ReactNode;
}

/**
 * Enhanced SWR Provider with cache invalidation on mutations
 *
 * Implements stale-while-revalidate strategy:
 * - Serves cached data immediately for fast UI
 * - Revalidates in background to keep data fresh
 * - Invalidates related caches on mutations
 */
export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        ...swrConfig,
        // Global error handler
        onError: (error, key) => {
          console.error('SWR Error:', { key, error });
        },
        // Global success handler
        onSuccess: (data, key) => {
          // Log successful cache updates in development
          if (process.env.NODE_ENV === 'development') {
            console.debug('SWR Cache Updated:', { key });
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
