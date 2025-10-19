'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ValuationHistoryDataPoint {
  date: string;
  value: number;
}

export interface ValuationHistoryChartProps {
  data: ValuationHistoryDataPoint[];
  title?: string;
}

export function ValuationHistoryChart({
  data,
  title = 'Price History',
}: ValuationHistoryChartProps) {
  // Simple sparkline implementation
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  if (data.length === 0) {
    return null;
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">
              {new Date(data[0].date).toLocaleDateString()}
            </span>
            <span className="text-[var(--muted-foreground)]">
              {new Date(data[data.length - 1].date).toLocaleDateString()}
            </span>
          </div>
          <div className="h-32 flex items-end gap-1">
            {data.map((point, i) => {
              const height = ((point.value - min) / range) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 bg-[var(--vault-blue)] rounded-t transition-all hover:opacity-80"
                  style={{ height: `${height}%`, minHeight: '4px' }}
                  title={`${new Date(point.date).toLocaleDateString()}: ${formatCurrency(point.value)}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span>{formatCurrency(min)}</span>
            <span>{formatCurrency(max)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
