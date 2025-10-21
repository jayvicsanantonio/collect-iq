/**
 * Aggregator Lambda Handler
 * Step Functions task that merges agent results and persists to DynamoDB
 */

import type { Handler } from 'aws-lambda';
import {
  EventBridgeClient,
  PutEventsCommand,
  type PutEventsCommandInput,
} from '@aws-sdk/client-eventbridge';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Card, PricingResult, ValuationSummary, AuthenticityResult } from '@collectiq/shared';
import { logger, metrics, tracing } from '../utils/index.js';
import { updateCard } from '../store/card-service.js';
import { getDynamoDBClient } from '../store/dynamodb-client.js';

const eventBridgeClient = tracing.captureAWSv3Client(
  new EventBridgeClient({
    region: process.env.AWS_REGION || 'us-east-1',
  })
);

/**
 * Upsert card results without fetching first (avoids race condition)
 * Used for new card creation where GSI might not be ready yet
 */
async function upsertCardResults(
  userId: string,
  cardId: string,
  data: Partial<Card>,
  requestId?: string
): Promise<Card> {
  const client = getDynamoDBClient();
  const tableName = process.env.DDB_TABLE || '';

  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  // Always update updatedAt
  updateExpressions.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  // Ensure cardId attribute exists for CardIdIndex GSI
  updateExpressions.push('#cardId = :cardId');
  expressionAttributeNames['#cardId'] = 'cardId';
  expressionAttributeValues[':cardId'] = cardId;

  // Ensure userId attribute exists for GSI1
  updateExpressions.push('#userId = :userId');
  expressionAttributeNames['#userId'] = 'userId';
  expressionAttributeValues[':userId'] = userId;

  // Add fields to update
  const updateableFields = [
    'authenticityScore',
    'authenticitySignals',
    'valueLow',
    'valueMedian',
    'valueHigh',
    'compsCount',
    'sources',
  ];

  for (const field of updateableFields) {
    if (data[field as keyof Card] !== undefined) {
      updateExpressions.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = data[field as keyof Card];
    }
  }

  const result = await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: `CARD#${cardId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  if (!result.Attributes) {
    throw new Error(`Failed to upsert card ${cardId}`);
  }

  return result.Attributes as Card;
}

/**
 * Input structure for Aggregator task
 * Received from Step Functions workflow after parallel agent execution
 */
interface AggregatorInput {
  userId: string;
  cardId: string;
  requestId: string;
  agentResults: [
    {
      pricingResult: PricingResult;
      valuationSummary: ValuationSummary;
      requestId: string;
    },
    {
      authenticityResult: AuthenticityResult;
      requestId: string;
    },
  ];
  skipCardFetch?: boolean; // If true, use upsert instead of fetch+update
}

/**
 * Output structure for Aggregator task
 * Returned to Step Functions workflow
 */
interface AggregatorOutput {
  card: Card;
  requestId: string;
}

/**
 * Aggregator Lambda Handler
 * Merges pricing and authenticity results, persists to DynamoDB, and emits EventBridge event
 *
 * @param event - Input from Step Functions with agent results
 * @returns Updated card object
 */
export const handler: Handler<AggregatorInput, AggregatorOutput> = async (event) => {
  const { userId, cardId, requestId, agentResults, skipCardFetch = false } = event;
  const startTime = Date.now();

  tracing.startSubsegment('aggregator_handler', { userId, cardId, requestId });
  tracing.addAnnotation('userId', userId);
  tracing.addAnnotation('cardId', cardId);
  tracing.addAnnotation('operation', 'aggregator');

  logger.info('Aggregator task invoked', {
    userId,
    cardId,
    skipCardFetch,
    requestId,
  });

  try {
    // Extract results from parallel agent execution
    const [pricingAgentResult, authenticityAgentResult] = agentResults;

    const { pricingResult, valuationSummary } = pricingAgentResult;
    const { authenticityResult } = authenticityAgentResult;

    logger.info('Agent results received', {
      pricingCompsCount: pricingResult.compsCount,
      pricingConfidence: pricingResult.confidence,
      authenticityScore: authenticityResult.authenticityScore,
      fakeDetected: authenticityResult.fakeDetected,
      requestId,
    });

    // Step 1: Merge results into card update
    const cardUpdate: Partial<Card> = {
      // Pricing data
      valueLow: pricingResult.valueLow,
      valueMedian: pricingResult.valueMedian,
      valueHigh: pricingResult.valueHigh,
      compsCount: pricingResult.compsCount,
      sources: pricingResult.sources,

      // Authenticity data
      authenticityScore: authenticityResult.authenticityScore,
      authenticitySignals: {
        visualHashConfidence: authenticityResult.signals.visualHashConfidence,
        textMatchConfidence: authenticityResult.signals.textMatchConfidence,
        holoPatternConfidence: authenticityResult.signals.holoPatternConfidence,
        borderConsistency: authenticityResult.signals.borderConsistency,
        fontValidation: authenticityResult.signals.fontValidation,
      },
    };

    logger.info('Card update prepared', {
      userId,
      cardId,
      updateFields: Object.keys(cardUpdate),
      requestId,
    });

    // Step 2: Persist results to DynamoDB
    logger.info('Updating card in DynamoDB', {
      userId,
      cardId,
      skipCardFetch,
      requestId,
    });

    const updatedCard = await tracing.trace(
      'dynamodb_update_card',
      async () => {
        if (skipCardFetch) {
          // For new cards, use upsert to avoid race condition with GSI
          return await upsertCardResults(userId, cardId, cardUpdate, requestId);
        } else {
          // For existing cards (revalue), use normal update with ownership check
          return await updateCard(userId, cardId, cardUpdate, requestId);
        }
      },
      { userId, cardId, requestId }
    );

    logger.info('Card updated successfully', {
      userId,
      cardId,
      valueLow: updatedCard.valueLow,
      valueMedian: updatedCard.valueMedian,
      valueHigh: updatedCard.valueHigh,
      authenticityScore: updatedCard.authenticityScore,
      requestId,
    });

    // Step 3: Emit EventBridge event for downstream consumers
    await metrics.recordAuthenticityScore(authenticityResult.authenticityScore, cardId);

    await tracing.trace(
      'eventbridge_emit_card_update',
      () =>
        emitCardUpdateEvent(updatedCard, {
          pricingResult,
          valuationSummary,
          authenticityResult,
          requestId,
        }),
      { userId, cardId, requestId }
    );

    logger.info('Aggregator task completed successfully', {
      userId,
      cardId,
      requestId,
    });

    await metrics.recordStepFunctionExecution('success', Date.now() - startTime);

    tracing.endSubsegment('aggregator_handler', {
      success: true,
      cardId,
      userId,
    });

    // Return final card object to Step Functions
    return {
      card: updatedCard,
      requestId,
    };
  } catch (error) {
    await metrics.recordStepFunctionExecution('failure', Date.now() - startTime);

    tracing.endSubsegment('aggregator_handler', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      cardId,
      userId,
    });

    logger.error(
      'Aggregator task failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        userId,
        cardId,
        requestId,
      }
    );

    // Re-throw error to trigger Step Functions retry/error handling
    throw error;
  }
};

/**
 * Emit EventBridge event for card update
 * Allows downstream services to react to card valuation/authenticity updates
 */
async function emitCardUpdateEvent(
  card: Card,
  metadata: {
    pricingResult: PricingResult;
    valuationSummary: ValuationSummary;
    authenticityResult: AuthenticityResult;
    requestId: string;
  }
): Promise<void> {
  const eventBusName = process.env.EVENT_BUS_NAME || 'collectiq-events';

  logger.info('Emitting card update event to EventBridge', {
    eventBusName,
    cardId: card.cardId,
    userId: card.userId,
    requestId: metadata.requestId,
  });

  try {
    const eventDetail = {
      cardId: card.cardId,
      userId: card.userId,
      name: card.name,
      set: card.set,
      valueLow: card.valueLow,
      valueMedian: card.valueMedian,
      valueHigh: card.valueHigh,
      authenticityScore: card.authenticityScore,
      fakeDetected: metadata.authenticityResult.fakeDetected,
      pricingConfidence: metadata.pricingResult.confidence,
      pricingSources: metadata.pricingResult.sources,
      valuationTrend: metadata.valuationSummary.trend,
      valuationFairValue: metadata.valuationSummary.fairValue,
      requestId: metadata.requestId,
      timestamp: new Date().toISOString(),
    };

    const params: PutEventsCommandInput = {
      Entries: [
        {
          Source: 'collectiq.backend',
          DetailType: 'CardValuationCompleted',
          Detail: JSON.stringify(eventDetail),
          EventBusName: eventBusName,
        },
      ],
    };

    const command = new PutEventsCommand(params);
    const response = await eventBridgeClient.send(command);

    if (response.FailedEntryCount && response.FailedEntryCount > 0) {
      logger.error('Failed to emit EventBridge event', new Error('EventBridge put failed'), {
        failedEntryCount: response.FailedEntryCount,
        entries: response.Entries,
        requestId: metadata.requestId,
      });
    } else {
      logger.info('EventBridge event emitted successfully', {
        eventId: response.Entries?.[0]?.EventId,
        requestId: metadata.requestId,
      });
    }
  } catch (error) {
    // Don't fail the entire aggregation if event emission fails
    logger.error(
      'Failed to emit EventBridge event',
      error instanceof Error ? error : new Error(String(error)),
      {
        cardId: card.cardId,
        userId: card.userId,
        requestId: metadata.requestId,
      }
    );
  }
}
