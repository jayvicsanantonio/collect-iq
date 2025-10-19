/**
 * PriceCharting API pricing adapter
 */

import { PriceQuery, RawComp } from '@collectiq/shared';
import { BasePriceAdapter } from './base-price-adapter.js';
import { logger, getSecret } from '../utils/index.js';

interface PriceChartingProduct {
  id: string;
  'product-name': string;
  'console-name': string;
  'loose-price': number;
  'cib-price': number;
  'new-price': number;
  'graded-price': number;
  'box-only-price': number;
  'manual-only-price': number;
  genre: string;
  'release-date': string;
  upc: string;
  asin: string;
}

interface PriceChartingSearchResponse {
  products: PriceChartingProduct[];
  status: string;
}

interface PriceChartingHistoryResponse {
  id: string;
  'product-name': string;
  prices: Array<{
    date: string;
    'loose-price': number;
    'cib-price': number;
    'new-price': number;
    'graded-price': number;
  }>;
  status: string;
}

export class PriceChartingAdapter extends BasePriceAdapter {
  name = 'PriceCharting';
  private readonly BASE_URL = 'https://www.pricecharting.com/api';

  constructor() {
    super(10); // 10 requests per minute for PriceCharting (conservative)
  }

  /**
   * Fetch comparable sales from PriceCharting API
   */
  protected async fetchCompsInternal(query: PriceQuery): Promise<RawComp[]> {
    // Retrieve API key from Secrets Manager (cached internally with TTL)
    const apiKey = await getSecret('PRICECHARTING_KEY');

    // Search for products
    const products = await this.searchProducts(query, apiKey);

    if (products.length === 0) {
      logger.info('No PriceCharting products found', { query });
      return [];
    }

    // Get pricing for the best match
    const allComps: RawComp[] = [];

    for (const product of products.slice(0, 3)) {
      // Limit to top 3 matches
      const comps = this.extractCompsFromProduct(product, query);
      allComps.push(...comps);

      // Optionally fetch historical data for more data points
      if (query.windowDays > 7) {
        const historicalComps = await this.getHistoricalPricing(product.id, query, apiKey);
        allComps.push(...historicalComps);
      }
    }

    logger.info(`PriceCharting adapter fetched ${allComps.length} comps`, { query });
    return allComps;
  }

  /**
   * Search for products matching the query
   */
  private async searchProducts(query: PriceQuery, apiKey: string): Promise<PriceChartingProduct[]> {
    const searchTerm = this.buildSearchTerm(query);
    const url = `${this.BASE_URL}/products?t=${apiKey}&q=${encodeURIComponent(searchTerm)}&type=pokemon-card`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`PriceCharting search failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as PriceChartingSearchResponse;

    if (data.status !== 'success') {
      throw new Error(`PriceCharting API returned status: ${data.status}`);
    }

    return data.products || [];
  }

  /**
   * Get historical pricing data for a product
   */
  private async getHistoricalPricing(
    productId: string,
    query: PriceQuery,
    apiKey: string,
  ): Promise<RawComp[]> {
    const url = `${this.BASE_URL}/product?t=${apiKey}&id=${productId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        logger.warn(`Failed to get historical pricing for product ${productId}`, {
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as PriceChartingHistoryResponse;

      if (data.status !== 'success' || !data.prices) {
        return [];
      }

      return this.parseHistoricalData(data, query);
    } catch (error) {
      logger.warn('Failed to fetch historical pricing', { error, productId });
      return [];
    }
  }

  /**
   * Build search term from query
   */
  private buildSearchTerm(query: PriceQuery): string {
    const parts = [query.cardName];

    if (query.set) {
      parts.push(query.set);
    }

    if (query.number) {
      parts.push(`#${query.number}`);
    }

    return parts.join(' ');
  }

  /**
   * Extract comps from product current pricing
   */
  private extractCompsFromProduct(product: PriceChartingProduct, query: PriceQuery): RawComp[] {
    const comps: RawComp[] = [];
    const now = new Date().toISOString();

    // Map PriceCharting price types to conditions
    const priceMap = [
      { price: product['new-price'], condition: 'Mint' },
      { price: product['graded-price'], condition: 'Mint' },
      { price: product['cib-price'], condition: 'Near Mint' },
      { price: product['loose-price'], condition: 'Good' },
    ];

    for (const { price, condition } of priceMap) {
      if (price > 0) {
        // Filter by condition if specified
        if (query.condition && condition !== query.condition) {
          continue;
        }

        comps.push({
          source: 'PriceCharting',
          price,
          currency: 'USD',
          condition,
          soldDate: now,
          listingUrl: `https://www.pricecharting.com/game/pokemon-card/${encodeURIComponent(product['product-name'])}`,
        });
      }
    }

    return comps;
  }

  /**
   * Parse historical pricing data
   */
  private parseHistoricalData(data: PriceChartingHistoryResponse, query: PriceQuery): RawComp[] {
    const comps: RawComp[] = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - query.windowDays);

    for (const pricePoint of data.prices) {
      const priceDate = new Date(pricePoint.date);

      // Only include prices within the window
      if (priceDate < cutoffDate) {
        continue;
      }

      const priceMap = [
        { price: pricePoint['new-price'], condition: 'Mint' },
        { price: pricePoint['graded-price'], condition: 'Mint' },
        { price: pricePoint['cib-price'], condition: 'Near Mint' },
        { price: pricePoint['loose-price'], condition: 'Good' },
      ];

      for (const { price, condition } of priceMap) {
        if (price > 0) {
          // Filter by condition if specified
          if (query.condition && condition !== query.condition) {
            continue;
          }

          comps.push({
            source: 'PriceCharting',
            price,
            currency: 'USD',
            condition,
            soldDate: pricePoint.date,
            listingUrl: `https://www.pricecharting.com/game/pokemon-card/${encodeURIComponent(data['product-name'])}`,
          });
        }
      }
    }

    return comps;
  }
}
