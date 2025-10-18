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
    <Card className="border-2 border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
      <CardContent className="p-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
              Total Value
            </p>
            <p className="text-4xl font-bold font-display bg-gradient-to-r from-[var(--color-vault-blue)] to-[var(--color-holo-cyan)] bg-clip-text text-transparent">
              {formatCurrency(totalValue)}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
              Total Cards
            </p>
            <p className="text-4xl font-bold font-display">{totalCards}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
              14-Day Change
            </p>
            <div className="flex items-center gap-3">
              {isPositive ? (
                <TrendingUp className="h-6 w-6 text-[var(--emerald-glow)]" />
              ) : (
                <TrendingDown className="h-6 w-6 text-[var(--crimson-red)]" />
              )}
              <span
                className={`text-3xl font-bold font-display ${
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
