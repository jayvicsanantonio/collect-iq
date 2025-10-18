'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;
  const opacity = Math.min(progress * 2, 1);

  if (pullDistance === 0 && !isRefreshing) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-40 flex justify-center pointer-events-none safe-area-top"
      style={{
        transform: `translateY(${isRefreshing ? '0' : `-${Math.max(0, 60 - pullDistance)}px`})`,
        transition: isRefreshing ? 'transform 0.2s ease-out' : 'none',
      }}
    >
      <div
        className={cn(
          'flex items-center justify-center',
          'w-12 h-12 rounded-full',
          'bg-[var(--card)] border border-[var(--border)]',
          'shadow-lg',
          'mt-4'
        )}
        style={{
          opacity: isRefreshing ? 1 : opacity,
        }}
      >
        <RefreshCw
          className={cn(
            'h-5 w-5 text-[var(--vault-blue)]',
            isRefreshing && 'animate-spin'
          )}
          style={{
            transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
            transition: isRefreshing ? undefined : 'none',
          }}
        />
      </div>
    </div>
  );
}
