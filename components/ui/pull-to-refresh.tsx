/**
 * Pull-to-refresh indicator component
 * Shows visual feedback during pull-to-refresh gesture
 */

'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PullToRefreshIndicatorProps {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  threshold?: number;
}

export function PullToRefreshIndicator({
  isPulling,
  isRefreshing,
  pullDistance,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min((pullDistance / threshold) * 100, 100);
  const shouldTrigger = pullDistance >= threshold;

  if (!isPulling && !isRefreshing) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-center pointer-events-none"
      style={{
        transform: `translateY(${Math.min(pullDistance, threshold)}px)`,
        transition: isPulling ? 'none' : 'transform 0.3s ease-out',
      }}
    >
      <div
        className={cn(
          'flex items-center justify-center w-12 h-12 rounded-full bg-[var(--card)] border-2 shadow-lg transition-all',
          shouldTrigger || isRefreshing
            ? 'border-[var(--color-holo-cyan)]'
            : 'border-[var(--border)]'
        )}
      >
        <RefreshCw
          className={cn(
            'w-6 h-6 transition-all',
            isRefreshing && 'animate-spin',
            shouldTrigger
              ? 'text-[var(--color-holo-cyan)]'
              : 'text-[var(--muted-foreground)]'
          )}
          style={{
            transform: isRefreshing ? 'none' : `rotate(${progress * 3.6}deg)`,
          }}
        />
      </div>
    </div>
  );
}
