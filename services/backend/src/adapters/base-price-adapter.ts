/**
 * Base adapter for pricing sources with circuit breaker and rate limiting
 */

import { PriceQuery, RawComp } from '@collectiq/shared';
import { logger } from '../utils/logger.js';

export interface PriceSource {
  name: string;
  fetchComps(query: PriceQuery): Promise<RawComp[]>;
  isAvailable(): Promise<boolean>;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

interface RateLimitState {
  requests: number[];
  windowMs: number;
  maxRequests: number;
}

export abstract class BasePriceAdapter implements PriceSource {
  abstract name: string;

  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
  };

  private rateLimit: RateLimitState = {
    requests: [],
    windowMs: 60000, // 1 minute window
    maxRequests: 30, // 30 requests per minute default
  };

  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 60 seconds
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_BACKOFF = 1000; // 1 second

  constructor(maxRequestsPerMinute?: number) {
    if (maxRequestsPerMinute) {
      this.rateLimit.maxRequests = maxRequestsPerMinute;
    }
  }

  /**
   * Check if the adapter is available (circuit breaker check)
   */
  async isAvailable(): Promise<boolean> {
    // Check if circuit breaker is open
    if (this.circuitBreaker.isOpen) {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;

      // Try to close circuit breaker after timeout
      if (timeSinceLastFailure >= this.CIRCUIT_BREAKER_TIMEOUT) {
        logger.info(`Circuit breaker half-open for ${this.name}, attempting recovery`);
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
        return true;
      }

      logger.warn(`Circuit breaker open for ${this.name}, service unavailable`);
      return false;
    }

    return true;
  }

  /**
   * Fetch comps with circuit breaker, rate limiting, and retry logic
   */
  async fetchComps(query: PriceQuery): Promise<RawComp[]> {
    // Check circuit breaker
    const available = await this.isAvailable();
    if (!available) {
      logger.warn(`${this.name} unavailable due to circuit breaker`);
      return [];
    }

    // Check rate limit
    await this.checkRateLimit();

    // Execute with retry logic
    return this.executeWithRetry(query);
  }

  /**
   * Abstract method to be implemented by concrete adapters
   */
  protected abstract fetchCompsInternal(query: PriceQuery): Promise<RawComp[]>;

  /**
   * Execute fetch with exponential backoff retry
   */
  private async executeWithRetry(query: PriceQuery): Promise<RawComp[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const result = await this.fetchCompsInternal(query);

        // Success - reset circuit breaker
        this.onSuccess();

        return result;
      } catch (error) {
        lastError = error as Error;

        logger.warn(`${this.name} fetch attempt ${attempt + 1} failed`, {
          error: lastError.message,
          query,
        });

        // Don't retry on last attempt
        if (attempt < this.MAX_RETRIES - 1) {
          const backoffMs = this.INITIAL_BACKOFF * Math.pow(2, attempt);
          await this.sleep(backoffMs);
        }
      }
    }

    // All retries failed
    this.onFailure();

    logger.error(
      `${this.name} failed after ${this.MAX_RETRIES} attempts`,
      lastError || new Error('Unknown error'),
      {
        query,
      },
    );

    return [];
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    // Reset failure count on success
    if (this.circuitBreaker.failures > 0) {
      logger.info(`${this.name} recovered, resetting circuit breaker`);
      this.circuitBreaker.failures = 0;
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      logger.error(
        `Circuit breaker opened for ${this.name} after ${this.circuitBreaker.failures} failures`,
      );
    }
  }

  /**
   * Check and enforce rate limiting
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.rateLimit.windowMs;

    // Remove old requests outside the window
    this.rateLimit.requests = this.rateLimit.requests.filter(
      (timestamp) => timestamp > windowStart,
    );

    // Check if we've exceeded the limit
    if (this.rateLimit.requests.length >= this.rateLimit.maxRequests) {
      const oldestRequest = this.rateLimit.requests[0];
      const waitTime = oldestRequest + this.rateLimit.windowMs - now;

      logger.warn(`Rate limit reached for ${this.name}, waiting ${waitTime}ms`);
      await this.sleep(waitTime);

      // Recursively check again after waiting
      return this.checkRateLimit();
    }

    // Add current request to the window
    this.rateLimit.requests.push(now);
  }

  /**
   * Sleep utility for backoff and rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }
}
