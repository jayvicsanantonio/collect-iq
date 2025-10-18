/**
 * Error Handler Lambda
 * Step Functions error handler that persists partial results and logs errors
 */

import type { Handler } from 'aws-lambda';
import { SQSClient, SendMessageCommand, type SendMessageCommandInput } from '@aws-sdk/client-sqs';
import type { Card } from '@collectiq/shared';
import { logger, tracing } from '../utils/index.js';
import { updateCard, getCard } from '../store/card-service.js';

const sqsClient = tracing.captureAWSv3Client(
  new SQSClient({
    region: process.env.AWS_REGION || 'us-east-1',
  }),
);

/**
 * Input structure for Error Handler task
 * Received from Step Functions when a task fails
 */
interface ErrorHandlerInput {
  userId: string;
  cardId: string;
  requestId: string;
  error: {
    Error: string;
    Cause: string;
  };
  // Partial results from agents (if available)
  partialResults?: {
    features?: unknown;
    pricingResult?: unknown;
    authenticityResult?: unknown;
  };
}

/**
 * Output structure for Error Handler task
 * Returned to Step Functions workflow
 */
interface ErrorHandlerOutput {
  handled: boolean;
  partialResultsPersisted: boolean;
  dlqMessageId?: string;
  requestId: string;
}

/**
 * Error Handler Lambda
 * Handles workflow errors by persisting partial results and sending to DLQ
 *
 * @param event - Input from Step Functions with error details
 * @returns Error handling result
 */
export const handler: Handler<ErrorHandlerInput, ErrorHandlerOutput> = async (event) => {
  const { userId, cardId, requestId, error, partialResults } = event;

  tracing.startSubsegment('error_handler', { userId, cardId, requestId });
  tracing.addAnnotation('operation', 'workflow_error_handler');
  tracing.addAnnotation('cardId', cardId);

  logger.error('Error Handler invoked', new Error(error.Error), {
    userId,
    cardId,
    requestId,
    errorType: error.Error,
    errorCause: error.Cause,
  });

  let partialResultsPersisted = false;
  let dlqMessageId: string | undefined;

  try {
    // Step 1: Persist partial results if available
    if (partialResults && Object.keys(partialResults).length > 0) {
      logger.info('Attempting to persist partial results', {
        userId,
        cardId,
        availableResults: Object.keys(partialResults),
        requestId,
      });

      partialResultsPersisted = await persistPartialResults(
        userId,
        cardId,
        partialResults,
        requestId,
      );

      if (partialResultsPersisted) {
        logger.info('Partial results persisted successfully', {
          userId,
          cardId,
          requestId,
        });
      } else {
        logger.warn('Failed to persist partial results', {
          userId,
          cardId,
          requestId,
        });
      }
    } else {
      logger.info('No partial results available to persist', {
        userId,
        cardId,
        requestId,
      });
    }

    // Step 2: Log error details for debugging
    logger.error('Step Functions workflow error details', new Error(error.Error), {
      userId,
      cardId,
      requestId,
      errorType: error.Error,
      errorCause: error.Cause,
      partialResults: partialResults ? Object.keys(partialResults) : [],
    });

    // Step 3: Send message to Dead Letter Queue
    dlqMessageId = await sendToDLQ(event);

    logger.info('Error message sent to DLQ', {
      userId,
      cardId,
      requestId,
      dlqMessageId,
    });

    tracing.endSubsegment('error_handler', {
      success: true,
      partialResultsPersisted,
      dlqMessageId,
      cardId,
      userId,
    });

    // Return success to Step Functions
    return {
      handled: true,
      partialResultsPersisted,
      dlqMessageId,
      requestId,
    };
  } catch (handlerError) {
    // If error handler itself fails, log and return failure
    logger.error(
      'Error Handler failed',
      handlerError instanceof Error ? handlerError : new Error(String(handlerError)),
      {
        userId,
        cardId,
        requestId,
        originalError: error.Error,
      },
    );

    tracing.endSubsegment('error_handler', {
      success: false,
      error: handlerError instanceof Error ? handlerError.message : String(handlerError),
      partialResultsPersisted,
      dlqMessageId,
      cardId,
      userId,
    });

    return {
      handled: false,
      partialResultsPersisted,
      dlqMessageId,
      requestId,
    };
  }
};

/**
 * Persist partial results to DynamoDB
 * Attempts to save any available data from failed workflow
 */
async function persistPartialResults(
  userId: string,
  cardId: string,
  partialResults: {
    features?: unknown;
    pricingResult?: unknown;
    authenticityResult?: unknown;
  },
  requestId: string,
): Promise<boolean> {
  try {
    // Verify card exists and user owns it
    await tracing.trace('dynamodb_get_card', () => getCard(userId, cardId, requestId), {
      userId,
      cardId,
      requestId,
    });

    // Build update object from partial results
    const cardUpdate: Partial<Card> = {};

    // Extract pricing data if available
    if (partialResults.pricingResult && typeof partialResults.pricingResult === 'object') {
      const pricing = partialResults.pricingResult as {
        valueLow?: number;
        valueMedian?: number;
        valueHigh?: number;
        compsCount?: number;
        sources?: string[];
      };

      if (pricing.valueLow !== undefined) cardUpdate.valueLow = pricing.valueLow;
      if (pricing.valueMedian !== undefined) cardUpdate.valueMedian = pricing.valueMedian;
      if (pricing.valueHigh !== undefined) cardUpdate.valueHigh = pricing.valueHigh;
      if (pricing.compsCount !== undefined) cardUpdate.compsCount = pricing.compsCount;
      if (pricing.sources !== undefined) cardUpdate.sources = pricing.sources;
    }

    // Extract authenticity data if available
    if (
      partialResults.authenticityResult &&
      typeof partialResults.authenticityResult === 'object'
    ) {
      const authenticity = partialResults.authenticityResult as {
        authenticityScore?: number;
        signals?: Record<string, number>;
      };

      if (authenticity.authenticityScore !== undefined) {
        cardUpdate.authenticityScore = authenticity.authenticityScore;
      }
      if (authenticity.signals !== undefined) {
        cardUpdate.authenticitySignals = authenticity.signals;
      }
    }

    // Only update if we have data to persist
    if (Object.keys(cardUpdate).length > 0) {
      await tracing.trace(
        'dynamodb_update_card',
        () => updateCard(userId, cardId, cardUpdate, requestId),
        {
          userId,
          cardId,
          requestId,
        },
      );

      logger.info('Partial results persisted', {
        userId,
        cardId,
        persistedFields: Object.keys(cardUpdate),
        requestId,
      });

      return true;
    } else {
      logger.warn('No valid partial results to persist', {
        userId,
        cardId,
        requestId,
      });

      return false;
    }
  } catch (error) {
    logger.error(
      'Failed to persist partial results',
      error instanceof Error ? error : new Error(String(error)),
      {
        userId,
        cardId,
        requestId,
      },
    );

    return false;
  }
}

/**
 * Send error details to Dead Letter Queue
 * Allows for manual inspection and retry of failed workflows
 */
async function sendToDLQ(errorEvent: ErrorHandlerInput): Promise<string | undefined> {
  const dlqUrl = process.env.DLQ_URL;

  if (!dlqUrl) {
    logger.warn('DLQ_URL not configured, skipping DLQ message', {
      userId: errorEvent.userId,
      cardId: errorEvent.cardId,
      requestId: errorEvent.requestId,
    });
    return undefined;
  }

  try {
    const messageBody = JSON.stringify({
      userId: errorEvent.userId,
      cardId: errorEvent.cardId,
      requestId: errorEvent.requestId,
      error: errorEvent.error,
      partialResults: errorEvent.partialResults,
      timestamp: new Date().toISOString(),
    });

    const params: SendMessageCommandInput = {
      QueueUrl: dlqUrl,
      MessageBody: messageBody,
      MessageAttributes: {
        ErrorType: {
          DataType: 'String',
          StringValue: errorEvent.error.Error,
        },
        UserId: {
          DataType: 'String',
          StringValue: errorEvent.userId,
        },
        CardId: {
          DataType: 'String',
          StringValue: errorEvent.cardId,
        },
        RequestId: {
          DataType: 'String',
          StringValue: errorEvent.requestId,
        },
      },
    };

    const command = new SendMessageCommand(params);
    const response = await tracing.trace('sqs_send_dlq_message', () => sqsClient.send(command), {
      cardId: errorEvent.cardId,
      userId: errorEvent.userId,
      requestId: errorEvent.requestId,
    });

    logger.info('Message sent to DLQ', {
      messageId: response.MessageId,
      userId: errorEvent.userId,
      cardId: errorEvent.cardId,
      requestId: errorEvent.requestId,
    });

    return response.MessageId;
  } catch (error) {
    logger.error(
      'Failed to send message to DLQ',
      error instanceof Error ? error : new Error(String(error)),
      {
        userId: errorEvent.userId,
        cardId: errorEvent.cardId,
        requestId: errorEvent.requestId,
        dlqUrl,
      },
    );

    return undefined;
  }
}
