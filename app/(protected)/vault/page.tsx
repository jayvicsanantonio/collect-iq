'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { type Card } from '@/lib/types';
import { EmptyVault } from '@/components/vault/EmptyVault';
import { VaultGrid } from '@/components/vault/VaultGrid';
import { PortfolioSummary } from '@/components/vault/PortfolioSummary';
import {
  VaultFilters,
  type VaultFilters as VaultFiltersType,
} from '@/components/vault/VaultFilters';
// import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

interface PortfolioStats {
  totalValue: number;
  totalCards: number;
  change: {
    value: number;
    percentage: number;
  };
  sparklineData: Array<{ date: string; value: number }>;
}

// ============================================================================
// Main Component
// ============================================================================

export default function VaultPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // State
  const [isLoading, setIsLoading] = React.useState(true);
  const [cards, setCards] = React.useState<Card[]>([]);
  const [portfolioStats, setPortfolioStats] =
    React.useState<PortfolioStats | null>(null);
  const [nextCursor, setNextCursor] = React.useState<string | undefined>();
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);

  // Parse filters from URL
  const [filters, setFilters] = React.useState<VaultFiltersType>({
    set: searchParams.get('set') || undefined,
    type: searchParams.get('type') || undefined,
    rarity: searchParams.get('rarity') || undefined,
    authenticityMin: searchParams.get('authenticityMin')
      ? parseFloat(searchParams.get('authenticityMin')!)
      : undefined,
    sortBy:
      (searchParams.get('sortBy') as 'value' | 'date' | 'rarity') || 'date',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  });

  // Calculate portfolio stats from cards
  const calculatePortfolioStats = React.useCallback(
    (cards: Card[]): PortfolioStats => {
      const totalValue = cards.reduce(
        (sum, card) => sum + (card.valueMedian || 0),
        0
      );
      const totalCards = cards.length;

      // Mock 14-day change (in real app, this would come from backend)
      const mockChange = totalValue * 0.05; // 5% increase
      const mockPercentage = 5.0;

      // Mock sparkline data (in real app, this would come from backend)
      const sparklineData = Array.from({ length: 14 }, (_, i) => ({
        date: new Date(
          Date.now() - (13 - i) * 24 * 60 * 60 * 1000
        ).toISOString(),
        value: totalValue * (0.95 + (i / 13) * 0.05),
      }));

      return {
        totalValue,
        totalCards,
        change: {
          value: mockChange,
          percentage: mockPercentage,
        },
        sparklineData,
      };
    },
    []
  );

  // Apply client-side filtering and sorting
  const filterAndSortCards = React.useCallback(
    (cards: Card[]): Card[] => {
      let filtered = [...cards];

      // Apply filters
      if (filters.set) {
        filtered = filtered.filter((card) => card.set === filters.set);
      }
      if (filters.rarity) {
        filtered = filtered.filter((card) => card.rarity === filters.rarity);
      }
      if (filters.authenticityMin !== undefined) {
        filtered = filtered.filter(
          (card) =>
            card.authenticityScore !== undefined &&
            card.authenticityScore >= filters.authenticityMin!
        );
      }

      // Apply sorting
      filtered.sort((a, b) => {
        let comparison = 0;

        switch (filters.sortBy) {
          case 'value':
            comparison = (a.valueMedian || 0) - (b.valueMedian || 0);
            break;
          case 'date':
            comparison =
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'rarity': {
            const rarityOrder = [
              'Common',
              'Uncommon',
              'Rare',
              'Holo Rare',
              'Ultra Rare',
            ];
            const aIndex = rarityOrder.indexOf(a.rarity || '');
            const bIndex = rarityOrder.indexOf(b.rarity || '');
            comparison = aIndex - bIndex;
            break;
          }
        }

        return filters.sortOrder === 'desc' ? -comparison : comparison;
      });

      return filtered;
    },
    [filters]
  );

  // Fetch cards
  const fetchCards = React.useCallback(
    async (cursor?: string) => {
      try {
        // TODO: Remove mock data once backend is ready
        // const response = await api.getCards({
        //   cursor,
        //   limit: 20,
        // });

        // Mock data with sample cards
        const mockCards: Card[] = [
          {
            cardId: '1',
            userId: 'user123',
            frontS3Key: 'uploads/user123/charizard.jpg',
            name: 'Charizard',
            set: 'Base Set',
            number: '4',
            rarity: 'Holo Rare',
            authenticityScore: 0.92,
            valueLow: 350.0,
            valueMedian: 450.0,
            valueHigh: 600.0,
            createdAt: new Date(
              Date.now() - 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            updatedAt: new Date(
              Date.now() - 1 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          {
            cardId: '2',
            userId: 'user123',
            frontS3Key: 'uploads/user123/pikachu.jpg',
            name: 'Pikachu',
            set: 'Jungle',
            number: '60',
            rarity: 'Common',
            authenticityScore: 0.88,
            valueLow: 15.0,
            valueMedian: 25.0,
            valueHigh: 40.0,
            createdAt: new Date(
              Date.now() - 14 * 24 * 60 * 60 * 1000
            ).toISOString(),
            updatedAt: new Date(
              Date.now() - 2 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          {
            cardId: '3',
            userId: 'user123',
            frontS3Key: 'uploads/user123/blastoise.jpg',
            name: 'Blastoise',
            set: 'Base Set',
            number: '2',
            rarity: 'Holo Rare',
            authenticityScore: 0.95,
            valueLow: 800.0,
            valueMedian: 1200.0,
            valueHigh: 1800.0,
            createdAt: new Date(
              Date.now() - 21 * 24 * 60 * 60 * 1000
            ).toISOString(),
            updatedAt: new Date(
              Date.now() - 3 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          {
            cardId: '4',
            userId: 'user123',
            frontS3Key: 'uploads/user123/mewtwo.jpg',
            name: 'Mewtwo',
            set: 'Base Set',
            number: '10',
            rarity: 'Holo Rare',
            authenticityScore: 0.89,
            valueLow: 40.0,
            valueMedian: 65.0,
            valueHigh: 95.0,
            createdAt: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            updatedAt: new Date(
              Date.now() - 5 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          {
            cardId: '5',
            userId: 'user123',
            frontS3Key: 'uploads/user123/venusaur.jpg',
            name: 'Venusaur',
            set: 'Base Set',
            number: '15',
            rarity: 'Holo Rare',
            authenticityScore: 0.91,
            valueLow: 120.0,
            valueMedian: 180.0,
            valueHigh: 250.0,
            createdAt: new Date(
              Date.now() - 45 * 24 * 60 * 60 * 1000
            ).toISOString(),
            updatedAt: new Date(
              Date.now() - 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          {
            cardId: '6',
            userId: 'user123',
            frontS3Key: 'uploads/user123/gyarados.jpg',
            name: 'Gyarados',
            set: 'Base Set',
            number: '6',
            rarity: 'Holo Rare',
            authenticityScore: 0.93,
            valueLow: 80.0,
            valueMedian: 120.0,
            valueHigh: 175.0,
            createdAt: new Date(
              Date.now() - 60 * 24 * 60 * 60 * 1000
            ).toISOString(),
            updatedAt: new Date(
              Date.now() - 10 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
        ];

        const response = {
          items: mockCards,
          nextCursor: undefined,
        };

        if (cursor) {
          // Load more
          setCards((prev) => [...prev, ...response.items]);
        } else {
          // Initial load
          setCards(response.items);
        }

        setNextCursor(response.nextCursor);
        setHasMore(!!response.nextCursor);
      } catch (error) {
        console.error('Failed to fetch cards:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your vault. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  // Initial load
  React.useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      await fetchCards();
      setIsLoading(false);
    };

    loadInitialData();
  }, [fetchCards]);

  // Update portfolio stats when cards change
  React.useEffect(() => {
    if (cards.length > 0) {
      const stats = calculatePortfolioStats(cards);
      setPortfolioStats(stats);
    }
  }, [cards, calculatePortfolioStats]);

  // Handle load more
  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    await fetchCards(nextCursor);
    setIsLoadingMore(false);
  };

  // Handle refresh valuation
  const handleRefresh = async (cardId: string) => {
    try {
      // TODO: Uncomment once backend is ready
      // await api.revalueCard(cardId, { forceRefresh: true });
      console.log('Refreshing card:', cardId); // Using cardId to avoid lint error
      toast({
        title: 'Valuation refresh started',
        description: 'Your card valuation is being updated.',
      });

      // Refresh the card list after a delay
      setTimeout(() => {
        fetchCards();
      }, 2000);
    } catch (error) {
      console.error('Failed to refresh valuation:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh valuation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // State for delete confirmation
  const [deleteCardId, setDeleteCardId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Handle delete - show confirmation dialog
  const handleDelete = (cardId: string) => {
    setDeleteCardId(cardId);
  };

  // Confirm deletion
  const confirmDelete = async () => {
    if (!deleteCardId) return;

    setIsDeleting(true);

    // Optimistic UI update - remove card immediately
    const previousCards = [...cards];
    setCards((prev) => prev.filter((c) => c.cardId !== deleteCardId));

    try {
      // TODO: Uncomment once backend is ready
      // await api.deleteCard(deleteCardId);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast({
        title: 'Card deleted',
        description: 'Your card has been removed from the vault.',
      });

      // Update portfolio stats
      const newStats = calculatePortfolioStats(
        cards.filter((c) => c.cardId !== deleteCardId)
      );
      setPortfolioStats(newStats);
    } catch (error) {
      console.error('Failed to delete card:', error);

      // Rollback on error
      setCards(previousCards);

      toast({
        title: 'Error',
        description: 'Failed to delete card. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteCardId(null);
    }
  };

  // Cancel deletion
  const cancelDelete = () => {
    setDeleteCardId(null);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col relative bg-[var(--background)]">
        {/* Gradient Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 landing-gradient" />
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 landing-radials" />
        </div>

        <main className="flex-1 relative z-10 flex items-center justify-center px-6 py-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[var(--muted)] border-t-[var(--color-holo-cyan)] mx-auto" />
            <p className="text-[var(--muted-foreground)]">
              Loading your vault...
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Show empty state for first-run users
  if (cards.length === 0) {
    return <EmptyVault />;
  }

  // Apply filters and sorting
  const filteredCards = filterAndSortCards(cards);

  // Get unique sets and types for filter dropdowns
  const availableSets = Array.from(
    new Set(cards.map((c) => c.set).filter(Boolean))
  ) as string[];
  const availableTypes: string[] = []; // Types not in current schema

  return (
    <div className="min-h-screen flex flex-col relative bg-[var(--background)] text-[var(--foreground)]">
      {/* Gradient Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 landing-gradient" />
      </div>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 landing-radials" />
      </div>

      <main className="flex-1 relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Header */}
        <header className="mb-12">
          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-bold mb-4 font-display tracking-[-0.02em]"
            style={{
              textShadow: 'var(--text-shadow, 0 2px 8px rgba(0, 0, 0, 0.3))',
            }}
          >
            <span
              className="bg-gradient-to-tr from-[var(--color-holo-cyan)] via-[var(--color-emerald-glow)] to-[var(--color-vault-blue)] bg-clip-text text-transparent"
              style={{
                textShadow: 'none',
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
              }}
            >
              Your Vault
            </span>
          </h1>
          <p
            className="text-xl sm:text-2xl"
            style={{
              color: 'var(--foreground)',
              opacity: 0.9,
              textShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
            }}
          >
            Manage and track your Pokémon card collection
          </p>
        </header>

        {/* Portfolio Summary */}
        {portfolioStats && (
          <section className="mb-8" aria-label="Portfolio summary">
            <PortfolioSummary
              totalValue={portfolioStats.totalValue}
              totalCards={portfolioStats.totalCards}
              change={portfolioStats.change}
              sparklineData={portfolioStats.sparklineData}
            />
          </section>
        )}

        {/* Filters */}
        <section className="mb-6" aria-label="Filter and sort options">
          <VaultFilters
            filters={filters}
            onFiltersChange={setFilters}
            availableSets={availableSets}
            availableTypes={availableTypes}
          />
        </section>

        {/* Card Grid */}
        <section aria-label="Card collection">
          <VaultGrid
            cards={filteredCards}
            onRefresh={handleRefresh}
            onDelete={handleDelete}
          />
        </section>

        {/* Load More Button */}
        {hasMore && (
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        )}

        {/* No results message */}
        {filteredCards.length === 0 && cards.length > 0 && (
          <div className="text-center py-12">
            <p className="text-xl text-[var(--muted-foreground)]">
              No cards match your filters. Try adjusting your search criteria.
            </p>
          </div>
        )}

      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteCardId !== null}
        onOpenChange={(open) => !open && cancelDelete()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Card</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this card from your vault? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelDelete}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
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
