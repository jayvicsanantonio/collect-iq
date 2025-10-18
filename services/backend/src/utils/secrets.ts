/**
 * AWS Secrets Manager utility with in-memory caching
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from './logger.js';
import { tracing } from './tracing.js';

const client = tracing.captureAWSv3Client(
  new SecretsManagerClient({
    region: process.env.AWS_REGION || 'us-east-1',
  }),
);

// In-memory cache for Lambda execution lifetime
const secretCache = new Map<string, { value: string; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

/**
 * Get secret from AWS Secrets Manager with caching
 */
export async function getSecret(secretName: string): Promise<string> {
  // Check cache first
  const cached = secretCache.get(secretName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });

    const response = await tracing.trace('secretsmanager_get_secret', () => client.send(command), {
      secretName,
    });

    if (!response.SecretString) {
      throw new Error(`Secret ${secretName} has no string value`);
    }

    const secretValue = response.SecretString;

    // Cache the secret
    secretCache.set(secretName, {
      value: secretValue,
      timestamp: Date.now(),
    });

    logger.info(`Retrieved secret ${secretName} from Secrets Manager`);
    return secretValue;
  } catch (error) {
    logger.error(`Failed to retrieve secret ${secretName}`, error as Error);
    throw new Error(`Failed to retrieve secret ${secretName}: ${(error as Error).message}`);
  }
}

/**
 * Get JSON secret from AWS Secrets Manager
 */
export async function getSecretJson<T = Record<string, string>>(secretName: string): Promise<T> {
  const secretString = await getSecret(secretName);

  try {
    return JSON.parse(secretString) as T;
  } catch (error) {
    logger.error(`Failed to parse secret ${secretName} as JSON`, error as Error);
    throw new Error(`Secret ${secretName} is not valid JSON`);
  }
}

/**
 * Clear secret cache (useful for testing or rotation)
 */
export function clearSecretCache(): void {
  secretCache.clear();
  logger.info('Secret cache cleared');
}
