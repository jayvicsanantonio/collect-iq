/**
 * API-Level Pricing Cache Service
 * Caches pricing data based on card identifiers (name + set) for cross-user reuse
 * This reduces API calls when multiple users upload the same card
 */

import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { RawComp } from '@collectiq/shared';
import { getDynamoDBClient, getTableName, calculateTTL } from './dynamodb-client.js';
import { logger } from '../utils/logger.js';

/**
 * DynamoDB item structure for API pricing cache
 * Uses a global partition key for cross-user access
 */
interface APIPricingCacheItem {
  PK: string; // 'API_CACHE'
  SK: string; // 'PRICE#{cardName}#{set}'
  entityType: 'API_PRICE_CACHE';
  cacheKey: string;
  rawComps: RawComp[];
  createdAt: string;
  ttl: number;
}

/**
 * Default TTL for API pricing cache (3600 seconds = 1 hour)
 * Longer than user cache since API data changes less frequently
 */
const DEFAULT_API_CACHE_TTL_SECONDS = 3600;

/**
 * Generate cache key from card identifiers
 */
function generateCacheKey(cardName: string, set?: string): string {
  const normalizedName = cardName.toLowerCase().trim();
  const normalizedSet = set?.toLowerCase().trim() || 'unknown';
  return `${normalizedName}|${normalizedSet}`;
}

/**
 * Generate SK for API pricing cache
 */
function generateAPIPriceSK(cacheKey: string): string {
  return `PRICE#${cacheKey}`;
}

/**
 * Get cached pricing data from API cache
 *
 * @param cardName - Card name
 * @param set - Set name (optional)
 * @param requestId - Request ID for logging
 * @returns Cached raw comps if found and not expired, null otherwise
 */
export async function getAPIPricingCache(
  cardName: string,
  set?: string,
  requestId?: string
): Promise<RawComp[] | null> {
  const cacheKey = generateCacheKey(cardName, set);

  logger.info('Getting API pricing cache', {
    operation: 'getAPIPricingCache',
    cardName,
    set,
    cacheKey,
    requestId,
  });

  try {
    const client = getDynamoDBClient();
    const tableName = getTableName();

    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          PK: 'API_CACHE',
          SK: generateAPIPriceSK(cacheKey),
        },
        ConsistentRead: false, // Eventually consistent is fine for cache
      })
    );

    if (!result.Item) {
      logger.info('API pricing cache miss', {
        operation: 'getAPIPricingCache',
        cardName,
        set,
        cacheKey,
        requestId,
      });
      return null;
    }

    const item = result.Item as unknown as APIPricingCacheItem;

    // Check if expired
    const now = Math.floor(Date.now() / 1000);
    if (item.ttl && item.ttl < now) {
      logger.info('API pricing cache expired', {
        operation: 'getAPIPricingCache',
        cardName,
        set,
        cacheKey,
        ttl: item.ttl,
        now,
        requestId,
      });
      return null;
    }

    logger.info('API pricing cache hit', {
      operation: 'getAPIPricingCache',
      cardName,
      set,
      cacheKey,
      compsCount: item.rawComps.length,
      createdAt: item.createdAt,
      requestId,
    });

    return item.rawComps;
  } catch (error) {
    logger.error(
      'Failed to get API pricing cache',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'getAPIPricingCache',
        cardName,
        set,
        cacheKey,
        requestId,
      }
    );
    // Don't throw error for cache miss - return null instead
    return null;
  }
}

/**
 * Save pricing data to API cache
 *
 * @param cardName - Card name
 * @param set - Set name (optional)
 * @param rawComps - Raw comps to cache
 * @param requestId - Request ID for logging
 * @param ttlSeconds - TTL in seconds (default: 3600)
 */
export async function saveAPIPricingCache(
  cardName: string,
  set: string | undefined,
  rawComps: RawComp[],
  requestId?: string,
  ttlSeconds: number = DEFAULT_API_CACHE_TTL_SECONDS
): Promise<void> {
  const cacheKey = generateCacheKey(cardName, set);
  const timestamp = new Date().toISOString();

  logger.info('Saving API pricing cache', {
    operation: 'saveAPIPricingCache',
    cardName,
    set,
    cacheKey,
    compsCount: rawComps.length,
    ttlSeconds,
    requestId,
  });

  try {
    const client = getDynamoDBClient();
    const tableName = getTableName();

    const item: APIPricingCacheItem = {
      PK: 'API_CACHE',
      SK: generateAPIPriceSK(cacheKey),
      entityType: 'API_PRICE_CACHE',
      cacheKey,
      rawComps,
      createdAt: timestamp,
      ttl: calculateTTL(ttlSeconds),
    };

    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      })
    );

    logger.info('API pricing cache saved successfully', {
      operation: 'saveAPIPricingCache',
      cardName,
      set,
      cacheKey,
      compsCount: rawComps.length,
      timestamp,
      requestId,
    });
  } catch (error) {
    logger.error(
      'Failed to save API pricing cache',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'saveAPIPricingCache',
        cardName,
        set,
        cacheKey,
        requestId,
      }
    );
    // Don't throw - cache save failure shouldn't break the flow
  }
}
