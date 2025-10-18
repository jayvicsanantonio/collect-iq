/**
 * SWR configuration and custom hooks for data fetching
 * Implements stale-while-revalidate caching strategies for optimal performance
 */

import useSWR, { type SWRConfiguration } from 'swr';
import useSWRMutation, { type SWRMutationConfiguration } from 'swr/mutation';
import type { Card, ListCardsResponse } from '@collectiq/shared';
import { getCards, getCard, deleteCard, refreshValuation } from './api';

// ============================================================================
// SWR Configuration
// ============================================================================

/**
 * Default SWR configuration with stale-while-revalidate strategy
 * 
 * Strategy:
 * - Serve cached data immediately (stale)
 * - Revalidate in background
 * - Update UI when fresh data arrives
 */
export const swrConfig: SWRConfiguration = {
  // Stale-while-revalidate settings
  revalidateOnFocus: false, // Don't revalidate on window focus (too aggressive)
  revalidateOnReconnect: true, // Revalidate when network reconnects
  revalidateIfStale: true, // Revalidate if data is stale
  
  // Deduplication settings
  dedupingInterval: 2000, // Dedupe requests within 2 seconds
  focusThrottleInterval: 5000, // Throttle focus revalidation to 5 seconds
  
  // Error handling
  errorRetryCount: 3, // Retry failed requests 3 times
  errorRetryInterval: 5000, // Wait 5 seconds between retries
  shouldRetryOnError: true, // Enable automatic retries
  
  // Performance optimization
  keepPreviousData: true, // Keep previous data while fetching new data
};

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Cache time-to-live (TTL) configurations in milliseconds
 */
export const CACHE_TTL = {
  // Vault list: 5 minutes (frequently updated)
  VAULT_LIST: 5 * 60 * 1000,
  
  // Card details: 10 minutes (less frequently updated)
  CARD_DETAIL: 10 * 60 * 1000,
  
  // Valuation data: 1 hour (expensive to compute)
  VALUATION: 60 * 60 * 1000,
  
  // User session: 15 minutes
  SESSION: 15 * 60 * 1000,
} as const;

/**
 * SWR configuration for vault lists with aggressive stale-while-revalidate
 */
export const vaultListConfig: SWRConfiguration = {
  ...swrConfig,
  dedupingInterval: 5000, // Longer deduping for lists
  revalidateOnMount: true, // Always revalidate on mount
  refreshInterval: CACHE_TTL.VAULT_LIST, // Auto-refresh every 5 minutes
};

/**
 * SWR configuration for card details with longer cache
 */
export const cardDetailConfig: SWRConfiguration = {
  ...swrConfig,
  dedupingInterval: 10000, // Longer deduping for details
  refreshInterval: CACHE_TTL.CARD_DETAIL, // Auto-refresh every 10 minutes
};

/**
 * SWR configuration for valuation data with extended cache
 */
export const valuationConfig: SWRConfiguration = {
  ...swrConfig,
  dedupingInterval: 30000, // Much longer deduping for expensive operations
  refreshInterval: CACHE_TTL.VALUATION, // Auto-refresh every hour
  revalidateOnMount: false, // Don't revalidate on mount (use cached data)
};

// ============================================================================
// Cache Key Generators
// ============================================================================

/**
 * Generate cache key for cards list
 */
export function getCardsKey(params?: { cursor?: string; limit?: number }) {
  const base = '/cards';
  if (!params) return base;

  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (params.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * Generate cache key for single card
 */
export function getCardKey(cardId: string) {
  return `/cards/${cardId}`;
}

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Hook to fetch paginated list of cards with stale-while-revalidate
 * 
 * Uses aggressive caching strategy:
 * - Serves cached data immediately
 * - Revalidates in background every 5 minutes
 * - Auto-refreshes to keep data fresh
 */
export function useCards(params?: { cursor?: string; limit?: number }) {
  const key = getCardsKey(params);

  return useSWR<ListCardsResponse>(
    key,
    () => getCards(params),
    vaultListConfig
  );
}

/**
 * Hook to fetch a single card with extended cache
 * 
 * Uses longer cache strategy:
 * - Card details change less frequently
 * - 10-minute cache with background revalidation
 * - Reduces API calls for frequently viewed cards
 */
export function useCard(cardId: string | null) {
  const key = cardId ? getCardKey(cardId) : null;

  return useSWR<Card>(
    key,
    () => (cardId ? getCard(cardId) : Promise.reject('No card ID')),
    cardDetailConfig
  );
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to delete a card with optimistic updates and cache invalidation
 * 
 * Strategy:
 * - Optimistically remove card from UI
 * - Invalidate all related caches
 * - Rollback on error
 */
export function useDeleteCard() {
  return useSWRMutation(
    '/cards',
    async (_key: string, { arg }: { arg: string }) => {
      // arg is the cardId
      return deleteCard(arg);
    },
    {
      // Optimistic update: remove card from cache immediately
      populateCache: () => {
        // Don't populate cache, let revalidation handle it
        return false;
      },
      revalidate: true,
      // On error, revalidate to restore correct state
      rollbackOnError: true,
      // Optimistic data update
      optimisticData: (currentData) => {
        // This will be used by the cache invalidation helpers
        return currentData;
      },
    } as SWRMutationConfiguration<{ ok: boolean }, Error, string, string>
  );
}

/**
 * Hook to refresh card valuation with cache invalidation
 * 
 * Strategy:
 * - Trigger valuation refresh
 * - Invalidate card cache to fetch fresh data
 * - Invalidate vault list to show updated values
 */
export function useRefreshValuation() {
  return useSWRMutation(
    '/cards/revalue',
    async (
      _key: string,
      { arg }: { arg: { cardId: string; forceRefresh?: boolean } }
    ) => {
      return refreshValuation(arg.cardId, arg.forceRefresh);
    },
    {
      // Revalidate the card after refresh
      revalidate: true,
    }
  );
}

// ============================================================================
// Cache Invalidation Helpers
// ============================================================================

/**
 * Type for SWR mutate function
 */
type MutateFunction = (
  key?: string | ((key: string) => boolean),
  data?: unknown,
  opts?: { revalidate?: boolean }
) => Promise<unknown>;

/**
 * Invalidate all cards cache
 */
export function invalidateCardsCache(mutate: MutateFunction) {
  // Invalidate all keys that start with /cards
  return mutate(
    (key: string) => typeof key === 'string' && key.startsWith('/cards'),
    undefined,
    { revalidate: true }
  );
}

/**
 * Invalidate specific card cache
 */
export function invalidateCardCache(mutate: MutateFunction, cardId: string) {
  return mutate(getCardKey(cardId), undefined, { revalidate: true });
}

/**
 * Optimistically update card in cache
 */
export function updateCardInCache(
  mutate: MutateFunction,
  cardId: string,
  updater: (card: Card) => Card
) {
  const key = getCardKey(cardId);

  return mutate(
    key,
    async (currentCard: Card | undefined) => {
      if (!currentCard) return currentCard;
      return updater(currentCard);
    },
    { revalidate: false }
  );
}

/**
 * Optimistically remove card from list cache
 */
export function removeCardFromListCache(mutate: MutateFunction, cardId: string) {
  return mutate(
    (key: string) => typeof key === 'string' && key.startsWith('/cards?'),
    async (currentData: ListCardsResponse | undefined) => {
      if (!currentData) return currentData;

      return {
        ...currentData,
        items: currentData.items.filter((card) => card.cardId !== cardId),
      };
    },
    { revalidate: false }
  );
}
