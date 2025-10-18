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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Card Image - Takes 1 column */}
      <div className="md:col-span-1">
        <Card className="border-2 border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
          <CardContent className="p-4">
            <div className="relative aspect-[2.5/3.5] bg-gradient-to-br from-[var(--muted)] to-[var(--muted)]/50 rounded-lg overflow-hidden">
              {/* Placeholder for card image */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="text-5xl">🎴</div>
                  <div className="text-xs text-[var(--muted-foreground)] px-2">
                    <p className="font-semibold truncate">{card.name}</p>
                    <p className="truncate">{card.set}</p>
                  </div>
                </div>
              </div>

              {/* Authenticity Badge Overlay */}
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
          </CardContent>
        </Card>
      </div>

      {/* Card Details - Takes 2 columns */}
      <div className="md:col-span-2">
        <Card className="border-2 border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)] h-full">
          <CardHeader>
            <CardTitle className="text-xl font-display">
              {card.name || 'Unknown Card'}
            </CardTitle>
            <p className="text-sm text-[var(--muted-foreground)]">
              {card.set || 'Unknown Set'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Card Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {card.number && (
                <div>
                  <p className="text-[var(--muted-foreground)] text-xs mb-1">
                    Number
                  </p>
                  <p className="font-medium">#{card.number}</p>
                </div>
              )}
              {card.rarity && (
                <div>
                  <p className="text-[var(--muted-foreground)] text-xs mb-1">
                    Rarity
                  </p>
                  <p className="font-medium">{card.rarity}</p>
                </div>
              )}
              {card.conditionEstimate && (
                <div>
                  <p className="text-[var(--muted-foreground)] text-xs mb-1">
                    Condition
                  </p>
                  <p className="font-medium">{card.conditionEstimate}</p>
                </div>
              )}
            </div>

            {card.authenticityScore !== undefined && (
              <div className="pt-3 border-t">
                <p className="text-xs text-[var(--muted-foreground)] mb-2">
                  Authenticity Analysis
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

            {/* Valuation Summary */}
            {(card.valueLow || card.valueMedian || card.valueHigh) && (
              <div className="pt-3 border-t">
                <p className="text-xs text-[var(--muted-foreground)] mb-2">
                  Market Valuation
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-[var(--muted-foreground)]">
                      Current Value
                    </span>
                    <span className="text-xl font-bold bg-gradient-to-r from-[var(--color-vault-blue)] to-[var(--color-holo-cyan)] bg-clip-text text-transparent">
                      ${card.valueMedian?.toFixed(2) || 'N/A'}
                    </span>
                  </div>
                  {card.valueLow !== undefined &&
                    card.valueHigh !== undefined && (
                      <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
                        <span>Range</span>
                        <span>
                          ${card.valueLow.toFixed(2)} - $
                          {card.valueHigh.toFixed(2)}
                        </span>
                      </div>
                    )}
                  {card.compsCount && (
                    <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
                      <span>Comparable Sales</span>
                      <span>{card.compsCount}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-3 border-t text-xs text-[var(--muted-foreground)]">
              <div className="flex justify-between mb-1">
                <span>Added</span>
                <span>{new Date(card.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Updated</span>
                <span>{new Date(card.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
