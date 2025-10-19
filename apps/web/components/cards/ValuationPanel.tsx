'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface ValuationPanelProps {
  low: number;
  median: number;
  high: number;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  };
  confidence: number;
  compsCount: number;
  sources?: Array<{ name: string; logo: string }>;
  lastUpdated?: string;
}

export function ValuationPanel({
  low,
  median,
  high,
  trend,
  confidence,
  compsCount,
  sources,
  lastUpdated,
}: ValuationPanelProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-[var(--emerald-glow)]" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-[var(--crimson-red)]" />;
      default:
        return <Minus className="h-4 w-4 text-[var(--muted-foreground)]" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Valuation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-[var(--muted-foreground)] mb-1">
            Median Value
          </p>
          <p className="text-4xl font-bold text-[var(--vault-blue)]">
            {formatCurrency(median)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Low</p>
            <p className="text-xl font-semibold">{formatCurrency(low)}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">High</p>
            <p className="text-xl font-semibold">{formatCurrency(high)}</p>
          </div>
        </div>

        {trend && (
          <div className="flex items-center justify-center gap-2 p-3 bg-[var(--muted)] rounded-lg">
            {getTrendIcon()}
            <span className="text-sm font-medium">
              {trend.direction === 'up'
                ? '+'
                : trend.direction === 'down'
                  ? '-'
                  : ''}
              {Math.abs(trend.percentage).toFixed(1)}% trend
            </span>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Confidence</span>
            <span className="font-medium">{Math.round(confidence * 100)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Comparables</span>
            <span className="font-medium">{compsCount}</span>
          </div>
          {lastUpdated && (
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Updated</span>
              <span className="font-medium">
                {new Date(lastUpdated).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {sources && sources.length > 0 && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-2">
              Data Sources
            </p>
            <div className="flex gap-2 flex-wrap">
              {sources.map((source) => (
                <span
                  key={source.name}
                  className="text-xs px-2 py-1 bg-[var(--muted)] rounded"
                >
                  {source.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
