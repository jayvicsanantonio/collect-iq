/**
 * Pricing Cache Service
 * Implements pricing snapshot storage with TTL for automatic expiration
 */

import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { PricingResult, PricingResultSchema } from '@collectiq/shared';
import {
  getDynamoDBClient,
  getTableName,
  generateUserPK,
  generatePriceSK,
  extractPriceTimestamp,
  calculateTTL,
} from './dynamodb-client.js';
import { InternalServerError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * DynamoDB item structure for pricing snapshots
 */
interface PricingSnapshotItem {
  PK: string;
  SK: string;
  entityType: 'PRICE';
  userId: string;
  cardId: string;
  pricingResult: PricingResult;
  createdAt: string;
  ttl: number;
}

/**
 * Default TTL for pricing snapshots (300 seconds = 5 minutes)
 */
const DEFAULT_PRICING_TTL_SECONDS = 300;

/**
 * Save pricing snapshot to DynamoDB with TTL
 *
 * @param userId - Cognito user ID
 * @param cardId - Card UUID
 * @param pricingResult - Pricing result to cache
 * @param requestId - Request ID for logging
 * @param ttlSeconds - TTL in seconds (default: 300)
 * @returns Saved pricing result
 */
export async function savePricingSnapshot(
  userId: string,
  cardId: string,
  pricingResult: PricingResult,
  requestId?: string,
  ttlSeconds: number = DEFAULT_PRICING_TTL_SECONDS,
): Promise<PricingResult> {
  const timestamp = new Date().toISOString();

  logger.info('Saving pricing snapshot', {
    operation: 'savePricingSnapshot',
    userId,
    cardId,
    ttlSeconds,
    requestId,
  });

  try {
    // Validate pricing result
    const validated = PricingResultSchema.parse(pricingResult);

    const client = getDynamoDBClient();
    const tableName = getTableName();

    const item: PricingSnapshotItem = {
      PK: generateUserPK(userId),
      SK: generatePriceSK(timestamp),
      entityType: 'PRICE',
      userId,
      cardId,
      pricingResult: validated,
      createdAt: timestamp,
      ttl: calculateTTL(ttlSeconds),
    };

    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      }),
    );

    logger.info('Pricing snapshot saved successfully', {
      operation: 'savePricingSnapshot',
      userId,
      cardId,
      timestamp,
      requestId,
    });

    return validated;
  } catch (error) {
    logger.error(
      'Failed to save pricing snapshot',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'savePricingSnapshot',
        userId,
        cardId,
        requestId,
      },
    );
    throw new InternalServerError('Failed to save pricing snapshot', requestId || '');
  }
}

/**
 * Get the most recent pricing snapshot for a card
 *
 * @param userId - Cognito user ID
 * @param cardId - Card UUID
 * @param requestId - Request ID for logging
 * @returns Pricing result if found and not expired, null otherwise
 */
export async function getPricingSnapshot(
  userId: string,
  cardId: string,
  requestId?: string,
): Promise<PricingResult | null> {
  logger.info('Getting pricing snapshot', {
    operation: 'getPricingSnapshot',
    userId,
    cardId,
    requestId,
  });

  try {
    const client = getDynamoDBClient();
    const tableName = getTableName();

    // Query for pricing snapshots, sorted by timestamp descending
    const now = Math.floor(Date.now() / 1000);
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const result = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': generateUserPK(userId),
            ':skPrefix': 'PRICE#',
          },
          ScanIndexForward: false, // Sort descending (newest first)
          ConsistentRead: true,
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );

      if (!result.Items || result.Items.length === 0) {
        if (!exclusiveStartKey) {
          logger.info('No pricing snapshots found', {
            operation: 'getPricingSnapshot',
            userId,
            cardId,
            requestId,
          });
        }
        return null;
      }

      for (const item of result.Items as unknown as PricingSnapshotItem[]) {
        if (item.cardId !== cardId) {
          continue;
        }

        if (item.ttl && item.ttl < now) {
          logger.info('Pricing snapshot expired', {
            operation: 'getPricingSnapshot',
            userId,
            cardId,
            timestamp: extractPriceTimestamp(item.SK),
            ttl: item.ttl,
            now,
            requestId,
          });
          continue;
        }

        logger.info('Pricing snapshot found', {
          operation: 'getPricingSnapshot',
          userId,
          cardId,
          timestamp: extractPriceTimestamp(item.SK),
          requestId,
        });

        return PricingResultSchema.parse(item.pricingResult);
      }

      exclusiveStartKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey);

    logger.info('No valid pricing snapshots found', {
      operation: 'getPricingSnapshot',
      userId,
      cardId,
      requestId,
    });

    return null;
  } catch (error) {
    logger.error(
      'Failed to get pricing snapshot',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'getPricingSnapshot',
        userId,
        cardId,
        requestId,
      },
    );
    // Don't throw error for cache miss - return null instead
    return null;
  }
}

/**
 * Delete all pricing snapshots for a card
 * Useful for cache invalidation
 *
 * @param userId - Cognito user ID
 * @param cardId - Card UUID
 * @param requestId - Request ID for logging
 */
export async function deletePricingSnapshots(
  userId: string,
  cardId: string,
  requestId?: string,
): Promise<void> {
  logger.info('Deleting pricing snapshots', {
    operation: 'deletePricingSnapshots',
    userId,
    cardId,
    requestId,
  });

  try {
    const client = getDynamoDBClient();
    const tableName = getTableName();

    // Query for all pricing snapshots
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': generateUserPK(userId),
          ':skPrefix': 'PRICE#',
        },
        ConsistentRead: true,
      }),
    );

    if (!result.Items || result.Items.length === 0) {
      return;
    }

    // Delete matching snapshots
    const deletePromises = result.Items.filter(
      (item: unknown) => (item as PricingSnapshotItem).cardId === cardId,
    ).map((item: unknown) =>
      client.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            ...(item as PricingSnapshotItem),
            ttl: Math.floor(Date.now() / 1000), // Expire immediately
          },
        }),
      ),
    );

    await Promise.all(deletePromises);

    logger.info('Pricing snapshots deleted', {
      operation: 'deletePricingSnapshots',
      userId,
      cardId,
      count: deletePromises.length,
      requestId,
    });
  } catch (error) {
    logger.error(
      'Failed to delete pricing snapshots',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'deletePricingSnapshots',
        userId,
        cardId,
        requestId,
      },
    );
    // Don't throw - cache deletion is not critical
  }
}
