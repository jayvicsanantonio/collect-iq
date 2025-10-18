/**
 * DynamoDB Client Wrapper
 * Provides configured DynamoDB DocumentClient with connection pooling and retry logic
 */

import https from 'node:https';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { logger } from '../utils/logger.js';
import { tracing } from '../utils/tracing.js';

/**
 * DynamoDB configuration
 */
interface DynamoDBConfig {
  region?: string;
  tableName: string;
  maxRetries?: number;
  requestTimeoutMs?: number;
  connectionTimeoutMs?: number;
  maxSockets?: number;
}

/**
 * Singleton DynamoDB client instance
 */
let documentClient: DynamoDBDocumentClient | null = null;
let currentTableName: string | null = null;
let currentRegion: string | null = null;

/**
 * Initialize and return configured DynamoDB DocumentClient
 * Uses singleton pattern to reuse connections across Lambda invocations
 *
 * @param config - DynamoDB configuration
 * @returns Configured DynamoDB DocumentClient
 */
export function getDynamoDBClient(config?: DynamoDBConfig): DynamoDBDocumentClient {
  const tableName = config?.tableName || process.env.DDB_TABLE || '';
  const region = config?.region || process.env.AWS_REGION || 'us-east-1';
  const requestTimeout =
    config?.requestTimeoutMs ?? Number(process.env.DDB_REQUEST_TIMEOUT_MS || 5000);
  const connectionTimeout =
    config?.connectionTimeoutMs ?? Number(process.env.DDB_CONNECTION_TIMEOUT_MS || 1000);
  const maxSockets = config?.maxSockets ?? Number(process.env.DDB_MAX_SOCKETS || 50);

  // Return existing client if configuration hasn't changed
  if (documentClient && currentTableName === tableName && currentRegion === region) {
    return documentClient;
  }

  logger.info('Initializing DynamoDB client', {
    operation: 'getDynamoDBClient',
    region,
    tableName,
    requestTimeout,
    connectionTimeout,
    maxSockets,
  });

  const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets,
  });

  // Create base DynamoDB client with retry configuration
  const client = new DynamoDBClient({
    region,
    maxAttempts: config?.maxRetries || 3,
    requestHandler: new NodeHttpHandler({
      httpsAgent,
      requestTimeout,
      connectionTimeout,
    }),
  });

  const instrumentedClient = tracing.captureAWSv3Client(client);

  // Create DocumentClient with marshalling options
  documentClient = DynamoDBDocumentClient.from(instrumentedClient, {
    marshallOptions: {
      // Convert empty strings to null
      convertEmptyValues: false,
      // Remove undefined values
      removeUndefinedValues: true,
      // Convert class instances to maps
      convertClassInstanceToMap: false,
    },
    unmarshallOptions: {
      // Return numbers as JavaScript numbers (not BigInt)
      wrapNumbers: false,
    },
  });

  currentTableName = tableName;
  currentRegion = region;

  return documentClient;
}

/**
 * Get the configured table name
 *
 * @returns DynamoDB table name
 * @throws Error if table name is not configured
 */
export function getTableName(): string {
  const tableName = process.env.DDB_TABLE;
  if (!tableName) {
    throw new Error('DDB_TABLE environment variable is not set');
  }
  return tableName;
}

/**
 * Generate partition key for user-scoped data
 *
 * @param userId - Cognito user ID (sub claim)
 * @returns Partition key in format USER#{userId}
 */
export function generateUserPK(userId: string): string {
  if (!userId) {
    throw new Error('userId is required for PK generation');
  }
  return `USER#${userId}`;
}

/**
 * Generate sort key for card entity
 *
 * @param cardId - Card UUID
 * @returns Sort key in format CARD#{cardId}
 */
export function generateCardSK(cardId: string): string {
  if (!cardId) {
    throw new Error('cardId is required for SK generation');
  }
  return `CARD#${cardId}`;
}

/**
 * Generate sort key for pricing snapshot
 *
 * @param timestamp - ISO 8601 timestamp
 * @returns Sort key in format PRICE#{timestamp}
 */
export function generatePriceSK(timestamp: string): string {
  if (!timestamp) {
    throw new Error('timestamp is required for price SK generation');
  }
  return `PRICE#${timestamp}`;
}

/**
 * Generate sort key for feedback entity
 *
 * @param timestamp - ISO 8601 timestamp
 * @returns Sort key in format FEEDBACK#{timestamp}
 */
export function generateFeedbackSK(timestamp: string): string {
  if (!timestamp) {
    throw new Error('timestamp is required for feedback SK generation');
  }
  return `FEEDBACK#${timestamp}`;
}

/**
 * Extract card ID from sort key
 *
 * @param sk - Sort key in format CARD#{cardId}
 * @returns Card ID
 */
export function extractCardId(sk: string): string {
  const match = sk.match(/^CARD#(.+)$/);
  if (!match) {
    throw new Error(`Invalid card sort key format: ${sk}`);
  }
  return match[1];
}

/**
 * Extract user ID from partition key
 *
 * @param pk - Partition key in format USER#{userId}
 * @returns User ID
 */
export function extractUserId(pk: string): string {
  const match = pk.match(/^USER#(.+)$/);
  if (!match) {
    throw new Error(`Invalid user partition key format: ${pk}`);
  }
  return match[1];
}

/**
 * Extract timestamp from price sort key
 *
 * @param sk - Sort key in format PRICE#{timestamp}
 * @returns ISO 8601 timestamp
 */
export function extractPriceTimestamp(sk: string): string {
  const match = sk.match(/^PRICE#(.+)$/);
  if (!match) {
    throw new Error(`Invalid price sort key format: ${sk}`);
  }
  return match[1];
}

/**
 * Calculate TTL timestamp for DynamoDB item
 *
 * @param seconds - Number of seconds from now
 * @returns Unix timestamp (seconds since epoch)
 */
export function calculateTTL(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

/**
 * Check if entity type matches expected type
 *
 * @param entityType - Entity type from DynamoDB item
 * @param expected - Expected entity type
 * @returns true if types match
 */
export function isEntityType(entityType: string, expected: string): boolean {
  return entityType === expected;
}
