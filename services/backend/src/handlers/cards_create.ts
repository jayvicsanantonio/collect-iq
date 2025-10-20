/**
 * Cards Create Handler
 * POST /cards - Create a new card record
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { CreateCardRequestSchema, type Card } from '@collectiq/shared';
import { getUserId, type APIGatewayProxyEventV2WithJWT } from '../auth/jwt-claims.js';
import { createCard } from '../store/card-service.js';
import { formatErrorResponse, BadRequestError, UnauthorizedError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';
import { tracing } from '../utils/tracing.js';
import { withIdempotency } from '../utils/idempotency-middleware.js';
import { getJsonHeaders } from '../utils/response-headers.js';

/**
 * EventBridge client singleton
 */
let eventBridgeClient: EventBridgeClient | null = null;

/**
 * Get or create EventBridge client
 */
function getEventBridgeClient(): EventBridgeClient {
  if (!eventBridgeClient) {
    const client = new EventBridgeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    eventBridgeClient = tracing.captureAWSv3Client(client);
  }
  return eventBridgeClient;
}

/**
 * Emit CardCreated event to EventBridge for auto-trigger revaluation
 */
async function emitCardCreatedEvent(card: Card, userId: string, requestId: string): Promise<void> {
  const eventBusName = process.env.EVENT_BUS_NAME || 'collectiq-hackathon-events';

  logger.info('Emitting CardCreated event for auto-trigger', {
    cardId: card.cardId,
    userId,
    eventBusName,
    requestId,
  });

  try {
    const client = getEventBridgeClient();

    const eventDetail = {
      cardId: card.cardId,
      userId: card.userId,
      frontS3Key: card.frontS3Key,
      backS3Key: card.backS3Key,
      s3Bucket: process.env.S3_BUCKET || '',
      name: card.name,
      set: card.set,
      number: card.number,
      rarity: card.rarity,
      conditionEstimate: card.conditionEstimate,
      timestamp: new Date().toISOString(),
    };

    await tracing.trace(
      'eventbridge_emit_card_created',
      () =>
        client.send(
          new PutEventsCommand({
            Entries: [
              {
                Source: 'collectiq.cards',
                DetailType: 'CardCreated',
                Detail: JSON.stringify(eventDetail),
                EventBusName: eventBusName,
              },
            ],
          })
        ),
      { cardId: card.cardId, userId, requestId }
    );

    logger.info('CardCreated event emitted successfully', {
      cardId: card.cardId,
      userId,
      requestId,
    });
  } catch (error) {
    // Don't fail card creation if event emission fails
    logger.error(
      'Failed to emit CardCreated event',
      error instanceof Error ? error : new Error(String(error)),
      { cardId: card.cardId, userId, requestId }
    );
  }
}

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
      { userId, requestId }
    );

    logger.info('Card created successfully', {
      operation: 'cards_create',
      userId,
      cardId: card.cardId,
      requestId,
    });

    // Emit CardCreated event for auto-trigger revaluation (if enabled)
    if (process.env.AUTO_TRIGGER_REVALUE === 'true') {
      await emitCardCreatedEvent(card, userId, requestId);
    }

    // Emit metrics
    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/cards', 'POST', latency);

    // End X-Ray subsegment
    tracing.endSubsegment('cards_create_handler', { success: true, cardId: card.cardId });

    // Return 201 Created with card object
    return {
      statusCode: 201,
      headers: getJsonHeaders({}, event.headers?.origin),
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
      }
    );

    // Emit error metric
    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/cards', 'POST', latency);

    // End X-Ray subsegment with error
    tracing.endSubsegment('cards_create_handler', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return formatErrorResponse(error, requestId, event.headers?.origin);
  }
}

export const handler = withIdempotency(cardsCreateHandler, {
  operation: 'cards_create',
  required: true,
});

export { cardsCreateHandler };
