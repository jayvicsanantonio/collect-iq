'use client';

import * as React from 'react';
import { Card as CardType } from '@collectiq/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreVertical, RefreshCw, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface VaultCardProps {
  card: CardType;
  onRefresh: (cardId: string) => void;
  onDelete: (cardId: string) => void;
}

export function VaultCard({ card, onRefresh, onDelete }: VaultCardProps) {
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 cursor-pointer border-2 border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:border-[var(--color-vault-blue)] hover:shadow-xl hover:scale-[1.02]">
      <div className="relative aspect-[2.5/3.5] bg-gradient-to-br from-[var(--muted)] to-[var(--muted)]/50">
        {/* Placeholder for card image */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-6xl opacity-20">🎴</div>
        </div>

        {/* Card actions */}
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-[var(--card)]/95 backdrop-blur-sm border border-[var(--border)] hover:bg-[var(--card)]"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRefresh(card.cardId)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Valuation
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(card.cardId)}
                className="text-[var(--crimson-red)]"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Authenticity badge */}
        {card.authenticityScore !== undefined && (
          <div className="absolute top-2 left-2">
            <div
              className={`px-2 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${
                card.authenticityScore >= 0.9
                  ? 'bg-[var(--emerald-glow)]/20 text-[var(--emerald-glow)] border border-[var(--emerald-glow)]/30'
                  : card.authenticityScore >= 0.8
                    ? 'bg-[var(--holo-cyan)]/20 text-[var(--holo-cyan)] border border-[var(--holo-cyan)]/30'
                    : 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
              }`}
            >
              {Math.round(card.authenticityScore * 100)}%
            </div>
          </div>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-lg truncate mb-1 font-display">
            {card.name || 'Unknown Card'}
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] truncate">
            {card.set || 'Unknown Set'}
            {card.number && ` #${card.number}`}
          </p>
          {card.rarity && (
            <p className="text-xs text-[var(--muted-foreground)] truncate mt-1">
              {card.rarity}
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--muted-foreground)]">
              Market Value
            </span>
            <span className="text-xl font-bold bg-gradient-to-r from-[var(--color-vault-blue)] to-[var(--color-holo-cyan)] bg-clip-text text-transparent">
              {formatCurrency(card.valueMedian)}
            </span>
          </div>
          {card.valueLow !== undefined && card.valueHigh !== undefined && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-[var(--muted-foreground)]">
                {formatCurrency(card.valueLow)} -{' '}
                {formatCurrency(card.valueHigh)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
