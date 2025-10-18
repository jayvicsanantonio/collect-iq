/**
 * Analytics and Telemetry Utility
 *
 * Privacy-first event tracking system that:
 * - Never includes PII (Personally Identifiable Information)
 * - Respects Do Not Track (DNT) browser setting
 * - Batches events for performance
 * - Includes requestId for traceability
 * - Can be disabled via environment variables
 */

import { env } from './env';

// Event types for type safety
export type AnalyticsEvent =
  | 'upload_started'
  | 'upload_succeeded'
  | 'analyze_started'
  | 'analyze_succeeded'
  | 'card_saved'
  | 'valuation_refreshed';

// Event payload structure
interface EventPayload {
  event: AnalyticsEvent;
  timestamp: string; // ISO 8601 format
  requestId?: string; // For traceability
  metadata?: Record<string, string | number | boolean>; // Additional context (no PII)
  duration?: number; // For performance tracking (milliseconds)
}

// Batched events queue
interface BatchedEvent extends EventPayload {
  id: string;
}

class Analytics {
  private queue: BatchedEvent[] = [];
  private batchSize = 10;
  private batchTimeout = 5000; // 5 seconds
  private timeoutId: NodeJS.Timeout | null = null;
  private enabled: boolean;

  constructor() {
    // Check if analytics is enabled
    this.enabled = this.isAnalyticsEnabled();

    // Flush queue on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  /**
   * Check if analytics is enabled
   * Respects DNT header and environment configuration
   */
  private isAnalyticsEnabled(): boolean {
    // Check if running in browser
    if (typeof window === 'undefined') {
      return false;
    }

    // Respect Do Not Track (DNT)
    const dnt =
      navigator.doNotTrack === '1' ||
      (window as unknown as { doNotTrack?: string }).doNotTrack === '1' ||
      (navigator as unknown as { msDoNotTrack?: string }).msDoNotTrack === '1';

    if (dnt) {
      console.info('[Analytics] Do Not Track enabled - analytics disabled');
      return false;
    }

    // Check if analytics ID is configured
    if (!env.NEXT_PUBLIC_ANALYTICS_ID) {
      console.info('[Analytics] No analytics ID configured - analytics disabled');
      return false;
    }

    return true;
  }

  /**
   * Track an analytics event
   * @param event - Event name
   * @param metadata - Additional context (must not contain PII)
   * @param requestId - Optional request ID for traceability
   * @param duration - Optional duration in milliseconds
   */
  track(
    event: AnalyticsEvent,
    metadata?: Record<string, string | number | boolean>,
    requestId?: string,
    duration?: number
  ): void {
    if (!this.enabled) {
      return;
    }

    // Validate metadata doesn't contain PII
    if (metadata && this.containsPII(metadata)) {
      console.error('[Analytics] Event metadata contains PII - event not tracked');
      return;
    }

    const payload: BatchedEvent = {
      id: this.generateEventId(),
      event,
      timestamp: new Date().toISOString(),
      requestId,
      metadata,
      duration,
    };

    // Add to queue
    this.queue.push(payload);

    // Flush if batch size reached
    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else {
      // Schedule flush
      this.scheduleBatchFlush();
    }
  }

  /**
   * Track upload started event
   */
  trackUploadStarted(metadata?: { fileType?: string; fileSize?: number }): void {
    this.track('upload_started', metadata);
  }

  /**
   * Track upload succeeded event
   */
  trackUploadSucceeded(duration: number, metadata?: { fileType?: string }): void {
    this.track('upload_succeeded', metadata, undefined, duration);
  }

  /**
   * Track analyze started event
   */
  trackAnalyzeStarted(requestId?: string): void {
    this.track('analyze_started', undefined, requestId);
  }

  /**
   * Track analyze succeeded event
   */
  trackAnalyzeSucceeded(
    duration: number,
    metadata?: {
      confidenceScore?: number;
      authenticityScore?: number;
      candidatesCount?: number;
    },
    requestId?: string
  ): void {
    this.track('analyze_succeeded', metadata, requestId, duration);
  }

  /**
   * Track card saved event
   */
  trackCardSaved(metadata?: { set?: string; rarity?: string }): void {
    this.track('card_saved', metadata);
  }

  /**
   * Track valuation refreshed event
   */
  trackValuationRefreshed(
    duration: number,
    metadata?: { priceChange?: number }
  ): void {
    this.track('valuation_refreshed', metadata, undefined, duration);
  }

  /**
   * Schedule batch flush
   */
  private scheduleBatchFlush(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.flush();
    }, this.batchTimeout);
  }

  /**
   * Flush queued events
   */
  private flush(): void {
    if (this.queue.length === 0) {
      return;
    }

    const events = [...this.queue];
    this.queue = [];

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Send events to analytics endpoint
    this.sendEvents(events);
  }

  /**
   * Send events to analytics endpoint
   */
  private sendEvents(events: BatchedEvent[]): void {
    // Use sendBeacon for reliability (works even during page unload)
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ events })], {
        type: 'application/json',
      });

      // In production, this would be your analytics endpoint
      const endpoint = `${env.NEXT_PUBLIC_API_BASE}/analytics`;
      
      try {
        navigator.sendBeacon(endpoint, blob);
      } catch (error) {
        console.error('[Analytics] Failed to send events:', error);
      }
    } else {
      // Fallback to fetch
      fetch(`${env.NEXT_PUBLIC_API_BASE}/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
        keepalive: true,
      }).catch((error) => {
        console.error('[Analytics] Failed to send events:', error);
      });
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Check if metadata contains PII
   * This is a basic check - in production, use more sophisticated detection
   */
  private containsPII(metadata: Record<string, unknown>): boolean {
    const piiKeys = [
      'email',
      'name',
      'phone',
      'address',
      'ssn',
      'userId',
      'username',
      'ip',
      'location',
      'sub',
    ];

    const keys = Object.keys(metadata).map((k) => k.toLowerCase());
    return piiKeys.some((piiKey) => keys.includes(piiKey));
  }
}

// Singleton instance
const analytics = new Analytics();

export default analytics;

// Export convenience functions
export const trackUploadStarted = analytics.trackUploadStarted.bind(analytics);
export const trackUploadSucceeded = analytics.trackUploadSucceeded.bind(analytics);
export const trackAnalyzeStarted = analytics.trackAnalyzeStarted.bind(analytics);
export const trackAnalyzeSucceeded = analytics.trackAnalyzeSucceeded.bind(analytics);
export const trackCardSaved = analytics.trackCardSaved.bind(analytics);
export const trackValuationRefreshed = analytics.trackValuationRefreshed.bind(analytics);
