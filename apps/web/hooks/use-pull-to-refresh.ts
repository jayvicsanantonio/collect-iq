/**
 * Pull-to-refresh hook for mobile devices
 * Detects pull-down gesture and triggers refresh callback
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number; // Distance in pixels to trigger refresh
  resistance?: number; // Resistance factor (0-1)
  enabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  resistance = 0.5,
  enabled = true,
}: UsePullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const touchCurrentY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || isRefreshing) return;

      // Only trigger if scrolled to top
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    },
    [enabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !isPulling.current || isRefreshing) return;

      touchCurrentY.current = e.touches[0].clientY;
      const distance = touchCurrentY.current - touchStartY.current;

      // Only pull down
      if (distance > 0) {
        // Apply resistance
        const resistedDistance = distance * resistance;
        setPullDistance(resistedDistance);

        // Prevent default scroll if pulling
        if (resistedDistance > 10) {
          e.preventDefault();
        }
      }
    },
    [enabled, isRefreshing, resistance]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || !isPulling.current) return;

    isPulling.current = false;

    // Trigger refresh if threshold reached
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(0);

      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        setIsRefreshing(false);
      }
    } else {
      // Reset pull distance with animation
      setPullDistance(0);
    }
  }, [enabled, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    // Add touch event listeners
    document.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    document.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    isRefreshing,
    pullDistance,
    isPulling: isPulling.current,
  };
}
