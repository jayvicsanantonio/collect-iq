'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from 'lucide-react';
import type { Card as CardType } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface ValuationPanelProps {
  card: CardType;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

/**
 * Format currency value
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * Format relative time (e.g., "2 days ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ValuationPanel({
  card,
  onRefresh,
  isRefreshing = false,
}: ValuationPanelProps) {
  // Check if valuation data is available
  const hasValuation =
    card.valueLow !== null &&
    card.valueLow !== undefined &&
    card.valueMedian !== null &&
    card.valueMedian !== undefined &&
    card.valueHigh !== null &&
    card.valueHigh !== undefined;

  // Check if card was recently created (within last 5 minutes)
  const isRecentlyCreated = React.useMemo(() => {
    const createdAt = new Date(card.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    return diffMs < 5 * 60 * 1000; // 5 minutes
  }, [card.createdAt]);

  // Render unavailable state
  if (!hasValuation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Market Valuation
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw
                  className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
                />
                Refresh
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-[var(--muted-foreground)] mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {isRecentlyCreated
                ? 'Analysis in Progress'
                : 'Valuation Unavailable'}
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-4 max-w-md">
              {isRecentlyCreated
                ? 'Your card is being analyzed. Valuation data will be available shortly.'
                : 'Valuation data is not available for this card. Try refreshing to get the latest market data.'}
            </p>
            {onRefresh && (
              <Button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw
                  className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
                />
                {isRefreshing ? 'Refreshing...' : 'Refresh Valuation'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render valuation data
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Market Valuation
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw
                className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
              />
              Refresh
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Median Value - Primary Display */}
        <div className="text-center">
          <p className="text-sm text-[var(--muted-foreground)] mb-1">
            Median Value
          </p>
          <p className="text-4xl font-bold text-[var(--vault-blue)]">
            {formatCurrency(card.valueMedian!)}
          </p>
        </div>

        {/* Price Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Low</p>
            <p className="text-xl font-semibold">
              {formatCurrency(card.valueLow!)}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">High</p>
            <p className="text-xl font-semibold">
              {formatCurrency(card.valueHigh!)}
            </p>
          </div>
        </div>

        {/* Visual Price Range Bar */}
        <div className="relative h-2 bg-[var(--muted)] rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-gradient-to-r from-[var(--vault-blue)] to-[var(--holo-cyan)]"
            style={{
              left: '0%',
              right: '0%',
            }}
          />
          <div
            className="absolute h-full w-1 bg-white shadow-lg"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
            }}
            title={`Median: ${formatCurrency(card.valueMedian!)}`}
          />
        </div>

        {/* Metadata */}
        <div className="space-y-2 text-sm pt-2 border-t">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Last Updated</span>
            <span className="font-medium">
              {formatRelativeTime(card.updatedAt)}
            </span>
          </div>
        </div>

        {/* Future Enhancement Note */}
        <div className="text-xs text-[var(--muted-foreground)] italic pt-2 border-t">
          Note: Trend indicators, confidence scores, comparable sales count, and data sources will be available in a future update.
        </div>
      </CardContent>
    </Card>
  );
}
