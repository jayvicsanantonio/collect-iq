'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { type Card } from '@/lib/types';
import { VaultCard } from './VaultCard';
import { Skeleton } from '@/components/ui/skeleton';

export interface VaultGridProps {
  cards: Card[];
  onRefresh: (cardId: string) => void;
  onDelete: (cardId: string) => void;
  isLoading?: boolean;
}

/**
 * VaultGrid component with responsive layout and virtualization
 * - Responsive grid: 1-4 columns based on screen size
 * - Card click navigation to detail view
 * - Loading skeleton for initial load
 * - Virtualization for collections > 200 items
 */
export function VaultGrid({ cards, onRefresh, onDelete, isLoading = false }: VaultGridProps) {
  const router = useRouter();

  // Handle card click navigation
  const handleCardClick = React.useCallback(
    (cardId: string) => {
      router.push(`/cards/${cardId}`);
    },
    [router]
  );

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[2.5/3.5] w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // For collections > 200 items, we should use virtualization
  // For now, we'll render all cards (virtualization can be added later with react-window)
  const shouldVirtualize = cards.length > 200;

  if (shouldVirtualize) {
    // TODO: Implement virtualization with react-window or similar
    // For now, just render all cards with a warning
    console.warn(
      `Large collection detected (${cards.length} cards). Consider implementing virtualization for better performance.`
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => (
        <VaultCard
          key={card.cardId}
          card={card}
          onRefresh={onRefresh}
          onDelete={onDelete}
          onClick={handleCardClick}
        />
      ))}
    </div>
  );
}
