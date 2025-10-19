/**
 * TCGPlayer API pricing adapter
 */

import { PriceQuery, RawComp } from '@collectiq/shared';
import { BasePriceAdapter } from './base-price-adapter.js';
import { logger, getSecretJson } from '../utils/index.js';

interface TCGPlayerCredentials {
  publicKey: string;
  privateKey: string;
}

interface TCGPlayerAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  userName: string;
  '.issued': string;
  '.expires': string;
}

interface TCGPlayerProduct {
  productId: number;
  name: string;
  cleanName: string;
  groupId: number;
  url: string;
}

interface TCGPlayerPricingResult {
  subTypeName?: string;
  conditionName?: string;
  marketPrice?: number;
  midPrice?: number;
  lowPrice?: number;
  highPrice?: number;
}

export class TCGPlayerAdapter extends BasePriceAdapter {
  name = 'TCGPlayer';
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private readonly BASE_URL = 'https://api.tcgplayer.com';
  private readonly AUTH_URL = 'https://api.tcgplayer.com/token';
  private readonly POKEMON_CATEGORY_ID = 3; // Pokémon TCG category

  constructor() {
    super(30); // 30 requests per minute for TCGPlayer
  }

  /**
   * Fetch comparable sales from TCGPlayer API
   */
  protected async fetchCompsInternal(query: PriceQuery): Promise<RawComp[]> {
    // Ensure we have valid authentication
    await this.ensureAuthenticated();

    // Search for the product
    const products = await this.searchProducts(query);

    if (products.length === 0) {
      logger.info('No TCGPlayer products found', { query });
      return [];
    }

    // Get pricing for all found products
    const allComps: RawComp[] = [];

    for (const product of products.slice(0, 5)) {
      // Limit to top 5 matches
      const comps = await this.getProductPricing(product, query);
      allComps.push(...comps);
    }

    logger.info(`TCGPlayer adapter fetched ${allComps.length} comps`, { query });
    return allComps;
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureAuthenticated(): Promise<void> {
    // Check if token is still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return;
    }

    // Load credentials from Secrets Manager (cached internally with TTL)
    const credentials = await getSecretJson<TCGPlayerCredentials>('TCGPLAYER_CREDENTIALS');

    // Request new access token
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.publicKey,
      client_secret: credentials.privateKey,
    });

    const response = await fetch(this.AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`TCGPlayer auth failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as TCGPlayerAuthResponse;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000 - 60000; // Refresh 1 min early

    logger.info('TCGPlayer authentication successful');
  }

  /**
   * Search for products matching the query
   */
  private async searchProducts(query: PriceQuery): Promise<TCGPlayerProduct[]> {
    const searchTerm = this.buildSearchTerm(query);
    const url = `${this.BASE_URL}/catalog/products?categoryId=${this.POKEMON_CATEGORY_ID}&productName=${encodeURIComponent(searchTerm)}&limit=10`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TCGPlayer search failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { results?: TCGPlayerProduct[] };
    return data.results || [];
  }

  /**
   * Get pricing data for a specific product
   */
  private async getProductPricing(
    product: TCGPlayerProduct,
    query: PriceQuery,
  ): Promise<RawComp[]> {
    const url = `${this.BASE_URL}/pricing/product/${product.productId}?getExtendedFields=true`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      logger.warn(`Failed to get pricing for product ${product.productId}`, {
        status: response.status,
      });
      return [];
    }

    const data = (await response.json()) as { results?: Array<TCGPlayerPricingResult> };
    return this.parsePricingResponse(data, product, query);
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
      parts.push(query.number);
    }

    return parts.join(' ');
  }

  /**
   * Parse pricing response into RawComp array
   */
  private parsePricingResponse(
    data: {
      results?: Array<TCGPlayerPricingResult>;
    },
    product: TCGPlayerProduct,
    query: PriceQuery,
  ): RawComp[] {
    const comps: RawComp[] = [];
    const results = data.results || [];

    for (const priceData of results) {
      try {
        const conditionLabel =
          priceData.conditionName || priceData.subTypeName || query.condition || 'Unspecified';
        const condition = this.mapTCGPlayerCondition(conditionLabel);

        // Filter by condition if specified
        if (query.condition && condition !== query.condition) {
          continue;
        }

        // Use market price as the primary price point
        const price = priceData.marketPrice || priceData.midPrice || 0;

        if (price > 0) {
          comps.push({
            source: 'TCGPlayer',
            price,
            currency: 'USD',
            condition,
            soldDate: new Date().toISOString(), // TCGPlayer doesn't provide exact sale dates
            listingUrl: product.url,
          });
        }

        // Also add low and high prices as separate data points
        if (priceData.lowPrice > 0) {
          comps.push({
            source: 'TCGPlayer',
            price: priceData.lowPrice,
            currency: 'USD',
            condition,
            soldDate: new Date().toISOString(),
            listingUrl: product.url,
          });
        }

        if (priceData.highPrice > 0 && priceData.highPrice !== priceData.lowPrice) {
          comps.push({
            source: 'TCGPlayer',
            price: priceData.highPrice,
            currency: 'USD',
            condition,
            soldDate: new Date().toISOString(),
            listingUrl: product.url,
          });
        }
      } catch (error) {
        logger.warn('Failed to parse TCGPlayer price data', { error });
        continue;
      }
    }

    return comps;
  }

  /**
   * Map TCGPlayer condition to standard format
   */
  private mapTCGPlayerCondition(tcgCondition: string): string {
    const normalized = tcgCondition.toLowerCase();

    if (
      normalized.includes('sealed') ||
      normalized.includes('factory') ||
      normalized.includes('graded')
    ) {
      return 'Mint';
    }
    if (normalized.includes('near mint')) {
      return 'Near Mint';
    }
    if (normalized.includes('mint') || normalized.includes('gem mint')) {
      return 'Mint';
    }
    if (
      normalized.includes('lightly played') ||
      normalized.includes('excellent') ||
      normalized.includes('lp')
    ) {
      return 'Excellent';
    }
    if (
      normalized.includes('moderately played') ||
      normalized.includes('good') ||
      normalized.includes('mp')
    ) {
      return 'Good';
    }
    if (
      normalized.includes('heavily played') ||
      normalized.includes('poor') ||
      normalized.includes('damaged') ||
      normalized.includes('hp')
    ) {
      return 'Poor';
    }

    return 'Near Mint'; // Default for "Normal" or unspecified
  }
}
