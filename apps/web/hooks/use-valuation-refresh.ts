/**
 * Hook for managing valuation refresh functionality
 */

import { useState } from 'react';
import { revalueCard } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import type { RevalueResponse } from '@collectiq/shared';

export interface UseValuationRefreshOptions {
  cardId: string;
  onSuccess?: (response: RevalueResponse) => void;
  onError?: (error: Error) => void;
}

export function useValuationRefresh({
  cardId,
  onSuccess,
  onError,
}: UseValuationRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = async (forceRefresh = false) => {
    setIsRefreshing(true);

    try {
      const response = await revalueCard(cardId, { forceRefresh });

      // Show success toast
      toast({
        title: 'Valuation refresh started',
        description:
          'Your card valuation is being updated. This may take a few moments.',
      });

      onSuccess?.(response);

      return response;
    } catch (error) {
      // Show error toast
      toast({
        title: 'Refresh failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to refresh valuation. Please try again.',
        variant: 'destructive',
      });

      onError?.(error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    refresh,
    isRefreshing,
  };
}
