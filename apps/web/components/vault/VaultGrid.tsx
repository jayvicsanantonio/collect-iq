'use client';

import * as React from 'react';
import { Card } from '@collectiq/shared';
import { VaultCard } from './VaultCard';

export interface VaultGridProps {
  cards: Card[];
  onRefresh: (cardId: string) => void;
  onDelete: (cardId: string) => void;
}

export function VaultGrid({ cards, onRefresh, onDelete }: VaultGridProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => (
        <VaultCard
          key={card.cardId}
          card={card}
          onRefresh={onRefresh}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
