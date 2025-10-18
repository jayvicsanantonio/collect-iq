/**
 * Cards Delete Handler
 * DELETE /cards/{id} - Delete a specific card
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getUserId, type APIGatewayProxyEventV2WithJWT } from '../auth/jwt-claims.js';
import { deleteCard } from '../store/card-service.js';
import { formatErrorResponse, BadRequestError, UnauthorizedError } from '../utils/errors.js';
import { logger, metrics, tracing, getSecurityHeaders } from '../utils/index.js';

/**
 * Lambda handler for deleting a card
 *
 * @param event - API Gateway event with JWT claims
 * @returns 204 No Content on success or 404 if not found
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const requestId = event.requestContext.requestId;
  const startTime = Date.now();

  tracing.startSubsegment('cards_delete_handler', { requestId });

  try {
    // Extract user ID from JWT claims
    const userId = getUserId(event as APIGatewayProxyEventV2WithJWT);

    tracing.addAnnotation('userId', userId);
    tracing.addAnnotation('operation', 'cards_delete');

    // Extract cardId from path parameters
    const cardId = event.pathParameters?.id;

    if (!cardId) {
      throw new BadRequestError('Card ID is required in path', requestId);
    }

    logger.info('Processing delete card request', {
      operation: 'cards_delete',
      userId,
      cardId,
      requestId,
    });

    // Delete card from DynamoDB (includes ownership verification)
    // Uses soft delete by default (can be configured via environment variable)
    const hardDelete = process.env.HARD_DELETE_CARDS === 'true';
    await tracing.trace(
      'dynamodb_delete_card',
      () => deleteCard(userId, cardId, requestId, hardDelete),
      { userId, requestId, cardId },
    );

    logger.info('Card deleted successfully', {
      operation: 'cards_delete',
      userId,
      cardId,
      hardDelete,
      requestId,
    });

    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/cards/{id}', 'DELETE', latency);

    tracing.endSubsegment('cards_delete_handler', {
      success: true,
      cardId,
      hardDelete,
    });

    // Return 204 No Content
    return {
      statusCode: 204,
      headers: getSecurityHeaders('application/json', { 'Content-Length': '0' }),
      body: '',
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await metrics.recordAuthFailure(error.detail);
    }

    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/cards/{id}', 'DELETE', latency);

    tracing.endSubsegment('cards_delete_handler', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    logger.error(
      'Failed to delete card',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'cards_delete',
        requestId,
      },
    );

    return formatErrorResponse(error, requestId);
  }
}
