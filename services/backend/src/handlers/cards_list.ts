/**
 * Cards List Handler
 * GET /cards - List user's cards with pagination
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getUserId, type APIGatewayProxyEventV2WithJWT } from '../auth/jwt-claims.js';
import { listCards } from '../store/card-service.js';
import { formatErrorResponse, BadRequestError, UnauthorizedError } from '../utils/errors.js';
import { logger, metrics, tracing, getJsonHeaders } from '../utils/index.js';

/**
 * Lambda handler for listing user's cards
 *
 * @param event - API Gateway event with JWT claims
 * @returns 200 OK with items array and optional nextCursor
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const requestId = event.requestContext.requestId;
  const startTime = Date.now();

  tracing.startSubsegment('cards_list_handler', { requestId });

  try {
    // Extract user ID from JWT claims
    const userId = getUserId(event as APIGatewayProxyEventV2WithJWT);

    tracing.addAnnotation('userId', userId);
    tracing.addAnnotation('operation', 'cards_list');

    logger.info('Processing cards list request', {
      operation: 'cards_list',
      userId,
      requestId,
    });

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : undefined;
    const cursor = queryParams.cursor;

    // Validate limit if provided
    if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
      throw new BadRequestError('Limit must be between 1 and 100', requestId);
    }

    // List cards with pagination
    const result = await tracing.trace(
      'dynamodb_list_cards',
      () =>
        listCards(
          userId,
          {
            limit,
            cursor,
          },
          requestId,
        ),
      { userId, requestId },
    );

    logger.info('Cards listed successfully', {
      operation: 'cards_list',
      userId,
      count: result.items.length,
      hasMore: !!result.nextCursor,
      requestId,
    });

    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/cards', 'GET', latency);

    tracing.endSubsegment('cards_list_handler', {
      success: true,
      count: result.items.length,
    });

    // Return 200 OK with items and nextCursor
    return {
      statusCode: 200,
      headers: getJsonHeaders(),
      body: JSON.stringify(result),
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await metrics.recordAuthFailure(error.detail);
    }

    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/cards', 'GET', latency);

    tracing.endSubsegment('cards_list_handler', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    logger.error(
      'Failed to list cards',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'cards_list',
        requestId,
      },
    );

    return formatErrorResponse(error, requestId);
  }
}
