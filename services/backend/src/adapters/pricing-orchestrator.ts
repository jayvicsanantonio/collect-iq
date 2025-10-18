/**
 * Pricing orchestrator that coordinates multiple pricing sources
 */

import { PriceQuery, RawComp, PricingResult } from '@collectiq/shared';
import { PricingService } from './pricing-service.js';
import { EbayAdapter } from './ebay-adapter.js';
import { TCGPlayerAdapter } from './tcgplayer-adapter.js';
import { PriceChartingAdapter } from './pricecharting-adapter.js';
import { PriceSource } from './base-price-adapter.js';
import { savePricingSnapshot, getPricingSnapshot } from '../store/pricing-cache.js';
import { logger, metrics } from '../utils/index.js';

export class PricingOrchestrator {
  private pricingService: PricingService;
  private sources: PriceSource[];

  constructor() {
    this.pricingService = new PricingService();
    this.sources = [new EbayAdapter(), new TCGPlayerAdapter(), new PriceChartingAdapter()];
  }

  /**
   * Fetch all comps from available sources in parallel
   */
  async fetchAllComps(
    query: PriceQuery,
    userId?: string,
    cardId?: string,
    forceRefresh = false,
  ): Promise<PricingResult> {
    // Check cache first (if userId and cardId provided)
    if (!forceRefresh && userId && cardId) {
      const cached = await this.getCachedResult(userId, cardId);
      if (cached) {
        logger.info('Returning cached pricing result', { userId, cardId });
        return cached;
      }
    }

    logger.info('Fetching pricing from all sources', { query });

    // Fetch from all available sources in parallel
    const rawComps = await this.fetchFromAllSources(query);

    if (rawComps.length === 0) {
      throw new Error('No pricing data available from any source');
    }

    // Normalize and fuse the data
    const normalizedComps = this.pricingService.normalize(rawComps);
    const pricingResult = this.pricingService.fuse(normalizedComps, query);

    // Cache the result (if userId and cardId provided)
    if (userId && cardId) {
      await this.cacheResult(userId, cardId, pricingResult);
    }

    logger.info('Pricing result computed', {
      compsCount: pricingResult.compsCount,
      sources: pricingResult.sources,
      confidence: pricingResult.confidence,
    });

    return pricingResult;
  }

  /**
   * Fetch comps from all available sources in parallel
   */
  private async fetchFromAllSources(query: PriceQuery): Promise<RawComp[]> {
    // Check which sources are available
    const availabilityChecks = await Promise.all(
      this.sources.map(async (source) => ({
        source,
        available: await source.isAvailable(),
      })),
    );

    const availableSources = availabilityChecks
      .filter(({ available }) => available)
      .map(({ source }) => source);

    if (availableSources.length === 0) {
      logger.error('No pricing sources available');
      throw new Error('All pricing sources are unavailable');
    }

    logger.info(`Fetching from ${availableSources.length} available sources`, {
      sources: availableSources.map((s) => s.name),
    });

    // Fetch from all available sources in parallel
    const results = await Promise.allSettled(
      availableSources.map((source) => source.fetchComps(query)),
    );

    // Aggregate all successful results
    const allComps: RawComp[] = [];
    const failedSources: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const source = availableSources[i];

      if (result.status === 'fulfilled') {
        allComps.push(...result.value);
        logger.info(`${source.name} returned ${result.value.length} comps`);
      } else {
        failedSources.push(source.name);
        logger.error(`${source.name} failed to fetch comps`, result.reason as Error);

        const errorType =
          result.reason instanceof Error
            ? result.reason.name || result.reason.message
            : typeof result.reason === 'string'
              ? result.reason
              : 'Unknown error';

        await metrics.recordPricingSourceError(source.name, errorType);
      }
    }

    // Log summary
    if (failedSources.length > 0) {
      logger.warn(`${failedSources.length} sources failed`, {
        failedSources,
        successfulSources: availableSources.length - failedSources.length,
      });
    }

    return allComps;
  }

  /**
   * Get cached pricing result
   */
  private async getCachedResult(userId: string, cardId: string): Promise<PricingResult | null> {
    try {
      return await getPricingSnapshot(userId, cardId);
    } catch {
      logger.warn('Failed to get cached pricing result', { userId, cardId });
      return null;
    }
  }

  /**
   * Cache pricing result in DynamoDB
   */
  private async cacheResult(userId: string, cardId: string, result: PricingResult): Promise<void> {
    try {
      const ttlSeconds = parseInt(process.env.CACHE_TTL_SECONDS || '300', 10);
      await savePricingSnapshot(userId, cardId, result, undefined, ttlSeconds);
      logger.info('Pricing result cached', { userId, cardId, ttlSeconds });
    } catch (err) {
      // Don't fail the request if caching fails
      logger.error('Failed to cache pricing result', err as Error, { userId, cardId });
    }
  }

  /**
   * Get status of all pricing sources
   */
  async getSourcesStatus(): Promise<Array<{ name: string; available: boolean }>> {
    const statuses = await Promise.all(
      this.sources.map(async (source) => ({
        name: source.name,
        available: await source.isAvailable(),
      })),
    );

    return statuses;
  }
}

/**
 * Singleton instance for reuse across Lambda invocations
 */
let orchestratorInstance: PricingOrchestrator | null = null;

/**
 * Get or create pricing orchestrator instance
 */
export function getPricingOrchestrator(): PricingOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new PricingOrchestrator();
  }
  return orchestratorInstance;
}
