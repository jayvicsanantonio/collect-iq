/**
 * SWR configuration and custom hooks for data fetching
 */

import useSWR, { type SWRConfiguration } from 'swr';
import useSWRMutation, { type SWRMutationConfiguration } from 'swr/mutation';
import type { Card, ListCardsResponse, RevalueResponse } from '@collectiq/shared';
import { getCards, getCard, deleteCard, revalueCard } from './api';

// ============================================================================
// SWR Configuration
// ============================================================================

/**
 * Default SWR configuration
 */
export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  focusThrottleInterval: 5000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  shouldRetryOnError: true,
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
 * Hook to fetch paginated list of cards
 */
export function useCards(params?: { cursor?: string; limit?: number }) {
  const key = getCardsKey(params);

  return useSWR<ListCardsResponse>(
    key,
    () => getCards(params),
    swrConfig
  );
}

/**
 * Hook to fetch a single card
 */
export function useCard(cardId: string | null) {
  const key = cardId ? getCardKey(cardId) : null;

  return useSWR<Card>(
    key,
    () => (cardId ? getCard(cardId) : Promise.reject('No card ID')),
    swrConfig
  );
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a card
 */
export function useCreateCard() {
  return useSWRMutation(
    '/cards',
    async (
      _key: string,
      { arg }: { arg: { frontS3Key: string; backS3Key?: string } }
    ) => {
      const { createCard } = await import('./api');
      return createCard(arg);
    },
    {
      // Revalidate cards list after creation
      revalidate: true,
    } as SWRMutationConfiguration<
      Card,
      Error,
      string,
      { frontS3Key: string; backS3Key?: string }
    >
  );
}

/**
 * Hook to delete a card with optimistic updates
 */
export function useDeleteCard() {
  return useSWRMutation(
    '/cards',
    async (_key: string, { arg }: { arg: string }) => {
      // arg is the cardId
      await deleteCard(arg);
      return { cardId: arg };
    },
    {
      // Optimistic update: remove card from cache immediately
      populateCache: false,
      revalidate: true,
      // On error, revalidate to restore correct state
      rollbackOnError: true,
    } as SWRMutationConfiguration<{ cardId: string }, Error, string, string>
  );
}

/**
 * Hook to refresh card valuation
 */
export function useRevalueCard() {
  return useSWRMutation(
    '/cards/revalue',
    async (
      _key: string,
      { arg }: { arg: { cardId: string; forceRefresh?: boolean } }
    ) => {
      return revalueCard(arg.cardId, { forceRefresh: arg.forceRefresh });
    },
    {
      // Revalidate the card after refresh
      revalidate: true,
    } as SWRMutationConfiguration<
      RevalueResponse,
      Error,
      string,
      { cardId: string; forceRefresh?: boolean }
    >
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
