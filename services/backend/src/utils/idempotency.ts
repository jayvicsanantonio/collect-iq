/**
 * Idempotency Token Storage
 * Provides utilities for storing and retrieving idempotency tokens in DynamoDB
 * to prevent duplicate operations within a TTL window
 */

import { PutCommand, GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import {
  getDynamoDBClient,
  getTableName,
  generateUserPK,
  calculateTTL,
} from '../store/dynamodb-client.js';
import { logger } from './logger.js';
import { ConflictError } from './errors.js';

/**
 * Default TTL for idempotency tokens (10 minutes)
 */
const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 600;

/**
 * Idempotency token item structure in DynamoDB
 */
export type IdempotencyStatus = 'PENDING' | 'COMPLETED';

export interface IdempotencyTokenItem {
  PK: string; // USER#{userId}
  SK: string; // IDEMPOTENCY#{idempotencyKey}
  entityType: 'IDEMPOTENCY';
  idempotencyKey: string;
  userId: string;
  operation: string;
  status: IdempotencyStatus;
  result?: unknown; // Cached operation result
  createdAt: string;
  updatedAt?: string;
  ttl: number; // Unix timestamp for auto-deletion
}

/**
 * Generate sort key for idempotency token
 *
 * @param idempotencyKey - Idempotency key from request
 * @returns Sort key in format IDEMPOTENCY#{key}
 */
function generateIdempotencySK(idempotencyKey: string): string {
  if (!idempotencyKey) {
    throw new Error('idempotencyKey is required for SK generation');
  }
  return `IDEMPOTENCY#${idempotencyKey}`;
}

/**
 * Create a new idempotency token placeholder
 * Uses conditional write to prevent race conditions
 *
 * @param userId - Cognito user ID
 * @param idempotencyKey - Unique idempotency key from request
 * @param operation - Operation identifier (e.g., 'cards_create', 'cards_revalue')
 * @param requestId - Request ID for logging
 * @param ttlSeconds - TTL in seconds (default: 600)
 * @param initialResult - Optional initial result payload
 * @throws ConflictError if token already exists (race condition detected)
 */
export async function createIdempotencyToken(
  userId: string,
  idempotencyKey: string,
  operation: string,
  requestId?: string,
  ttlSeconds?: number,
  initialResult?: unknown,
): Promise<void> {
  const ttl =
    ttlSeconds || Number(process.env.IDEMPOTENCY_TTL_SECONDS) || DEFAULT_IDEMPOTENCY_TTL_SECONDS;
  const now = new Date().toISOString();

  const item: IdempotencyTokenItem = {
    PK: generateUserPK(userId),
    SK: generateIdempotencySK(idempotencyKey),
    entityType: 'IDEMPOTENCY',
    idempotencyKey,
    userId,
    operation,
    status: 'PENDING',
    createdAt: now,
    ttl: calculateTTL(ttl),
    ...(initialResult !== undefined && { result: initialResult }),
  };

  logger.debug('Creating idempotency token', {
    operation: 'createIdempotencyToken',
    userId,
    idempotencyKey,
    operationType: operation,
    ttl,
    requestId,
  });

  try {
    const client = getDynamoDBClient();
    const tableName = getTableName();

    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        // Conditional write: fail if item already exists
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }),
    );

    logger.info('Idempotency token created successfully', {
      operation: 'createIdempotencyToken',
      userId,
      idempotencyKey,
      operationType: operation,
      requestId,
    });
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      err.name === 'ConditionalCheckFailedException'
    ) {
      logger.warn('Idempotency token already exists (duplicate request detected)', {
        operation: 'createIdempotencyToken',
        userId,
        idempotencyKey,
        operationType: operation,
        requestId,
      });
      throw new ConflictError(
        'Duplicate request detected - operation already in progress or completed',
        requestId || '',
        { userId, idempotencyKey, operation },
      );
    }
    logger.error(
      'Failed to create idempotency token',
      err instanceof Error ? err : new Error(String(err)),
      {
        operation: 'createIdempotencyToken',
        userId,
        idempotencyKey,
        operationType: operation,
        requestId,
      },
    );
    throw err;
  }
}

/**
 * Mark an idempotency token as completed and persist result
 *
 * @param userId - Cognito user ID
 * @param idempotencyKey - Unique idempotency key from request
 * @param operation - Operation identifier
 * @param result - Operation result to cache
 * @param requestId - Request ID for logging
 */
export async function completeIdempotencyToken(
  userId: string,
  idempotencyKey: string,
  operation: string,
  result: unknown,
  requestId?: string,
): Promise<void> {
  const now = new Date().toISOString();

  logger.debug('Completing idempotency token', {
    operation: 'completeIdempotencyToken',
    userId,
    idempotencyKey,
    operationType: operation,
    requestId,
  });

  try {
    const client = getDynamoDBClient();
    const tableName = getTableName();

    await client.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: generateUserPK(userId),
          SK: generateIdempotencySK(idempotencyKey),
        },
        UpdateExpression: 'SET #status = :status, #result = :result, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#result': 'result',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':status': 'COMPLETED',
          ':result': result,
          ':updatedAt': now,
        },
        ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
      }),
    );

    logger.info('Idempotency token marked as completed', {
      operation: 'completeIdempotencyToken',
      userId,
      idempotencyKey,
      operationType: operation,
      requestId,
    });
  } catch (err) {
    logger.error(
      'Failed to complete idempotency token',
      err instanceof Error ? err : new Error(String(err)),
      {
        operation: 'completeIdempotencyToken',
        userId,
        idempotencyKey,
        operationType: operation,
        requestId,
      },
    );
    throw err;
  }
}

/**
 * Delete an idempotency token (used when operation fails)
 *
 * @param userId - Cognito user ID
 * @param idempotencyKey - Unique idempotency key from request
 * @param operation - Operation identifier
 * @param requestId - Request ID for logging
 */
export async function deleteIdempotencyToken(
  userId: string,
  idempotencyKey: string,
  operation: string,
  requestId?: string,
): Promise<void> {
  logger.debug('Deleting idempotency token', {
    operation: 'deleteIdempotencyToken',
    userId,
    idempotencyKey,
    operationType: operation,
    requestId,
  });

  try {
    const client = getDynamoDBClient();
    const tableName = getTableName();

    await client.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          PK: generateUserPK(userId),
          SK: generateIdempotencySK(idempotencyKey),
        },
      }),
    );

    logger.info('Idempotency token deleted', {
      operation: 'deleteIdempotencyToken',
      userId,
      idempotencyKey,
      operationType: operation,
      requestId,
    });
  } catch (err) {
    logger.warn('Failed to delete idempotency token', {
      operation: 'deleteIdempotencyToken',
      userId,
      idempotencyKey,
      operationType: operation,
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Swallow delete errors to avoid blocking retries
  }
}

/**
 * Retrieve an idempotency token and its cached result
 *
 * @param userId - Cognito user ID
 * @param idempotencyKey - Unique idempotency key from request
 * @param requestId - Request ID for logging
 * @returns Cached operation result if token exists and not expired, null otherwise
 */
export async function getIdempotencyToken(
  userId: string,
  idempotencyKey: string,
  requestId?: string,
): Promise<IdempotencyTokenItem | null> {
  logger.debug('Retrieving idempotency token', {
    operation: 'getIdempotencyToken',
    userId,
    idempotencyKey,
    requestId,
  });

  try {
    const client = getDynamoDBClient();
    const tableName = getTableName();

    const result = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          PK: generateUserPK(userId),
          SK: generateIdempotencySK(idempotencyKey),
        },
        ConsistentRead: true, // Use consistent read to avoid stale data
      }),
    );

    if (!result.Item) {
      logger.debug('Idempotency token not found', {
        operation: 'getIdempotencyToken',
        userId,
        idempotencyKey,
        requestId,
      });
      return null;
    }

    const item = result.Item as IdempotencyTokenItem;

    // Verify entity type
    if (item.entityType !== 'IDEMPOTENCY') {
      logger.warn('Invalid entity type for idempotency token', {
        operation: 'getIdempotencyToken',
        userId,
        idempotencyKey,
        entityType: item.entityType,
        requestId,
      });
      return null;
    }

    // Check if token has expired (TTL not yet processed by DynamoDB)
    const now = Math.floor(Date.now() / 1000);
    if (item.ttl && item.ttl < now) {
      logger.debug('Idempotency token expired', {
        operation: 'getIdempotencyToken',
        userId,
        idempotencyKey,
        ttl: item.ttl,
        now,
        requestId,
      });
      return null;
    }

    logger.info('Idempotency token found', {
      operation: 'getIdempotencyToken',
      userId,
      idempotencyKey,
      operationType: item.operation,
      createdAt: item.createdAt,
      status: item.status,
      requestId,
    });

    return item;
  } catch (error) {
    logger.error(
      'Failed to retrieve idempotency token',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'getIdempotencyToken',
        userId,
        idempotencyKey,
        requestId,
      },
    );
    // Return null on error to allow operation to proceed
    // This is safer than blocking the request
    return null;
  }
}

/**
 * Extract idempotency key from request headers
 * Supports both standard and custom header names
 *
 * @param headers - Request headers from API Gateway event
 * @returns Idempotency key if present, null otherwise
 */
export function extractIdempotencyKey(
  headers: Record<string, string | undefined> | undefined,
): string | null {
  if (!headers) {
    return null;
  }

  // Check standard Idempotency-Key header (case-insensitive)
  const standardKey =
    headers['idempotency-key'] || headers['Idempotency-Key'] || headers['IDEMPOTENCY-KEY'];

  if (standardKey) {
    return standardKey;
  }

  // Check custom X-Idempotency-Key header (case-insensitive)
  const customKey =
    headers['x-idempotency-key'] || headers['X-Idempotency-Key'] || headers['X-IDEMPOTENCY-KEY'];

  return customKey || null;
}
