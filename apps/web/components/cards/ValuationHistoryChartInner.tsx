'use client';

import * as React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

export interface ValuationHistoryDataPoint {
  date: string; // ISO 8601 date string
  low: number;
  median: number;
  high: number;
}

interface ValuationHistoryChartInnerProps {
  data: ValuationHistoryDataPoint[];
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
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 shadow-lg">
      <p className="text-sm font-semibold mb-2">
        {formatDate(label)}
      </p>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            Low
          </span>
          <span className="font-medium">
            {formatCurrency(payload[0].value)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[var(--vault-blue)]" />
            Median
          </span>
          <span className="font-medium">
            {formatCurrency(payload[1].value)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            High
          </span>
          <span className="font-medium">
            {formatCurrency(payload[2].value)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function ValuationHistoryChartInner({
  data,
}: ValuationHistoryChartInnerProps) {
  return (
    <div
      className="w-full"
      style={{ minHeight: '320px' }}
      role="img"
      aria-label={`Valuation history chart showing price trends from ${formatDate(
        data[0].date
      )} to ${formatDate(data[data.length - 1].date)}`}
    >
      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="var(--muted-foreground)"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            tickFormatter={formatCurrency}
            stroke="var(--muted-foreground)"
            style={{ fontSize: '12px' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            iconType="circle"
          />
          <Line
            type="monotone"
            dataKey="low"
            stroke="rgb(239, 68, 68)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="Low"
          />
          <Line
            type="monotone"
            dataKey="median"
            stroke="var(--vault-blue)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="Median"
          />
          <Line
            type="monotone"
            dataKey="high"
            stroke="rgb(34, 197, 94)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name="High"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Accessibility description */}
      <p className="sr-only">
        Line chart showing valuation history with three price bands:
        low, median, and high prices over time. The chart displays
        data from {formatDate(data[0].date)} to{' '}
        {formatDate(data[data.length - 1].date)}.
      </p>
    </div>
  );
}
