'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ============================================================================
// Types
// ============================================================================

export interface ValuationHistoryDataPoint {
  date: string; // ISO 8601 date string
  low: number;
  median: number;
  high: number;
}

export interface ValuationHistoryChartProps {
  data: ValuationHistoryDataPoint[];
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Custom tooltip component for the chart
 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold mb-2">{formatDate(label)}</p>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            Low
          </span>
          <span className="font-medium">{formatCurrency(payload[0].value)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[var(--vault-blue)]" />
            Median
          </span>
          <span className="font-medium">{formatCurrency(payload[1].value)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            High
          </span>
          <span className="font-medium">{formatCurrency(payload[2].value)}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function ChartSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[320px] w-full" />
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function ValuationHistoryChart({
  data,
  className,
}: ValuationHistoryChartProps) {
  const [ChartComponent, setChartComponent] = React.useState<React.ComponentType<{ data: ValuationHistoryDataPoint[] }> | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Lazy-load the chart component
  React.useEffect(() => {
    import('./ValuationHistoryChartInner')
      .then((mod) => {
        setChartComponent(() => mod.default);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load chart component:', error);
        setIsLoading(false);
      });
  }, []);

  // Show empty state if no data
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Valuation History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[320px] text-[var(--muted-foreground)]">
            <p className="text-sm">No historical data available yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Valuation History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : ChartComponent ? (
          <ChartComponent data={data} />
        ) : (
          <div className="flex items-center justify-center h-[320px] text-[var(--muted-foreground)]">
            <p className="text-sm">Failed to load chart</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
