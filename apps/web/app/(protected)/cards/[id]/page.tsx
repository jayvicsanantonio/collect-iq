'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCard, useDeleteCard, useRefreshValuation } from '@/lib/swr';
import {
  CardDetail,
  ValuationHistoryChart,
  MarketDataTable,
  type ValuationHistoryDataPoint,
  type ComparableSale,
} from '@/components/cards';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * Card Detail Page
 * Displays comprehensive card information including:
 * - Large zoomable image
 * - Card metadata and authenticity score
 * - Valuation history chart
 * - Market data sources table
 * - Action buttons (re-evaluate, delete, share)
 */
export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const cardId = params.id as string;

  // Fetch card data
  const { data: card, error, isLoading } = useCard(cardId);

  // Mutations
  const { trigger: deleteCard, isMutating: isDeleting } = useDeleteCard();
  const { trigger: refreshValuation, isMutating: isRefreshing } =
    useRefreshValuation();

  // Dialog states
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  // Mock valuation history data (in production, this would come from the API)
  const valuationHistory: ValuationHistoryDataPoint[] = React.useMemo(() => {
    if (!card) return [];

    // Generate mock historical data based on current valuation
    const now = new Date();
    const history: ValuationHistoryDataPoint[] = [];

    for (let i = 30; i >= 0; i -= 5) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Add some variance to the values
      const variance = 1 + (Math.random() - 0.5) * 0.2;

      history.push({
        date: date.toISOString(),
        low: (card.valueLow || 0) * variance,
        median: (card.valueMedian || 0) * variance,
        high: (card.valueHigh || 0) * variance,
      });
    }

    return history;
  }, [card]);

  // Mock comparable sales data (in production, this would come from the API)
  const comparableSales: ComparableSale[] = React.useMemo(() => {
    if (!card || !card.sources) return [];

    // Generate mock comparable sales
    const sales: ComparableSale[] = [];
    const conditions = [
      'Near Mint',
      'Lightly Played',
      'Moderately Played',
      'Heavily Played',
    ];

    card.sources.forEach((source, index) => {
      const date = new Date();
      date.setDate(
        date.getDate() - (index * 3 + Math.floor(Math.random() * 5))
      );

      sales.push({
        source,
        price: (card.valueMedian || 0) * (1 + (Math.random() - 0.5) * 0.3),
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        soldDate: date.toISOString(),
      });
    });

    return sales;
  }, [card]);

  // Handle re-evaluate
  const handleReEvaluate = async () => {
    try {
      await refreshValuation({ cardId, forceRefresh: true });

      toast({
        title: 'Re-evaluation started',
        description:
          'Your card is being re-evaluated. This may take a few moments.',
      });
    } catch (error) {
      toast({
        title: 'Re-evaluation failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to start re-evaluation',
        variant: 'destructive',
      });
    }
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      await deleteCard(cardId);

      toast({
        title: 'Card deleted',
        description: 'Your card has been removed from your vault.',
      });

      // Navigate back to vault
      router.push('/vault');
    } catch (error) {
      toast({
        title: 'Delete failed',
        description:
          error instanceof Error ? error.message : 'Failed to delete card',
        variant: 'destructive',
      });
    } finally {
      setShowDeleteDialog(false);
    }
  };

  // Handle share
  const handleShare = async () => {
    try {
      // Use native share API if available
      if (navigator.share) {
        await navigator.share({
          title: card?.name || 'My Card',
          text: `Check out my ${card?.name || 'card'} from ${card?.set || 'my collection'}!`,
          url: window.location.href,
        });

        toast({
          title: 'Shared successfully',
          description: 'Card link has been shared.',
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(window.location.href);

        toast({
          title: 'Link copied',
          description: 'Card link has been copied to your clipboard.',
        });
      }
    } catch (error) {
      // User cancelled or error occurred
      if (error instanceof Error && error.name !== 'AbortError') {
        toast({
          title: 'Share failed',
          description: 'Failed to share card link',
          variant: 'destructive',
        });
      }
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6">
        {/* Back button skeleton */}
        <Skeleton className="w-24 h-10" />

        {/* Card detail skeleton */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="w-full aspect-[2.5/3.5] rounded-lg" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="w-64 h-8" />
              <Skeleton className="w-48 h-4" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="w-full h-24" />
              <Skeleton className="w-full h-24" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state - 404
  if (error && error.problem?.status === 404) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <Link href="/vault">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Vault
          </Button>
        </Link>

        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Card Not Found</h2>
              <p className="text-sm text-muted-foreground">
                This card doesn't exist or has been deleted.
              </p>
            </div>
            <Link href="/vault">
              <Button>Return to Vault</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state - 403
  if (error && error.problem?.status === 403) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <Link href="/vault">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Vault
          </Button>
        </Link>

        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-sm text-muted-foreground">
                You don't have permission to view this card.
              </p>
            </div>
            <Link href="/vault">
              <Button>Return to Vault</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Generic error state
  if (error) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <Link href="/vault">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Vault
          </Button>
        </Link>

        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">
                Something Went Wrong
              </h2>
              <p className="text-sm text-muted-foreground">
                {error.problem?.detail || 'Failed to load card details'}
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Link href="/vault">
                <Button variant="outline">Return to Vault</Button>
              </Link>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No card data
  if (!card) {
    return null;
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6">
      {/* Back button */}
      <Link href="/vault">
        <Button variant="ghost">
          <ArrowLeft className="w-4 h-4" />
          Back to Vault
        </Button>
      </Link>

      {/* Card Detail */}
      <CardDetail
        card={card}
        onReEvaluate={handleReEvaluate}
        onDelete={() => setShowDeleteDialog(true)}
        onShare={handleShare}
        isLoading={{
          reEvaluate: isRefreshing,
          delete: isDeleting,
          share: false,
        }}
      />

      {/* Valuation History Chart */}
      {valuationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Valuation History</CardTitle>
            <p className="text-sm text-muted-foreground">
              Price trends over the last 30 days
            </p>
          </CardHeader>
          <CardContent>
            <ValuationHistoryChart data={valuationHistory} />
          </CardContent>
        </Card>
      )}

      {/* Market Data Sources */}
      {comparableSales.length > 0 && (
        <MarketDataTable comparables={comparableSales} />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Card</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this card? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
