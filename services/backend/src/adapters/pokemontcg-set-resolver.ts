/**
 * Pokémon TCG Set Resolver
 * Uses the Pokémon TCG API to verify and resolve card sets based on collector numbers
 */

import { logger } from '../utils/logger.js';

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
}

interface PokemonTCGResponse {
  data: PokemonTCGCard[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

interface SetMatch {
  setName: string;
  setSeries: string;
  collectorNumber: string;
  rarity: string;
  confidence: number;
  matchReason: string;
}

export class PokemonTCGSetResolver {
  private readonly BASE_URL = 'https://api.pokemontcg.io/v2';
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null;
  }

  /**
   * Resolve the correct set for a card by matching collector number
   *
   * @param cardName - Card name extracted by OCR/AI
   * @param collectorNumber - Collector number from OCR (e.g., "018/195", "SWSH108")
   * @returns Set match with confidence score, or null if no match found
   */
  async resolveSet(
    cardName: string,
    collectorNumber: string | null,
    requestId?: string
  ): Promise<SetMatch | null> {
    if (!cardName) {
      logger.warn('Cannot resolve set without card name', { requestId });
      return null;
    }

    try {
      // Search for all printings of this card
      const cards = await this.searchCardByName(cardName);

      if (cards.length === 0) {
        logger.info('No cards found in Pokémon TCG API', { cardName, requestId });
        return null;
      }

      logger.info(`Found ${cards.length} printings of card`, {
        cardName,
        printings: cards.map((c) => ({ set: c.set.name, number: c.number })),
        requestId,
      });

      // If we have a collector number, try to match it
      if (collectorNumber) {
        const exactMatch = this.findExactMatch(cards, collectorNumber);
        if (exactMatch) {
          logger.info('Found exact collector number match', {
            cardName,
            collectorNumber,
            setName: exactMatch.setName,
            requestId,
          });
          return exactMatch;
        }

        // Try fuzzy matching (handle OCR errors)
        const fuzzyMatch = this.findFuzzyMatch(cards, collectorNumber);
        if (fuzzyMatch) {
          logger.info('Found fuzzy collector number match', {
            cardName,
            collectorNumber,
            matchedNumber: fuzzyMatch.collectorNumber,
            setName: fuzzyMatch.setName,
            requestId,
          });
          return fuzzyMatch;
        }
      }

      // No collector number or no match - return most recent printing
      const mostRecent = this.getMostRecentPrinting(cards);
      logger.info('Using most recent printing (no collector number match)', {
        cardName,
        collectorNumber,
        setName: mostRecent.setName,
        requestId,
      });
      return mostRecent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage.includes('timed out') || errorMessage.includes('AbortError');

      // Log timeouts as warnings (expected), other errors as errors
      if (isTimeout) {
        logger.warn('Pokémon TCG API request timed out, will use AI result', {
          cardName,
          collectorNumber,
          timeout: '20 seconds',
          requestId,
        });
      } else {
        logger.error(
          'Failed to resolve set via Pokémon TCG API',
          error instanceof Error ? error : new Error(String(error)),
          {
            cardName,
            collectorNumber,
            requestId,
          }
        );
      }
      return null;
    }
  }

  /**
   * Search for cards by name with timeout
   */
  private async searchCardByName(cardName: string): Promise<PokemonTCGCard[]> {
    const cleanName = cardName.replace(/[^\w\s-]/g, '').trim();
    const url = `${this.BASE_URL}/cards?q=name:"${cleanName}"&pageSize=50`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-Api-Key'] = this.apiKey;
    }

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Pokémon TCG API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as PokemonTCGResponse;
      return data.data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Pokémon TCG API request timed out after 20 seconds');
      }
      throw error;
    }
  }

  /**
   * Find exact collector number match
   */
  private findExactMatch(cards: PokemonTCGCard[], collectorNumber: string): SetMatch | null {
    const normalizedTarget = this.normalizeCollectorNumber(collectorNumber);

    for (const card of cards) {
      const normalizedCard = this.normalizeCollectorNumber(card.number);

      if (normalizedCard === normalizedTarget) {
        return {
          setName: card.set.name,
          setSeries: card.set.series,
          collectorNumber: card.number,
          rarity: card.rarity,
          confidence: 1.0,
          matchReason: 'Exact collector number match',
        };
      }
    }

    return null;
  }

  /**
   * Find fuzzy collector number match (handles OCR errors)
   */
  private findFuzzyMatch(cards: PokemonTCGCard[], collectorNumber: string): SetMatch | null {
    const normalizedTarget = this.normalizeCollectorNumber(collectorNumber);

    // Extract just the card number (before the /)
    const targetNumber = normalizedTarget.split('/')[0];

    let bestMatch: { card: PokemonTCGCard; confidence: number } | null = null;

    for (const card of cards) {
      const normalizedCard = this.normalizeCollectorNumber(card.number);
      const cardNumber = normalizedCard.split('/')[0];

      // Check if the card numbers match (ignoring total count)
      if (cardNumber === targetNumber) {
        const confidence = 0.85; // High confidence for number match
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { card, confidence };
        }
      }
    }

    if (bestMatch) {
      return {
        setName: bestMatch.card.set.name,
        setSeries: bestMatch.card.set.series,
        collectorNumber: bestMatch.card.number,
        rarity: bestMatch.card.rarity,
        confidence: bestMatch.confidence,
        matchReason: 'Fuzzy collector number match (card number only)',
      };
    }

    return null;
  }

  /**
   * Get most recent printing (fallback when no collector number match)
   */
  private getMostRecentPrinting(cards: PokemonTCGCard[]): SetMatch {
    // Sort by release date descending
    const sorted = [...cards].sort((a, b) => {
      const dateA = new Date(a.set.releaseDate).getTime();
      const dateB = new Date(b.set.releaseDate).getTime();
      return dateB - dateA;
    });

    const mostRecent = sorted[0];

    return {
      setName: mostRecent.set.name,
      setSeries: mostRecent.set.series,
      collectorNumber: mostRecent.number,
      rarity: mostRecent.rarity,
      confidence: 0.5,
      matchReason: 'Most recent printing (no collector number match)',
    };
  }

  /**
   * Normalize collector number for comparison
   * Handles variations like "018/195", "18/195", "SWSH108", etc.
   */
  private normalizeCollectorNumber(number: string): string {
    return number.toUpperCase().replace(/\s+/g, '').replace(/^0+/, ''); // Remove leading zeros
  }
}

/**
 * Create a singleton instance
 */
let resolverInstance: PokemonTCGSetResolver | null = null;

export function getPokemonTCGSetResolver(apiKey?: string): PokemonTCGSetResolver {
  if (!resolverInstance) {
    resolverInstance = new PokemonTCGSetResolver(apiKey);
  }
  return resolverInstance;
}
