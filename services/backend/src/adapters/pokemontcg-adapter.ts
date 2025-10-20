/**
 * Pokémon TCG API pricing adapter
 * Free API with market pricing data from TCGPlayer
 * https://pokemontcg.io/
 */

import { PriceQuery, RawComp } from '@collectiq/shared';
import { BasePriceAdapter } from './base-price-adapter.js';
import { logger, getSecret } from '../utils/index.js';

interface PokemonTCGCard {
  id: string;
  name: string;
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    releaseDate: string;
  };
  number: string;
  rarity: string;
  images: {
    small: string;
    large: string;
  };
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices?: {
      holofoil?: PricePoint;
      reverseHolofoil?: PricePoint;
      normal?: PricePoint;
      '1stEditionHolofoil'?: PricePoint;
      '1stEditionNormal'?: PricePoint;
      unlimitedHolofoil?: PricePoint;
    };
  };
  cardmarket?: {
    url: string;
    updatedAt: string;
    prices: {
      averageSellPrice: number;
      lowPrice: number;
      trendPrice: number;
      avg1: number;
      avg7: number;
      avg30: number;
    };
  };
}

interface PricePoint {
  low: number;
  mid: number;
  high: number;
  market: number;
  directLow?: number;
}

interface PokemonTCGResponse {
  data: PokemonTCGCard[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

export class PokemonTCGAdapter extends BasePriceAdapter {
  name = 'PokemonTCG';
  private readonly BASE_URL = 'https://api.pokemontcg.io/v2';
  private apiKey: string | null = null;

  constructor() {
    super(20); // 20 requests per minute (conservative for free tier)
  }

  /**
   * Fetch comparable sales from Pokémon TCG API
   */
  protected async fetchCompsInternal(query: PriceQuery): Promise<RawComp[]> {
    // Get API key (optional but increases rate limit)
    await this.ensureApiKey();

    // Search for cards matching the query
    const cards = await this.searchCards(query);

    if (cards.length === 0) {
      logger.info('No Pokémon TCG cards found', { query });
      return [];
    }

    // Extract pricing data from all matching cards
    const allComps: RawComp[] = [];

    for (const card of cards) {
      const comps = this.extractCompsFromCard(card, query);
      allComps.push(...comps);
    }

    logger.info(`Pokémon TCG adapter fetched ${allComps.length} comps from ${cards.length} cards`, {
      query,
    });

    return allComps;
  }

  /**
   * Ensure we have an API key (optional but recommended)
   */
  private async ensureApiKey(): Promise<void> {
    if (this.apiKey) {
      return;
    }

    try {
      // Try to get API key from Secrets Manager
      this.apiKey = await getSecret('POKEMON_TCG_API_KEY');
      logger.info('Pokémon TCG API key loaded');
    } catch (error) {
      // API key is optional - free tier works without it
      logger.warn('No Pokémon TCG API key found, using free tier', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.apiKey = null;
    }
  }

  /**
   * Search for cards matching the query
   */
  private async searchCards(query: PriceQuery): Promise<PokemonTCGCard[]> {
    const searchQuery = this.buildSearchQuery(query);
    const url = `${this.BASE_URL}/cards?q=${encodeURIComponent(searchQuery)}&pageSize=10`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-Api-Key'] = this.apiKey;
    }

    logger.info('Searching Pokémon TCG API', {
      searchQuery,
      url,
      hasApiKey: !!this.apiKey,
      cardName: query.cardName,
      set: query.set,
      number: query.number,
    });

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Pokémon TCG API request failed', new Error(errorText), {
        status: response.status,
        statusText: response.statusText,
        url,
        searchQuery,
      });
      throw new Error(`Pokémon TCG API search failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as PokemonTCGResponse;

    logger.info(`Found ${data.data.length} cards from Pokémon TCG API`, {
      totalCount: data.totalCount,
      query: searchQuery,
      cardNames: data.data.slice(0, 3).map((c) => c.name),
    });

    // If no exact matches, try a simpler search with just the card name
    if (data.data.length === 0 && query.cardName) {
      logger.warn('No exact matches found, trying simplified search', {
        originalQuery: searchQuery,
        simplifiedQuery: query.cardName,
      });

      const simpleUrl = `${this.BASE_URL}/cards?q=name:${encodeURIComponent(query.cardName)}&pageSize=10`;
      const simpleResponse = await fetch(simpleUrl, {
        method: 'GET',
        headers,
      });

      if (simpleResponse.ok) {
        const simpleData = (await simpleResponse.json()) as PokemonTCGResponse;
        logger.info(`Simplified search found ${simpleData.data.length} cards`, {
          cardNames: simpleData.data.slice(0, 3).map((c) => c.name),
        });
        return simpleData.data;
      }
    }

    return data.data;
  }

  /**
   * Build search query string for Pokémon TCG API
   * Uses fuzzy matching for card names to handle OCR variations
   */
  private buildSearchQuery(query: PriceQuery): string {
    const conditions: string[] = [];

    // Card name (required) - use wildcard for fuzzy matching
    if (query.cardName) {
      // Clean up the card name (remove special characters that might confuse the API)
      const cleanName = query.cardName.replace(/[^\w\s-]/g, '').trim();

      // Use wildcard search for better matching with OCR results
      conditions.push(`name:*${cleanName}*`);
    }

    // Set name - only add if we have it
    if (query.set) {
      const cleanSet = query.set.replace(/[^\w\s-]/g, '').trim();
      conditions.push(`set.name:*${cleanSet}*`);
    }

    // Card number - exact match
    if (query.number) {
      conditions.push(`number:${query.number}`);
    }

    // Note: Rarity is not in PriceQuery type, but could be added in future
    // For now, we search by name, set, and number which is sufficient

    return conditions.join(' ');
  }

  /**
   * Extract pricing comps from a card
   */
  private extractCompsFromCard(card: PokemonTCGCard, query: PriceQuery): RawComp[] {
    const comps: RawComp[] = [];
    const now = new Date().toISOString();

    // Extract TCGPlayer prices
    if (card.tcgplayer?.prices) {
      const prices = card.tcgplayer.prices;

      // Determine which price variant to use based on card rarity
      const priceVariant = this.selectPriceVariant(prices, card.rarity);

      if (priceVariant) {
        // Create comps for low, mid, high, and market prices
        if (priceVariant.low) {
          comps.push({
            source: 'PokemonTCG',
            price: priceVariant.low,
            currency: 'USD',
            soldDate: card.tcgplayer.updatedAt || now,
            condition: query.condition || 'Near Mint',
            listingUrl: card.tcgplayer.url,
          });
        }

        if (priceVariant.market) {
          comps.push({
            source: 'PokemonTCG',
            price: priceVariant.market,
            currency: 'USD',
            soldDate: card.tcgplayer.updatedAt || now,
            condition: query.condition || 'Near Mint',
            listingUrl: card.tcgplayer.url,
          });
        }

        if (priceVariant.high) {
          comps.push({
            source: 'PokemonTCG',
            price: priceVariant.high,
            currency: 'USD',
            soldDate: card.tcgplayer.updatedAt || now,
            condition: query.condition || 'Near Mint',
            listingUrl: card.tcgplayer.url,
          });
        }
      }
    }

    // Extract CardMarket prices (European market)
    if (card.cardmarket?.prices) {
      const prices = card.cardmarket.prices;

      if (prices.trendPrice) {
        comps.push({
          source: 'PokemonTCG',
          price: prices.trendPrice,
          currency: 'EUR',
          soldDate: card.cardmarket.updatedAt || now,
          condition: query.condition || 'Near Mint',
          listingUrl: card.cardmarket.url,
        });
      }

      if (prices.averageSellPrice) {
        comps.push({
          source: 'PokemonTCG',
          price: prices.averageSellPrice,
          currency: 'EUR',
          soldDate: card.cardmarket.updatedAt || now,
          condition: query.condition || 'Near Mint',
          listingUrl: card.cardmarket.url,
        });
      }
    }

    return comps;
  }

  /**
   * Select the appropriate price variant based on card rarity
   */
  private selectPriceVariant(
    prices: NonNullable<PokemonTCGCard['tcgplayer']>['prices'],
    rarity: string
  ): PricePoint | null {
    if (!prices) return null;

    // Check for holographic cards
    if (this.isHolographic(rarity)) {
      return prices.holofoil || prices.reverseHolofoil || prices.unlimitedHolofoil || null;
    }

    // Check for reverse holo
    if (rarity?.toLowerCase().includes('reverse')) {
      return prices.reverseHolofoil || prices.normal || null;
    }

    // Check for 1st Edition
    if (rarity?.toLowerCase().includes('1st edition')) {
      return prices['1stEditionNormal'] || prices.normal || null;
    }

    // Default to normal pricing, fallback to holofoil if normal not available
    return prices.normal || prices.holofoil || null;
  }

  /**
   * Determine if card is holographic based on rarity
   */
  private isHolographic(rarity?: string): boolean {
    if (!rarity) return false;

    const rarityLower = rarity.toLowerCase();
    const holoKeywords = [
      'holo',
      'holographic',
      'ultra rare',
      'secret rare',
      'rainbow rare',
      'full art',
      'vmax',
      'vstar',
      'ex',
      'gx',
    ];

    return holoKeywords.some((keyword) => rarityLower.includes(keyword));
  }
}
