/**
 * E2E Test Helper Utilities
 *
 * Provides common utilities for E2E tests including:
 * - API request helpers
 * - DynamoDB cleanup utilities
 * - S3 cleanup utilities
 * - Test data generators
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { CognitoTokens } from './cognito-auth.js';

/**
 * DynamoDB client for test operations
 */
const ddbClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
  }),
);

/**
 * S3 client for test operations
 */
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * Make an authenticated API request
 *
 * @param path - API path (e.g., '/cards')
 * @param options - Fetch options
 * @param tokens - Cognito tokens for authentication
 * @returns Response
 */
export async function apiRequest(
  path: string,
  options: RequestInit,
  tokens: CognitoTokens,
): Promise<Response> {
  const baseUrl = process.env.API_GATEWAY_URL;

  if (!baseUrl) {
    throw new Error('API_GATEWAY_URL must be set');
  }

  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.idToken}`,
      ...options.headers,
    },
  });

  return response;
}

/**
 * Clean up all test data for a user from DynamoDB
 *
 * @param userId - User ID (Cognito sub)
 */
export async function cleanupUserData(userId: string): Promise<void> {
  const tableName = process.env.DDB_TABLE;

  if (!tableName) {
    throw new Error('DDB_TABLE must be set');
  }

  try {
    // Query all items for the user
    const queryCommand = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
      },
    });

    const result = await ddbClient.send(queryCommand);

    if (!result.Items || result.Items.length === 0) {
      return;
    }

    // Delete all items
    const deletePromises = result.Items.map((item) =>
      ddbClient.send(
        new DeleteCommand({
          TableName: tableName,
          Key: {
            PK: item.PK,
            SK: item.SK,
          },
        }),
      ),
    );

    await Promise.all(deletePromises);
    console.log(`Cleaned up ${result.Items.length} items for user ${userId}`);
  } catch (error) {
    console.error('Failed to cleanup user data:', error);
    throw error;
  }
}

/**
 * Clean up test uploads from S3
 *
 * @param userId - User ID (Cognito sub)
 */
export async function cleanupUserUploads(userId: string): Promise<void> {
  const bucketName = process.env.BUCKET_UPLOADS;

  if (!bucketName) {
    throw new Error('BUCKET_UPLOADS must be set');
  }

  try {
    // List all objects for the user
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: `uploads/${userId}/`,
    });

    const result = await s3Client.send(listCommand);

    if (!result.Contents || result.Contents.length === 0) {
      return;
    }

    // Delete all objects
    const deletePromises = result.Contents.map((object) =>
      s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: object.Key!,
        }),
      ),
    );

    await Promise.all(deletePromises);
    console.log(`Cleaned up ${result.Contents.length} uploads for user ${userId}`);
  } catch (error) {
    console.error('Failed to cleanup user uploads:', error);
    throw error;
  }
}

/**
 * Wait for a condition to be true with timeout
 *
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait in milliseconds
 * @param interval - Check interval in milliseconds
 * @returns True if condition met, false if timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 30000,
  interval: number = 1000,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return false;
}

/**
 * Generate a random test email
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@example.com`;
}

/**
 * Generate test card data
 */
export function generateTestCardData() {
  return {
    name: 'Pikachu',
    set: 'Base Set',
    number: '25',
    rarity: 'Common',
    conditionEstimate: 'Near Mint',
  };
}

/**
 * Create a test image buffer (1x1 pixel JPEG)
 */
export function createTestImageBuffer(): Buffer {
  // Minimal valid JPEG (1x1 pixel, black)
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xc4, 0x00, 0x14,
    0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x37, 0xff, 0xd9,
  ]);
}
