'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { RefreshCw, Trash2, Share2, ArrowLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { Card as CardType } from '@/lib/types';
import {
  CardProcessing,
  type ProcessingStage,
} from '@/components/cards/CardProcessing';
import { CardDetail } from '@/components/cards/CardDetail';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorAlert } from '@/components/ui/error-alert';

// ============================================================================
// Types
// ============================================================================

type PageState =
  | { type: 'loading' }
  | { type: 'processing'; card: CardType }
  | { type: 'complete'; card: CardType }
  | { type: 'error'; error: string; canRetry: boolean };

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine if a card is still processing based on its data
 */
function isCardProcessing(card: CardType): boolean {
  // Card is processing if any of these fields are missing
  return (
    card.authenticityScore === null ||
    card.authenticityScore === undefined ||
    card.valueLow === null ||
    card.valueLow === undefined
  );
}

/**
 * Determine the current processing stage based on card data
 */
function getCurrentStage(card: CardType): ProcessingStage {
  // If we have no name/set, we're still in extraction
  if (!card.name || !card.set) {
    return 'extraction';
  }

  // If we have name/set but no authenticity score, we're in authenticity
  if (
    card.authenticityScore === null ||
    card.authenticityScore === undefined
  ) {
    return 'authenticity';
  }

  // If we have authenticity but no valuation, we're in valuation
  if (card.valueLow === null || card.valueLow === undefined) {
    return 'valuation';
  }

  // All done
  return 'valuation';
}

/**
 * Determine which stages are completed based on card data
 */
function getCompletedStages(card: CardType): ProcessingStage[] {
  const completed: ProcessingStage[] = [];

  // Extraction is complete if we have name and set
  if (card.name && card.set) {
    completed.push('extraction');
  }

  // Authenticity is complete if we have a score
  if (
    card.authenticityScore !== null &&
    card.authenticityScore !== undefined
  ) {
    completed.push('authenticity');
  }

  // Valuation is complete if we have pricing data
  if (card.valueLow !== null && card.valueLow !== undefined) {
    completed.push('valuation');
  }

  return completed;
}

/**
 * Estimate time remaining based on current stage
 */
function estimateTimeRemaining(stage: ProcessingStage): number {
  const estimates: Record<ProcessingStage, number> = {
    extraction: 20, // 5s for extraction + 8s for auth + 10s for valuation - 3s elapsed
    authenticity: 18, // 8s for auth + 10s for valuation
    valuation: 10, // 10s for valuation
  };
  return estimates[stage];
}

// ============================================================================
// Component
// ============================================================================

export default function CardPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const cardId = params.id as string;

  const [state, setState] = React.useState<PageState>({
    type: 'loading',
  });
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(
    null
  );

  // ============================================================================
  // Fetch Card Data
  // ============================================================================

  const fetchCard = React.useCallback(async () => {
    try {
      const card = await api.getCard(cardId);

      // Check if card is still processing
      if (isCardProcessing(card)) {
        setState({ type: 'processing', card });
      } else {
        setState({ type: 'complete', card });
      }
    } catch (error) {
      console.error('Failed to fetch card:', error);

      let errorMessage = 'Failed to load card. Please try again.';
      let canRetry = true;

      if (error instanceof ApiError) {
        if (error.status === 404) {
          errorMessage = 'Card not found.';
          canRetry = false;
        } else if (error.status === 403) {
          errorMessage = "You don't have access to this card.";
          canRetry = false;
        } else {
          errorMessage =
            error.problem?.detail ||
            error.problem?.title ||
            error.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setState({ type: 'error', error: errorMessage, canRetry });
    }
  }, [cardId]);

  // ============================================================================
  // Polling Logic
  // ============================================================================

  React.useEffect(() => {
    // Initial fetch
    fetchCard();

    // Set up polling if card is processing
    if (state.type === 'processing') {
      pollingIntervalRef.current = setInterval(() => {
        fetchCard();
      }, 3000); // Poll every 3 seconds
    }

    // Cleanup polling on unmount or when processing completes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [fetchCard, state.type]);

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const handleRetryAnalysis = React.useCallback(async () => {
    try {
      toast({
        title: 'Retrying analysis',
        description: 'Triggering new analysis...',
      });

      await api.revalueCard(cardId, { forceRefresh: true });

      // Reset to loading state and start polling
      setState({ type: 'loading' });
      setTimeout(() => {
        fetchCard();
      }, 1000);
    } catch (error) {
      console.error('Failed to retry analysis:', error);

      let errorMessage =
        'Failed to retry analysis. Please try again.';
      if (error instanceof ApiError) {
        errorMessage =
          error.problem?.detail ||
          error.problem?.title ||
          error.message;
      }

      toast({
        variant: 'destructive',
        title: 'Retry failed',
        description: errorMessage,
      });
    }
  }, [cardId, fetchCard, toast]);

  const handleManualRefresh = React.useCallback(() => {
    fetchCard();
  }, [fetchCard]);

  const handleDelete = React.useCallback(async () => {
    if (!confirm('Are you sure you want to delete this card?')) {
      return;
    }

    try {
      await api.deleteCard(cardId);

      toast({
        title: 'Card deleted',
        description: 'Card has been removed from your vault.',
      });

      // Redirect to vault
      router.push('/vault' as Route);
    } catch (error) {
      console.error('Failed to delete card:', error);

      let errorMessage = 'Failed to delete card. Please try again.';
      if (error instanceof ApiError) {
        errorMessage =
          error.problem?.detail ||
          error.problem?.title ||
          error.message;
      }

      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: errorMessage,
      });
    }
  }, [cardId, router, toast]);

  const handleShare = React.useCallback(() => {
    const url = window.location.href;

    // Use native share API if available
    if (navigator.share) {
      navigator
        .share({
          title: 'Check out my card',
          url,
        })
        .catch((error) => {
          console.error('Share failed:', error);
        });
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(url).then(() => {
        toast({
          title: 'Link copied',
          description: 'Card link copied to clipboard.',
        });
      });
    }
  }, [toast]);

  const handleBackToVault = React.useCallback(() => {
    router.push('/vault' as Route);
  }, [router]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToVault}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Vault
        </Button>

        {state.type === 'complete' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="gap-2 text-[var(--destructive)] hover:text-[var(--destructive)]"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {state.type === 'loading' && (
        <div className="space-y-4">
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      )}

      {/* Processing State */}
      {state.type === 'processing' && (
        <div className="space-y-6">
          <CardProcessing
            status={{
              stage: getCurrentStage(state.card),
              completed: getCompletedStages(state.card),
              estimatedTimeRemaining: estimateTimeRemaining(
                getCurrentStage(state.card)
              ),
            }}
            onRetry={handleRetryAnalysis}
          />

          {/* Show partial card details if available */}
          {state.card.name && (
            <div className="text-center text-[var(--muted-foreground)]">
              <p className="text-sm">
                Analyzing:{' '}
                <span className="font-medium">{state.card.name}</span>
                {state.card.set && ` from ${state.card.set}`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Complete State */}
      {state.type === 'complete' && (
        <div className="space-y-6">
          <CardDetail card={state.card} />
        </div>
      )}

      {/* Error State */}
      {state.type === 'error' && (
        <ErrorAlert
          title="Failed to load card"
          message={state.error}
          onRetry={state.canRetry ? handleManualRefresh : undefined}
        />
      )}
    </div>
  );
}
