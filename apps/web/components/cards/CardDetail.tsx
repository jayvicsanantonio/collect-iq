'use client';

import * as React from 'react';
import { Card as CardType } from '@collectiq/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthenticityBadge } from './AuthenticityBadge';

export interface CardDetailProps {
  card: CardType;
}

export function CardDetail({ card }: CardDetailProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Name</span>
            <span className="font-medium">{card.name || 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Set</span>
            <span className="font-medium">{card.set || 'Unknown'}</span>
          </div>
          {card.number && (
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Number</span>
              <span className="font-medium">#{card.number}</span>
            </div>
          )}
          {card.rarity && (
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Rarity</span>
              <span className="font-medium">{card.rarity}</span>
            </div>
          )}
          {card.conditionEstimate && (
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Condition</span>
              <span className="font-medium">{card.conditionEstimate}</span>
            </div>
          )}
        </div>

        {card.authenticityScore !== undefined && (
          <div className="pt-4 border-t">
            <p className="text-sm text-[var(--muted-foreground)] mb-2">
              Authenticity
            </p>
            <AuthenticityBadge
              score={card.authenticityScore}
              breakdown={
                card.authenticitySignals
                  ? {
                      visualHashConfidence:
                        card.authenticitySignals.visualHashConfidence,
                      textMatchConfidence:
                        card.authenticitySignals.textMatchConfidence,
                      holoPatternConfidence:
                        card.authenticitySignals.holoPatternConfidence,
                    }
                  : undefined
              }
            />
          </div>
        )}

        <div className="pt-4 border-t text-xs text-[var(--muted-foreground)]">
          <div className="flex justify-between mb-1">
            <span>Added</span>
            <span>{new Date(card.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Updated</span>
            <span>{new Date(card.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
