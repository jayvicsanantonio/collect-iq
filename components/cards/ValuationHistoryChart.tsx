'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
  const [ChartComponent, setChartComponent] =
    React.useState<React.ComponentType<{
      data: ValuationHistoryDataPoint[];
    }> | null>(null);
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
            <p className="text-sm">
              No historical data available yet
            </p>
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
