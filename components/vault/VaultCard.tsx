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
      className="overflow-hidden transition-all cursor-pointer border-[6px] border-emerald-400/70 hover:border-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
      onClick={handleCardClick}
      style={{
        boxShadow: '0 6px 25px rgba(16, 185, 129, 0.5)',
      }}
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

        {/* Card actions - Always visible */}
        <div className="absolute top-2 right-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                className="h-9 w-9 !bg-white hover:!bg-gray-50 shadow-md border border-gray-200 hover:border-gray-300"
                onClick={(e) => e.stopPropagation()}
                style={{ backgroundColor: 'white' }}
              >
                <MoreVertical className="h-5 w-5 text-gray-700" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-white border border-gray-200 shadow-lg min-w-[200px]"
            >
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh(card.cardId);
                }}
                className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 py-2.5 px-3"
              >
                <RefreshCw className="mr-3 h-4 w-4 text-[var(--color-holo-cyan)]" />
                <span className="text-sm font-medium">Refresh Valuation</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(card.cardId);
                }}
                className="cursor-pointer hover:bg-red-50 focus:bg-red-50 text-red-600 py-2.5 px-3"
              >
                <Trash2 className="mr-3 h-4 w-4" />
                <span className="text-sm font-medium">Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Only show card details if we have meaningful data */}
      {(card.name ||
        card.set ||
        card.valueMedian !== undefined ||
        card.authenticityScore !== undefined) && (
        <CardContent className="p-4">
          {card.name && <h3 className="font-semibold text-base truncate mb-1">{card.name}</h3>}
          {(card.set || card.number) && (
            <p className="text-sm text-[var(--muted-foreground)] truncate mb-2">
              {card.set}
              {card.number && ` #${card.number}`}
            </p>
          )}
          {(card.valueMedian !== undefined || card.authenticityScore !== undefined) && (
            <div className="flex items-center justify-between">
              {card.valueMedian !== undefined && (
                <span className="text-lg font-bold text-[var(--vault-blue)]">
                  {formatCurrency(card.valueMedian)}
                </span>
              )}
              {card.authenticityScore !== undefined && (
                <span className="text-xs text-[var(--muted-foreground)]">
                  {Math.round(card.authenticityScore * 100)}% Auth
                </span>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
