'use client';

import * as React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ValuationSummary } from '@/lib/types';

export interface AIInsightsProps {
  valuationSummary: ValuationSummary;
  className?: string;
}

/**
 * Prominent display of AI-generated valuation insights
 * Shows the summary, fair value, trend, and recommendation
 */
export function AIInsights({
  valuationSummary,
  className,
}: AIInsightsProps) {
  const { summary, fairValue, trend, recommendation, confidence } =
    valuationSummary;

  // Trend icon and color
  const trendConfig = {
    rising: {
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      label: 'Rising',
    },
    falling: {
      icon: TrendingDown,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      label: 'Falling',
    },
    stable: {
      icon: Minus,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      label: 'Stable',
    },
  };

  const config = trendConfig[trend];
  const TrendIcon = config.icon;
  const confidencePercentage = Math.round(confidence * 100);

  return (
    <Card
      className={cn(
        'border-2 border-[var(--vault-blue)]/30 bg-gradient-to-br from-[var(--vault-blue)]/5 to-transparent',
        className
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-[var(--vault-blue)]" />
          AI Market Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fair Value - Most Prominent */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--vault-blue)]/10 border border-[var(--vault-blue)]/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[var(--vault-blue)]/20">
              <DollarSign className="h-5 w-5 text-[var(--vault-blue)]" />
            </div>
            <div>
              <p className="text-sm text-[var(--muted-foreground)]">
                AI Fair Value
              </p>
              <p className="text-2xl font-bold text-[var(--vault-blue)]">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(fairValue)}
              </p>
            </div>
          </div>

          {/* Trend Badge */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full',
              config.bgColor
            )}
          >
            <TrendIcon className={cn('h-4 w-4', config.color)} />
            <span className={cn('text-sm font-medium', config.color)}>
              {config.label}
            </span>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[var(--foreground)]">
            Market Analysis
          </h4>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            {summary}
          </p>
        </div>

        {/* Recommendation */}
        <div className="space-y-2 p-3 rounded-lg bg-[var(--muted)]/50 border border-[var(--border)]">
          <h4 className="text-sm font-semibold text-[var(--foreground)]">
            Recommendation
          </h4>
          <p className="text-sm text-[var(--foreground)] leading-relaxed font-medium">
            {recommendation}
          </p>
        </div>

        {/* Confidence Indicator */}
        <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
          <span>AI Confidence</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--vault-blue)] transition-all duration-300"
                style={{ width: `${confidencePercentage}%` }}
              />
            </div>
            <span className="font-medium">
              {confidencePercentage}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
