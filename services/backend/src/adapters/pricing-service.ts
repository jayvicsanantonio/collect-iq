/**
 * Pricing service with normalization and fusion logic
 */

import { PriceQuery, RawComp, PricingResult } from '@collectiq/shared';
import { logger } from '../utils/logger.js';

interface NormalizedComp {
  source: string;
  price: number; // Always in USD
  condition: string; // Standardized condition
  soldDate: Date;
  listingUrl?: string;
}

/**
 * Standard condition scale
 */
type StandardCondition = 'Poor' | 'Good' | 'Excellent' | 'Near Mint' | 'Mint';

/**
 * Currency conversion rates (simplified - in production, use live rates)
 */
const CURRENCY_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  AUD: 0.65,
  JPY: 0.0067,
};

export class PricingService {
  /**
   * Normalize raw comps to standard format
   */
  normalize(comps: RawComp[]): NormalizedComp[] {
    const normalized: NormalizedComp[] = [];

    for (const comp of comps) {
      try {
        const normalizedComp: NormalizedComp = {
          source: comp.source,
          price: this.convertToUSD(comp.price, comp.currency),
          condition: this.normalizeCondition(comp.condition),
          soldDate: new Date(comp.soldDate),
          listingUrl: comp.listingUrl,
        };

        // Validate the normalized comp
        if (normalizedComp.price > 0 && !isNaN(normalizedComp.price)) {
          normalized.push(normalizedComp);
        }
      } catch (error) {
        logger.warn('Failed to normalize comp', { error, comp });
        continue;
      }
    }

    logger.info(`Normalized ${normalized.length} comps from ${comps.length} raw comps`);
    return normalized;
  }

  /**
   * Fuse normalized comps into pricing result with outlier removal
   */
  fuse(comps: NormalizedComp[], query: PriceQuery): PricingResult {
    if (comps.length === 0) {
      throw new Error('Cannot fuse empty comps array');
    }

    // Remove outliers using IQR method
    const filteredComps = this.removeOutliers(comps);

    if (filteredComps.length === 0) {
      logger.warn('All comps were filtered as outliers, using original data');
      // Fall back to original data if all were filtered
      return this.computePricingResult(comps, query);
    }

    return this.computePricingResult(filteredComps, query);
  }

  /**
   * Convert price to USD
   */
  private convertToUSD(price: number, currency: string): number {
    const rate = CURRENCY_RATES[currency.toUpperCase()];

    if (!rate) {
      logger.warn(`Unknown currency ${currency}, assuming USD`);
      return price;
    }

    return price * rate;
  }

  /**
   * Normalize condition to standard scale
   */
  private normalizeCondition(condition: string): StandardCondition {
    const normalized = condition.toLowerCase().trim();

    // Mint conditions
    if (normalized.includes('mint') && !normalized.includes('near')) {
      return 'Mint';
    }
    if (normalized.includes('gem') || normalized.includes('pristine')) {
      return 'Mint';
    }

    // Near Mint conditions
    if (normalized.includes('near mint') || normalized.includes('nm')) {
      return 'Near Mint';
    }
    if (normalized.includes('like new') || normalized.includes('excellent+')) {
      return 'Near Mint';
    }

    // Excellent conditions
    if (normalized.includes('excellent') || normalized.includes('very good')) {
      return 'Excellent';
    }
    if (normalized.includes('lightly played') || normalized.includes('lp')) {
      return 'Excellent';
    }

    // Good conditions
    if (normalized.includes('good') || normalized.includes('played')) {
      return 'Good';
    }
    if (normalized.includes('moderately played') || normalized.includes('mp')) {
      return 'Good';
    }

    // Poor conditions
    if (normalized.includes('poor') || normalized.includes('damaged')) {
      return 'Poor';
    }
    if (normalized.includes('heavily played') || normalized.includes('hp')) {
      return 'Poor';
    }

    // Default to Good if unknown
    logger.warn(`Unknown condition "${condition}", defaulting to Good`);
    return 'Good';
  }

  /**
   * Remove outliers using Interquartile Range (IQR) method
   */
  private removeOutliers(comps: NormalizedComp[]): NormalizedComp[] {
    if (comps.length < 4) {
      // Not enough data for IQR, return all
      return comps;
    }

    // Sort by price
    const sorted = [...comps].sort((a, b) => a.price - b.price);
    const prices = sorted.map((c) => c.price);

    // Calculate quartiles
    const q1 = this.percentile(prices, 25);
    const q3 = this.percentile(prices, 75);
    const iqr = q3 - q1;

    // Define outlier bounds
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    // Filter outliers
    const filtered = comps.filter((comp) => comp.price >= lowerBound && comp.price <= upperBound);

    const removedCount = comps.length - filtered.length;
    if (removedCount > 0) {
      logger.info(`Removed ${removedCount} outliers using IQR method`, {
        lowerBound,
        upperBound,
        originalCount: comps.length,
        filteredCount: filtered.length,
      });
    }

    return filtered;
  }

  /**
   * Compute pricing result from filtered comps
   */
  private computePricingResult(comps: NormalizedComp[], query: PriceQuery): PricingResult {
    const prices = comps.map((c) => c.price).sort((a, b) => a - b);
    const sources = [...new Set(comps.map((c) => c.source))];

    // Calculate percentiles
    const valueLow = this.percentile(prices, 10);
    const valueMedian = this.percentile(prices, 50);
    const valueHigh = this.percentile(prices, 90);

    // Calculate confidence based on sample size and variance
    const confidence = this.calculateConfidence(prices);

    // Calculate volatility (coefficient of variation)
    const volatility = this.calculateVolatility(prices);

    return {
      valueLow,
      valueMedian,
      valueHigh,
      compsCount: comps.length,
      windowDays: query.windowDays,
      sources,
      confidence,
      volatility,
    };
  }

  /**
   * Calculate percentile of sorted array
   */
  private percentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) {
      return 0;
    }

    if (sortedArray.length === 1) {
      return sortedArray[0];
    }

    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Calculate confidence score based on sample size and variance
   */
  private calculateConfidence(prices: number[]): number {
    if (prices.length === 0) {
      return 0;
    }

    // Sample size factor (0-1, higher is better)
    const sampleSizeFactor = Math.min(prices.length / 50, 1.0);

    // Variance factor (0-1, lower variance is better)
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
    const varianceFactor = Math.max(0, 1 - coefficientOfVariation);

    // Combined confidence (weighted average)
    const confidence = sampleSizeFactor * 0.6 + varianceFactor * 0.4;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate volatility (coefficient of variation)
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length === 0) {
      return 0;
    }

    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    if (mean === 0) {
      return 0;
    }

    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / mean;
  }
}
