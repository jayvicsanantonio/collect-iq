'use client';

import * as React from 'react';
import Image from 'next/image';
import { type Card as CardType } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreVertical, RefreshCw, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCardImage } from '@/hooks/use-card-image';

export interface VaultCardProps {
  card: CardType;
  onRefresh: (cardId: string) => void;
  onDelete: (cardId: string) => void;
  onClick?: (cardId: string) => void;
}

export function VaultCard({ card, onRefresh, onDelete, onClick }: VaultCardProps) {
  const { imageUrl, isLoading: imageLoading, error: imageError } = useCardImage(card.frontS3Key);

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on the dropdown menu
    if (
      (e.target as HTMLElement).closest('[role="menu"]') ||
      (e.target as HTMLElement).closest('button')
    ) {
      return;
    }
    onClick?.(card.cardId);
  };

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="relative aspect-[2.5/3.5] bg-[var(--muted)]">
        {/* Card Image */}
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--muted)] border-t-[var(--color-holo-cyan)]" />
          </div>
        )}
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--muted-foreground)] text-sm p-4 text-center">
            Failed to load image
          </div>
        )}
        {imageUrl && !imageError && (
          <Image
            src={imageUrl}
            alt={card.name || 'Card image'}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        )}

        {/* Card actions */}
        <div className="absolute top-2 right-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-white/90"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh(card.cardId);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Valuation
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(card.cardId);
                }}
                className="text-[var(--crimson-red)]"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-base truncate mb-1">{card.name || 'Unknown Card'}</h3>
        <p className="text-sm text-[var(--muted-foreground)] truncate mb-2">
          {card.set || 'Unknown Set'}
          {card.number && ` #${card.number}`}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-[var(--vault-blue)]">
            {formatCurrency(card.valueMedian)}
          </span>
          {card.authenticityScore !== undefined && (
            <span className="text-xs text-[var(--muted-foreground)]">
              {Math.round(card.authenticityScore * 100)}% Auth
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
