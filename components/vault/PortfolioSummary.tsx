'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface PortfolioSummaryProps {
  totalValue: number;
  totalCards: number;
  change: {
    value: number;
    percentage: number;
  };
  sparklineData: Array<{ date: string; value: number }>;
}

export function PortfolioSummary({
  totalValue,
  totalCards,
  change,
}: PortfolioSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const isPositive = change.value >= 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">
              Total Value
            </p>
            <p className="text-3xl font-bold">{formatCurrency(totalValue)}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">
              Total Cards
            </p>
            <p className="text-3xl font-bold">{totalCards}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">
              14-Day Change
            </p>
            <div className="flex items-center gap-2">
              {isPositive ? (
                <TrendingUp className="h-5 w-5 text-[var(--emerald-glow)]" />
              ) : (
                <TrendingDown className="h-5 w-5 text-[var(--crimson-red)]" />
              )}
              <span
                className={`text-2xl font-bold ${
                  isPositive
                    ? 'text-[var(--emerald-glow)]'
                    : 'text-[var(--crimson-red)]'
                }`}
              >
                {isPositive ? '+' : ''}
                {change.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
