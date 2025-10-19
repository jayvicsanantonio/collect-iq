/**
 * Cards Create Handler
 * POST /cards - Create a new card record
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { CreateCardRequestSchema } from '@collectiq/shared';
import { getUserId, type APIGatewayProxyEventV2WithJWT } from '../auth/jwt-claims.js';
import { createCard } from '../store/card-service.js';
import { formatErrorResponse, BadRequestError, UnauthorizedError } from '../utils/errors.js';
import { logger, metrics, tracing, withIdempotency, getJsonHeaders } from '../utils/index.js';

/**
 * Lambda handler for creating a new card
 *
 * @param event - API Gateway event with JWT claims
 * @returns 201 Created with card object or error response
 */
async function cardsCreateHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const requestId = event.requestContext.requestId;
  const startTime = Date.now();

  // Start X-Ray subsegment for business logic
  tracing.startSubsegment('cards_create_handler', { requestId });

  try {
    // Extract user ID from JWT claims
    const userId = getUserId(event as APIGatewayProxyEventV2WithJWT);

    // Add X-Ray annotations for searchability
    tracing.addAnnotation('userId', userId);
    tracing.addAnnotation('operation', 'cards_create');

    logger.info('Processing card creation request', {
      operation: 'cards_create',
      userId,
      requestId,
    });

    // Parse and validate request body
    if (!event.body) {
      throw new BadRequestError('Request body is required', requestId);
    }

    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch {
      throw new BadRequestError('Invalid JSON in request body', requestId);
    }

    // Validate with Zod schema
    const validationResult = CreateCardRequestSchema.safeParse(requestBody);
    if (!validationResult.success) {
      throw new BadRequestError(`Validation failed: ${validationResult.error.message}`, requestId, {
        errors: validationResult.error.errors,
      });
    }

    const cardData = validationResult.data;

    // Create card in DynamoDB with tracing
    const card = await tracing.trace(
      'dynamodb_create_card',
      () => createCard(userId, cardData, requestId),
      { userId, requestId },
    );

    logger.info('Card created successfully', {
      operation: 'cards_create',
      userId,
      cardId: card.cardId,
      requestId,
    });

    // Emit metrics
    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/cards', 'POST', latency);

    // End X-Ray subsegment
    tracing.endSubsegment('cards_create_handler', { success: true, cardId: card.cardId });

    // Return 201 Created with card object
    return {
      statusCode: 201,
      headers: getJsonHeaders(),
      body: JSON.stringify(card),
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await metrics.recordAuthFailure(error.detail);
    }

    logger.error(
      'Failed to create card',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'cards_create',
        requestId,
      },
    );

    // Emit error metric
    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/cards', 'POST', latency);

    // End X-Ray subsegment with error
    tracing.endSubsegment('cards_create_handler', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return formatErrorResponse(error, requestId);
  }
}

export const handler = withIdempotency(cardsCreateHandler, {
  operation: 'cards_create',
  required: true,
});

export { cardsCreateHandler };
