'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export interface PortfolioSummaryProps {
  totalValue: number;
  totalCards: number;
  change: {
    value: number;
    percentage: number;
  };
  sparklineData: Array<{ date: string; value: number }>;
  isLoading?: boolean;
}

/**
 * Sparkline component - simple SVG line chart for 14-day performance
 */
function Sparkline({ data }: { data: Array<{ date: string; value: number }> }) {
  if (data.length === 0) return null;

  const width = 120;
  const height = 40;
  const padding = 2;

  // Calculate min/max for scaling
  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1; // Avoid division by zero

  // Generate SVG path
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
    const y =
      height -
      padding -
      ((d.value - minValue) / valueRange) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(' L ')}`;

  // Determine color based on trend
  const isPositive = data[data.length - 1].value >= data[0].value;
  const strokeColor = isPositive
    ? 'var(--color-emerald-glow)'
    : 'var(--color-crimson-red)';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block"
      aria-label="14-day performance sparkline"
    >
      <path
        d={pathData}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * PortfolioSummary component
 * Displays total collection value, card count, 14-day change, and sparkline
 */
export function PortfolioSummary({
  totalValue,
  totalCards,
  change,
  sparklineData,
  isLoading = false,
}: PortfolioSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const isPositive = change.value >= 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </div>
            <div>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-20" />
            </div>
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-8 w-40" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Total Value */}
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">
              Total Value
            </p>
            <p className="text-3xl font-bold">{formatCurrency(totalValue)}</p>
          </div>

          {/* Total Cards */}
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">
              Total Cards
            </p>
            <p className="text-3xl font-bold">{totalCards}</p>
          </div>

          {/* 14-Day Change with Sparkline */}
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">
              14-Day Change
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {isPositive ? (
                  <TrendingUp className="h-5 w-5 text-[var(--color-emerald-glow)]" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-[var(--color-crimson-red)]" />
                )}
                <span
                  className={`text-2xl font-bold ${
                    isPositive
                      ? 'text-[var(--color-emerald-glow)]'
                      : 'text-[var(--color-crimson-red)]'
                  }`}
                >
                  {isPositive ? '+' : ''}
                  {change.percentage.toFixed(1)}%
                </span>
              </div>
              {sparklineData.length > 0 && (
                <div className="ml-auto">
                  <Sparkline data={sparklineData} />
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
