/**
 * Cards Get Handler
 * GET /cards/{id} - Get a specific card by ID
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getUserId, type APIGatewayProxyEventV2WithJWT } from '../auth/jwt-claims.js';
import { getCard } from '../store/card-service.js';
import { formatErrorResponse, BadRequestError, UnauthorizedError } from '../utils/errors.js';
import { logger, metrics, tracing, getJsonHeaders } from '../utils/index.js';

/**
 * Lambda handler for getting a specific card
 *
 * @param event - API Gateway event with JWT claims
 * @returns 200 OK with card object or 404 if not found
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const requestId = event.requestContext.requestId;
  const startTime = Date.now();

  tracing.startSubsegment('cards_get_handler', { requestId });

  try {
    // Extract user ID from JWT claims
    const userId = getUserId(event as APIGatewayProxyEventV2WithJWT);

    tracing.addAnnotation('userId', userId);
    tracing.addAnnotation('operation', 'cards_get');

    // Extract cardId from path parameters
    const cardId = event.pathParameters?.id;

    if (!cardId) {
      throw new BadRequestError('Card ID is required in path', requestId);
    }

    logger.info('Processing get card request', {
      operation: 'cards_get',
      userId,
      cardId,
      requestId,
    });

    // Get card from DynamoDB (includes ownership verification)
    const card = await tracing.trace(
      'dynamodb_get_card',
      () => getCard(userId, cardId, requestId),
      { userId, requestId, cardId },
    );

    logger.info('Card retrieved successfully', {
      operation: 'cards_get',
      userId,
      cardId,
      requestId,
    });

    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/cards/{id}', 'GET', latency);

    tracing.endSubsegment('cards_get_handler', {
      success: true,
      cardId,
    });

    // Return 200 OK with card object
    return {
      statusCode: 200,
      headers: getJsonHeaders(),
      body: JSON.stringify(card),
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await metrics.recordAuthFailure(error.detail);
    }

    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/cards/{id}', 'GET', latency);

    tracing.endSubsegment('cards_get_handler', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    logger.error('Failed to get card', error instanceof Error ? error : new Error(String(error)), {
      operation: 'cards_get',
      requestId,
    });

    return formatErrorResponse(error, requestId);
  }
}
