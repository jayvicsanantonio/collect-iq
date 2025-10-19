/**
 * Card Service
 * Implements CRUD operations for card entities in DynamoDB
 */

import {
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardSchema } from '@collectiq/shared';
import {
  getDynamoDBClient,
  getTableName,
  generateUserPK,
  generateCardSK,
} from './dynamodb-client.js';
import {
  NotFoundError,
  ConflictError,
  InternalServerError,
  ForbiddenError,
} from '../utils/errors.js';
import { enforceCardOwnership } from '../auth/ownership.js';
import { logger } from '../utils/logger.js';

/**
 * DynamoDB item structure for cards
 */
interface CardItem {
  PK: string;
  SK: string;
  entityType: 'CARD';
  cardId: string;
  userId: string;
  name?: string;
  set?: string;
  number?: string;
  rarity?: string;
  conditionEstimate?: string;
  frontS3Key: string;
  backS3Key?: string;
  idConfidence?: number;
  authenticityScore?: number;
  authenticitySignals?: Record<string, number>;
  valueLow?: number;
  valueMedian?: number;
  valueHigh?: number;
  compsCount?: number;
  sources?: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  GSI1PK?: string;
  GSI1SK?: string;
}

/**
 * Pagination options
 */
interface PaginationOptions {
  limit?: number;
  cursor?: string;
}

/**
 * List cards response
 */
interface ListCardsResult {
  items: Card[];
  nextCursor?: string;
}

/**
 * Fetch a card item by its cardId using the configured lookup strategy
 *
 * Prefers a GSI (default name CardIdIndex) but falls back to a scan when the
 * index is unavailable. The scan path is primarily for local development and
 * should not be relied on at production scale.
 */
async function fetchCardItemById(cardId: string, requestId?: string): Promise<CardItem | null> {
  const client = getDynamoDBClient();
  const tableName = getTableName();
  const indexName = process.env.CARD_ID_INDEX_NAME || 'CardIdIndex';

  logger.debug('Fetching card by ID', {
    operation: 'fetchCardItemById',
    cardId,
    indexName,
    requestId,
  });

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: indexName,
        KeyConditionExpression: 'cardId = :cardId',
        ExpressionAttributeValues: {
          ':cardId': cardId,
        },
        Limit: 1,
      }),
    );

    const item = result.Items?.[0] as CardItem | undefined;
    if (item && item.entityType === 'CARD') {
      return item;
    }
  } catch (error) {
    if (isValidationException(error)) {
      logger.warn('CardIdIndex not available; falling back to scan lookup', {
        operation: 'fetchCardItemById',
        cardId,
        indexName,
        requestId,
        validationError:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { message: String(error) },
      });
    } else {
      throw error;
    }
  }

  const fallback = await client.send(
    new ScanCommand({
      TableName: tableName,
      FilterExpression: '#entityType = :entityType AND cardId = :cardId',
      ExpressionAttributeNames: {
        '#entityType': 'entityType',
      },
      ExpressionAttributeValues: {
        ':entityType': 'CARD',
        ':cardId': cardId,
      },
      Limit: 1,
    }),
  );

  const fallbackItem = fallback.Items?.[0] as CardItem | undefined;
  return fallbackItem ?? null;
}

function isValidationException(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: string }).name === 'ValidationException'
  );
}

/**
 * Convert DynamoDB item to Card domain object
 */
function itemToCard(item: CardItem): Card {
  const card: Card = {
    cardId: item.cardId,
    userId: item.userId,
    frontS3Key: item.frontS3Key,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };

  // Add optional fields if present
  if (item.name) card.name = item.name;
  if (item.set) card.set = item.set;
  if (item.number) card.number = item.number;
  if (item.rarity) card.rarity = item.rarity;
  if (item.conditionEstimate) card.conditionEstimate = item.conditionEstimate;
  if (item.backS3Key) card.backS3Key = item.backS3Key;
  if (item.idConfidence !== undefined) card.idConfidence = item.idConfidence;
  if (item.authenticityScore !== undefined) card.authenticityScore = item.authenticityScore;
  if (item.authenticitySignals)
    card.authenticitySignals = item.authenticitySignals as Record<string, number>;
  if (item.valueLow !== undefined) card.valueLow = item.valueLow;
  if (item.valueMedian !== undefined) card.valueMedian = item.valueMedian;
  if (item.valueHigh !== undefined) card.valueHigh = item.valueHigh;
  if (item.compsCount !== undefined) card.compsCount = item.compsCount;
  if (item.sources) card.sources = item.sources;

  return CardSchema.parse(card);
}

/**
 * Convert Card domain object to DynamoDB item
 */
function cardToItem(card: Partial<Card>, userId: string, cardId: string): CardItem {
  const now = new Date().toISOString();

  const item: CardItem = {
    PK: generateUserPK(userId),
    SK: generateCardSK(cardId),
    entityType: 'CARD',
    cardId,
    userId,
    frontS3Key: card.frontS3Key!,
    createdAt: card.createdAt || now,
    updatedAt: now,
    // GSI1 for listing cards by user
    GSI1PK: userId,
    GSI1SK: card.createdAt || now,
  };

  // Add optional fields
  if (card.name) item.name = card.name;
  if (card.set) item.set = card.set;
  if (card.number) item.number = card.number;
  if (card.rarity) item.rarity = card.rarity;
  if (card.conditionEstimate) item.conditionEstimate = card.conditionEstimate;
  if (card.backS3Key) item.backS3Key = card.backS3Key;
  if (card.idConfidence !== undefined) item.idConfidence = card.idConfidence;
  if (card.authenticityScore !== undefined) item.authenticityScore = card.authenticityScore;
  if (card.authenticitySignals)
    item.authenticitySignals = card.authenticitySignals as Record<string, number>;
  if (card.valueLow !== undefined) item.valueLow = card.valueLow;
  if (card.valueMedian !== undefined) item.valueMedian = card.valueMedian;
  if (card.valueHigh !== undefined) item.valueHigh = card.valueHigh;
  if (card.compsCount !== undefined) item.compsCount = card.compsCount;
  if (card.sources) item.sources = card.sources;

  return item;
}

/**
 * Create a new card record
 * Uses conditional write to ensure idempotency
 *
 * @param userId - Cognito user ID
 * @param data - Card data
 * @param requestId - Request ID for logging
 * @returns Created card
 * @throws ConflictError if card already exists
 */
export async function createCard(
  userId: string,
  data: Partial<Card>,
  requestId?: string,
): Promise<Card> {
  const cardId = uuidv4();
  const item = cardToItem(data, userId, cardId);

  logger.info('Creating card', {
    operation: 'createCard',
    userId,
    cardId,
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

    return itemToCard(item);
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      err.name === 'ConditionalCheckFailedException'
    ) {
      throw new ConflictError(`Card ${cardId} already exists`, requestId || '', { userId, cardId });
    }
    logger.error('Failed to create card', err instanceof Error ? err : new Error(String(err)), {
      operation: 'createCard',
      userId,
      cardId,
      requestId,
    });
    throw new InternalServerError('Failed to create card', requestId || '');
  }
}

/**
 * List cards for a user with pagination
 * Uses GSI1 (userId#createdAt) for efficient chronological listing
 *
 * @param userId - Cognito user ID
 * @param options - Pagination options
 * @param requestId - Request ID for logging
 * @returns List of cards with optional next cursor
 */
export async function listCards(
  userId: string,
  options: PaginationOptions = {},
  requestId?: string,
): Promise<ListCardsResult> {
  const limit = options.limit || 20;

  logger.info('Listing cards', {
    operation: 'listCards',
    userId,
    limit,
    requestId,
  });

  try {
    const client = getDynamoDBClient();
    const tableName = getTableName();

    const params: {
      TableName: string;
      IndexName: string;
      KeyConditionExpression: string;
      ExpressionAttributeValues: Record<string, string>;
      Limit: number;
      ScanIndexForward: boolean;
      ExclusiveStartKey?: Record<string, unknown>;
    } = {
      TableName: tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      Limit: limit,
      ScanIndexForward: false, // Sort descending (newest first)
    };

    // Add cursor for pagination
    if (options.cursor) {
      try {
        params.ExclusiveStartKey = JSON.parse(Buffer.from(options.cursor, 'base64').toString());
      } catch {
        logger.warn('Invalid cursor provided', {
          operation: 'listCards',
          userId,
          requestId,
        });
      }
    }

    const result = await client.send(new QueryCommand(params));

    const items = (result.Items || []) as CardItem[];
    const cards = items
      .filter((item) => item.entityType === 'CARD' && !item.deletedAt)
      .map(itemToCard);

    const response: ListCardsResult = {
      items: cards,
    };

    // Generate next cursor if there are more results
    if (result.LastEvaluatedKey) {
      response.nextCursor = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    return response;
  } catch (error) {
    logger.error(
      'Failed to list cards',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'listCards',
        userId,
        requestId,
      },
    );
    throw new InternalServerError('Failed to list cards', requestId || '');
  }
}

/**
 * Get a specific card by ID with ownership verification
 *
 * @param userId - Cognito user ID
 * @param cardId - Card UUID
 * @param requestId - Request ID for logging
 * @returns Card object
 * @throws NotFoundError if card doesn't exist
 * @throws ForbiddenError if user doesn't own the card
 */
export async function getCard(userId: string, cardId: string, requestId?: string): Promise<Card> {
  logger.info('Getting card', {
    operation: 'getCard',
    userId,
    cardId,
    requestId,
  });

  try {
    const item = await fetchCardItemById(cardId, requestId);

    if (!item) {
      throw new NotFoundError(`Card ${cardId} not found`, requestId || '');
    }

    // Check if card is soft-deleted
    if (item.deletedAt) {
      throw new NotFoundError(`Card ${cardId} not found`, requestId || '');
    }

    // Verify ownership
    enforceCardOwnership(userId, item.userId, cardId, requestId);

    return itemToCard(item);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      throw error;
    }
    logger.error('Failed to get card', error instanceof Error ? error : new Error(String(error)), {
      operation: 'getCard',
      userId,
      cardId,
      requestId,
    });
    throw new InternalServerError('Failed to get card', requestId || '');
  }
}

/**
 * Update a card with conditional expressions to prevent race conditions
 *
 * @param userId - Cognito user ID
 * @param cardId - Card UUID
 * @param data - Partial card data to update
 * @param requestId - Request ID for logging
 * @returns Updated card
 * @throws NotFoundError if card doesn't exist
 * @throws ForbiddenError if user doesn't own the card
 */
export async function updateCard(
  userId: string,
  cardId: string,
  data: Partial<Card>,
  requestId?: string,
): Promise<Card> {
  logger.info('Updating card', {
    operation: 'updateCard',
    userId,
    cardId,
    requestId,
  });

  // First verify ownership
  await getCard(userId, cardId, requestId);

  try {
    const client = getDynamoDBClient();
    const tableName = getTableName();

    // Build update expression dynamically
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};

    // Always update updatedAt
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    // Add fields to update
    const updateableFields = [
      'name',
      'set',
      'number',
      'rarity',
      'conditionEstimate',
      'backS3Key',
      'idConfidence',
      'authenticityScore',
      'authenticitySignals',
      'valueLow',
      'valueMedian',
      'valueHigh',
      'compsCount',
      'sources',
    ];

    for (const field of updateableFields) {
      if (data[field as keyof Card] !== undefined) {
        updateExpressions.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = data[field as keyof Card];
      }
    }

    const result = await client.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: generateUserPK(userId),
          SK: generateCardSK(cardId),
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        // Conditional: only update if item exists and not deleted
        ConditionExpression: 'attribute_exists(PK) AND attribute_not_exists(deletedAt)',
        ReturnValues: 'ALL_NEW',
      }),
    );

    return itemToCard(result.Attributes as CardItem);
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'ConditionalCheckFailedException'
    ) {
      throw new NotFoundError(`Card ${cardId} not found`, requestId || '');
    }
    logger.error(
      'Failed to update card',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'updateCard',
        userId,
        cardId,
        requestId,
      },
    );
    throw new InternalServerError('Failed to update card', requestId || '');
  }
}

/**
 * Delete a card (soft or hard delete based on configuration)
 *
 * @param userId - Cognito user ID
 * @param cardId - Card UUID
 * @param requestId - Request ID for logging
 * @param hardDelete - If true, permanently delete; if false, soft delete (default: false)
 * @throws NotFoundError if card doesn't exist
 * @throws ForbiddenError if user doesn't own the card
 */
export async function deleteCard(
  userId: string,
  cardId: string,
  requestId?: string,
  hardDelete: boolean = false,
): Promise<void> {
  logger.info('Deleting card', {
    operation: 'deleteCard',
    userId,
    cardId,
    hardDelete,
    requestId,
  });

  // First verify ownership
  await getCard(userId, cardId, requestId);

  try {
    const client = getDynamoDBClient();
    const tableName = getTableName();

    if (hardDelete) {
      // Permanently delete the item
      await client.send(
        new DeleteCommand({
          TableName: tableName,
          Key: {
            PK: generateUserPK(userId),
            SK: generateCardSK(cardId),
          },
          ConditionExpression: 'attribute_exists(PK)',
        }),
      );
    } else {
      // Soft delete: set deletedAt timestamp
      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: {
            PK: generateUserPK(userId),
            SK: generateCardSK(cardId),
          },
          UpdateExpression: 'SET deletedAt = :deletedAt, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':deletedAt': new Date().toISOString(),
            ':updatedAt': new Date().toISOString(),
          },
          ConditionExpression: 'attribute_exists(PK) AND attribute_not_exists(deletedAt)',
        }),
      );
    }

    logger.info('Card deleted successfully', {
      operation: 'deleteCard',
      userId,
      cardId,
      hardDelete,
      requestId,
    });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'ConditionalCheckFailedException'
    ) {
      throw new NotFoundError(`Card ${cardId} not found`, requestId || '');
    }
    logger.error(
      'Failed to delete card',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'deleteCard',
        userId,
        cardId,
        requestId,
      },
    );
    throw new InternalServerError('Failed to delete card', requestId || '');
  }
}
