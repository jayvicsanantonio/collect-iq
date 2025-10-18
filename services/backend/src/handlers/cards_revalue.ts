/**
 * Cards Revalue Handler
 * POST /cards/{id}/revalue - Trigger Step Functions workflow for card revaluation
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { SFNClient, StartExecutionCommand, ListExecutionsCommand } from '@aws-sdk/client-sfn';
import { v4 as uuidv4 } from 'uuid';
import { RevalueRequestSchema } from '@collectiq/shared';
import { getUserId, type APIGatewayProxyEventV2WithJWT } from '../auth/jwt-claims.js';
import { getCard } from '../store/card-service.js';
import { formatErrorResponse, BadRequestError, UnauthorizedError } from '../utils/errors.js';
import { logger, metrics, tracing, withIdempotency, getJsonHeaders } from '../utils/index.js';

/**
 * Step Functions client singleton
 */
let sfnClient: SFNClient | null = null;

const RevalueOptionsSchema = RevalueRequestSchema.omit({ cardId: true });

/**
 * Get or create Step Functions client
 */
function getSFNClient(): SFNClient {
  if (!sfnClient) {
    const client = new SFNClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    sfnClient = tracing.captureAWSv3Client(client);
  }
  return sfnClient;
}

/**
 * Get Step Functions state machine ARN from environment
 */
function getStateMachineArn(): string {
  const arn = process.env.STEP_FUNCTIONS_ARN;
  if (!arn) {
    throw new Error('STEP_FUNCTIONS_ARN environment variable is not set');
  }
  return arn;
}

/**
 * Check for in-flight executions for a specific card
 * Returns true if there's already a running execution for this card
 */
async function hasInFlightExecution(
  cardId: string,
  userId: string,
  requestId?: string,
): Promise<string | null> {
  const client = getSFNClient();
  const stateMachineArn = getStateMachineArn();

  try {
    logger.debug('Checking for in-flight executions', {
      operation: 'hasInFlightExecution',
      cardId,
      userId,
      requestId,
    });

    // List running executions for this state machine, paging through results if necessary
    let nextToken: string | undefined;

    do {
      const result = await tracing.trace(
        'sfn_list_executions',
        () =>
          client.send(
            new ListExecutionsCommand({
              stateMachineArn,
              statusFilter: 'RUNNING',
              maxResults: 100,
              nextToken,
            }),
          ),
        { cardId, userId, requestId },
      );

      // Check if any running execution is for this card
      // Execution names follow pattern: {cardId}-{requestId}
      const inFlightExecution = result.executions?.find((execution) =>
        execution.name?.startsWith(`${cardId}-`),
      );

      if (inFlightExecution) {
        logger.info('Found in-flight execution for card', {
          operation: 'hasInFlightExecution',
          cardId,
          userId,
          executionArn: inFlightExecution.executionArn,
          requestId,
        });
        return inFlightExecution.executionArn || null;
      }

      nextToken = result.nextToken;
    } while (nextToken);

    return null;
  } catch (error) {
    logger.warn('Failed to check in-flight executions, proceeding with new execution', {
      operation: 'hasInFlightExecution',
      cardId,
      userId,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    // If we can't check, proceed with starting a new execution
    return null;
  }
}

/**
 * Lambda handler for triggering card revaluation
 *
 * @param event - API Gateway event with JWT claims
 * @returns 202 Accepted with execution ARN or error response
 */
async function cardsRevalueHandler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const requestId = event.requestContext.requestId;
  const startTime = Date.now();

  tracing.startSubsegment('cards_revalue_handler', { requestId });

  try {
    // Extract user ID from JWT claims
    const userId = getUserId(event as APIGatewayProxyEventV2WithJWT);

    tracing.addAnnotation('userId', userId);
    tracing.addAnnotation('operation', 'cards_revalue');

    // Extract cardId from path parameters
    const cardId = event.pathParameters?.id;

    if (!cardId) {
      throw new BadRequestError('Card ID is required in path', requestId);
    }

    tracing.addAnnotation('cardId', cardId);

    // Parse optional request body to determine forceRefresh preference
    let forceRefresh = false;
    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        const parsed = RevalueOptionsSchema.parse(body || {});
        forceRefresh = parsed.forceRefresh ?? false;
      } catch (parseError) {
        throw new BadRequestError('Invalid request body', requestId, {
          cause: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }
    }

    logger.info('Processing revalue request', {
      operation: 'cards_revalue',
      userId,
      cardId,
      requestId,
      forceRefresh,
    });

    // Retrieve card from DynamoDB to get s3Keys and verify ownership
    const card = await tracing.trace(
      'dynamodb_get_card',
      () => getCard(userId, cardId, requestId),
      { userId, requestId, cardId },
    );

    // Verify card has required S3 keys
    if (!card.frontS3Key) {
      throw new BadRequestError('Card does not have front image uploaded', requestId);
    }

    // Check for in-flight executions (idempotency)
    const existingExecutionArn = await hasInFlightExecution(cardId, userId, requestId);
    if (existingExecutionArn) {
      logger.info('Returning existing in-flight execution', {
        operation: 'cards_revalue',
        userId,
        cardId,
        executionArn: existingExecutionArn,
        requestId,
      });

      const latency = Date.now() - startTime;
      await metrics.recordApiLatency('/cards/{id}/revalue', 'POST', latency);

      tracing.endSubsegment('cards_revalue_handler', {
        success: true,
        cardId,
        executionArn: existingExecutionArn,
        reusedExecution: true,
      });

      return {
        statusCode: 202,
        headers: getJsonHeaders(),
        body: JSON.stringify({
          executionArn: existingExecutionArn,
          status: 'RUNNING',
          message: 'Revaluation already in progress for this card',
        }),
      };
    }

    // Prepare Step Functions input
    const executionInput = {
      userId,
      cardId,
      s3Keys: {
        front: card.frontS3Key,
        ...(card.backS3Key && { back: card.backS3Key }),
      },
      cardMeta: {
        name: card.name,
        set: card.set,
        number: card.number,
        rarity: card.rarity,
        conditionEstimate: card.conditionEstimate,
        frontS3Key: card.frontS3Key,
        ...(card.backS3Key && { backS3Key: card.backS3Key }),
      },
      requestId,
      forceRefresh,
    };

    // Generate unique execution name: {cardId}-{uuid}
    const executionName = `${cardId}-${uuidv4()}`;

    // Start Step Functions execution
    const client = getSFNClient();
    const stateMachineArn = getStateMachineArn();

    logger.info('Starting Step Functions execution', {
      operation: 'cards_revalue',
      userId,
      cardId,
      executionName,
      stateMachineArn,
      requestId,
    });

    const result = await tracing.trace(
      'sfn_start_execution',
      () =>
        client.send(
          new StartExecutionCommand({
            stateMachineArn,
            name: executionName,
            input: JSON.stringify(executionInput),
          }),
        ),
      { userId, cardId, requestId, executionName },
    );

    logger.info('Step Functions execution started successfully', {
      operation: 'cards_revalue',
      userId,
      cardId,
      executionArn: result.executionArn,
      requestId,
    });

    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/cards/{id}/revalue', 'POST', latency);

    tracing.endSubsegment('cards_revalue_handler', {
      success: true,
      cardId,
      executionArn: result.executionArn,
    });

    // Return 202 Accepted with execution ARN
    return {
      statusCode: 202,
      headers: getJsonHeaders(),
      body: JSON.stringify({
        executionArn: result.executionArn,
        status: 'RUNNING',
        message: 'Card revaluation started successfully',
      }),
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await metrics.recordAuthFailure(error.detail);
    }

    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/cards/{id}/revalue', 'POST', latency);

    tracing.endSubsegment('cards_revalue_handler', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    logger.error(
      'Failed to start revaluation',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'cards_revalue',
        requestId,
      },
    );

    return formatErrorResponse(error, requestId);
  }
}

export const handler = withIdempotency(cardsRevalueHandler, {
  operation: 'cards_revalue',
  required: true,
});

export { cardsRevalueHandler };
