/**
 * Idempotency Middleware
 * Provides middleware for handling idempotent operations in Lambda handlers
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { APIGatewayProxyEventV2WithJWT } from '../auth/jwt-claims.js';
import {
  extractIdempotencyKey,
  getIdempotencyToken,
  createIdempotencyToken,
  completeIdempotencyToken,
  deleteIdempotencyToken,
} from './idempotency.js';
import { logger } from './logger.js';
import { getJsonHeaders, getProblemJsonHeaders, getSecurityHeaders } from './response-headers.js';

/**
 * Handler function type that supports idempotency
 */
export type IdempotentHandler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

/**
 * Options for idempotency middleware
 */
interface IdempotencyOptions {
  /**
   * Operation identifier (e.g., 'cards_create', 'cards_revalue')
   */
  operation: string;

  /**
   * Function to extract user ID from event
   * Defaults to extracting from JWT claims
   */
  getUserId?: (event: APIGatewayProxyEventV2) => string;

  /**
   * TTL for idempotency tokens in seconds
   * Defaults to IDEMPOTENCY_TTL_SECONDS environment variable or 600
   */
  ttlSeconds?: number;

  /**
   * Whether idempotency is required (returns 400 if key missing)
   * Defaults to false (idempotency is optional)
   */
  required?: boolean;
}

/**
 * Default function to extract user ID from JWT claims
 */
function defaultGetUserId(event: APIGatewayProxyEventV2): string {
  const eventWithJWT = event as APIGatewayProxyEventV2WithJWT;
  const claims = eventWithJWT.requestContext?.authorizer?.jwt?.claims;
  if (!claims || !claims.sub) {
    throw new Error('User ID not found in JWT claims');
  }
  return claims.sub as string;
}

/**
 * Wrap a Lambda handler with idempotency support
 *
 * This middleware:
 * 1. Extracts idempotency key from request headers
 * 2. Checks DynamoDB for existing token
 * 3. Returns cached result if a completed token exists
 * 4. Rejects duplicate in-flight requests while the original completes
 * 5. Stores a new token placeholder before executing the handler
 * 6. Updates the token with the final result on success (or cleans up on failure)
 *
 * @param handler - Lambda handler function to wrap
 * @param options - Idempotency configuration options
 * @returns Wrapped handler with idempotency support
 *
 * @example
 * ```typescript
 * export const handler = withIdempotency(
 *   async (event) => {
 *     // Your handler logic here
 *     return { statusCode: 201, body: JSON.stringify(result) };
 *   },
 *   { operation: 'cards_create' }
 * );
 * ```
 */
export function withIdempotency(
  handler: IdempotentHandler,
  options: IdempotencyOptions,
): IdempotentHandler {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const requestId = event.requestContext.requestId;
    const getUserId = options.getUserId || defaultGetUserId;
    let tokenCreated = false;
    let handlerExecuted = false;
    let idempotencyKey: string | null = null;
    let userId: string | null = null;

    try {
      // Extract idempotency key from headers
      idempotencyKey = extractIdempotencyKey(event.headers);

      // If no idempotency key provided
      if (!idempotencyKey) {
        if (options.required) {
          logger.warn('Idempotency key required but not provided', {
            operation: 'withIdempotency',
            operationType: options.operation,
            requestId,
          });
          return {
            statusCode: 400,
            headers: getProblemJsonHeaders(),
            body: JSON.stringify({
              type: '/errors/bad-request',
              title: 'Bad Request',
              status: 400,
              detail: 'Idempotency-Key header is required for this operation',
              instance: event.requestContext.http.path,
              requestId,
            }),
          };
        }

        // Idempotency is optional - proceed without it
        logger.debug('No idempotency key provided (optional)', {
          operation: 'withIdempotency',
          operationType: options.operation,
          requestId,
        });
        return handler(event);
      }

      // Extract user ID
      try {
        userId = getUserId(event);
      } catch (error) {
        logger.error(
          'Failed to extract user ID',
          error instanceof Error ? error : new Error(String(error)),
          {
            operation: 'withIdempotency',
            operationType: options.operation,
            requestId,
          },
        );
        return {
          statusCode: 401,
          headers: getProblemJsonHeaders(),
          body: JSON.stringify({
            type: '/errors/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'User authentication required',
            instance: event.requestContext.http.path,
            requestId,
          }),
        };
      }

      logger.debug('Checking for existing idempotency token', {
        operation: 'withIdempotency',
        operationType: options.operation,
        userId,
        idempotencyKey,
        requestId,
      });

      // Check for existing token
      const existingToken = await getIdempotencyToken(userId, idempotencyKey, requestId);

      if (existingToken) {
        if (existingToken.status === 'COMPLETED') {
          const cachedResult = existingToken.result;
          logger.info('Returning cached result from completed idempotency token', {
            operation: 'withIdempotency',
            operationType: options.operation,
            userId,
            idempotencyKey,
            requestId,
          });

          if (isValidProxyResult(cachedResult)) {
            return cachedResult as APIGatewayProxyResultV2;
          }

          if (cachedResult !== undefined) {
            logger.warn('Cached result is not a valid proxy result, wrapping it', {
              operation: 'withIdempotency',
              operationType: options.operation,
              userId,
              idempotencyKey,
              requestId,
            });
            return {
              statusCode: 200,
              headers: getJsonHeaders(),
              body: JSON.stringify(cachedResult),
            };
          }

          logger.warn('Completed idempotency token missing cached result, returning 204', {
            operation: 'withIdempotency',
            operationType: options.operation,
            userId,
            idempotencyKey,
            requestId,
          });
          return {
            statusCode: 204,
            headers: getSecurityHeaders('application/json', { 'Content-Length': '0' }),
            body: '',
          };
        }

        logger.info('Idempotent request still in progress', {
          operation: 'withIdempotency',
          operationType: options.operation,
          userId,
          idempotencyKey,
          requestId,
        });

        return {
          statusCode: 409,
          headers: getProblemJsonHeaders(),
          body: JSON.stringify({
            type: '/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: 'Duplicate request detected - original request is still processing.',
            instance: event.requestContext.http.path,
            requestId,
          }),
        };
      }

      // No cached result - create placeholder and execute handler
      logger.debug('No cached result found, creating idempotency placeholder', {
        operation: 'withIdempotency',
        operationType: options.operation,
        userId,
        idempotencyKey,
        requestId,
      });

      await createIdempotencyToken(
        userId,
        idempotencyKey,
        options.operation,
        requestId,
        options.ttlSeconds,
      );
      tokenCreated = true;

      logger.debug('Executing handler after creating idempotency token', {
        operation: 'withIdempotency',
        operationType: options.operation,
        userId,
        idempotencyKey,
        requestId,
      });

      const result = await handler(event);
      handlerExecuted = true;

      // Store result with idempotency token (only for successful responses)
      const statusCode =
        typeof result === 'string' ? 200 : (result as { statusCode?: number }).statusCode || 200;

      if (statusCode >= 200 && statusCode < 300) {
        try {
          await completeIdempotencyToken(
            userId,
            idempotencyKey,
            options.operation,
            result,
            requestId,
          );
        } catch (completeError) {
          logger.error(
            'Failed to complete idempotency token (operation succeeded)',
            completeError instanceof Error ? completeError : new Error(String(completeError)),
            {
              operation: 'withIdempotency',
              operationType: options.operation,
              userId,
              idempotencyKey,
              requestId,
            },
          );
        }
      } else if (tokenCreated) {
        await deleteIdempotencyToken(userId, idempotencyKey, options.operation, requestId);
      }

      return result;
    } catch (error) {
      logger.error(
        'Idempotency middleware error',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'withIdempotency',
          operationType: options.operation,
          requestId,
        },
      );

      if (tokenCreated && userId && idempotencyKey) {
        await deleteIdempotencyToken(userId, idempotencyKey, options.operation, requestId);
      }

      if (handlerExecuted) {
        throw error;
      }

      // On middleware error before handler execution, try to execute handler anyway
      return handler(event);
    }
  };
}

/**
 * Type guard to check if value is a valid APIGatewayProxyResultV2
 */
function isValidProxyResult(value: unknown): value is APIGatewayProxyResultV2 {
  if (typeof value === 'string') {
    return true; // Simple string response is valid
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    typeof (value as { statusCode: unknown }).statusCode === 'number'
  );
}

/**
 * Helper function to create an idempotent handler with default options
 * Useful for common patterns like POST operations
 *
 * @param operation - Operation identifier
 * @param handler - Handler function
 * @returns Wrapped handler with idempotency
 *
 * @example
 * ```typescript
 * export const handler = createIdempotentHandler('cards_create', async (event) => {
 *   // Your handler logic
 * });
 * ```
 */
export function createIdempotentHandler(
  operation: string,
  handler: IdempotentHandler,
): IdempotentHandler {
  return withIdempotency(handler, { operation });
}
