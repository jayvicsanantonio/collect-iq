/**
 * RekognitionExtract Lambda Handler
 * Step Functions task that extracts visual features from card images
 */

import type { Handler } from 'aws-lambda';
import type { FeatureEnvelope } from '@collectiq/shared';
import { logger } from '../utils/logger.js';
import { rekognitionAdapter } from '../adapters/rekognition-adapter.js';
import { deleteCard } from '../store/card-service.js';

/**
 * Input structure for RekognitionExtract task
 * Received from Step Functions workflow
 */
interface RekognitionExtractInput {
  userId: string;
  cardId: string;
  s3Keys: {
    front: string;
    back?: string;
  };
  requestId: string;
}

/**
 * Output structure for RekognitionExtract task
 * Returned to Step Functions workflow
 */
interface RekognitionExtractOutput {
  features: FeatureEnvelope;
  backFeatures?: FeatureEnvelope;
  requestId: string;
}

/**
 * RekognitionExtract Lambda Handler
 * Extracts visual features from front (and optionally back) card images
 *
 * @param event - Input from Step Functions with userId, cardId, and s3Keys
 * @returns Feature envelopes for front and back images
 */
export const handler: Handler<RekognitionExtractInput, RekognitionExtractOutput> = async (
  event
) => {
  const { userId, cardId, s3Keys, requestId } = event;

  logger.info('RekognitionExtract task invoked', {
    userId,
    cardId,
    hasFront: !!s3Keys.front,
    hasBack: !!s3Keys.back,
    requestId,
  });

  try {
    // Extract features from front image (required)
    logger.info('Extracting features from front image', {
      s3Key: s3Keys.front,
      requestId,
    });

    const frontFeatures = await rekognitionAdapter.extractFeatures(s3Keys.front);

    logger.info('Front image features extracted successfully', {
      ocrBlockCount: frontFeatures.ocr.length,
      holoVariance: frontFeatures.holoVariance,
      blurScore: frontFeatures.quality.blurScore,
      requestId,
    });

    // Extract features from back image if provided (optional)
    let backFeatures: FeatureEnvelope | undefined;

    if (s3Keys.back) {
      logger.info('Extracting features from back image', {
        s3Key: s3Keys.back,
        requestId,
      });

      backFeatures = await rekognitionAdapter.extractFeatures(s3Keys.back);

      logger.info('Back image features extracted successfully', {
        ocrBlockCount: backFeatures.ocr.length,
        requestId,
      });
    } else {
      logger.info('No back image provided, skipping back feature extraction', {
        requestId,
      });
    }

    // Return feature envelopes to Step Functions
    const output: RekognitionExtractOutput = {
      features: frontFeatures,
      requestId,
    };

    if (backFeatures) {
      output.backFeatures = backFeatures;
    }

    logger.info('RekognitionExtract task completed successfully', {
      userId,
      cardId,
      hasBackFeatures: !!backFeatures,
      requestId,
    });

    return output;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if this is a validation error (card validation or content safety)
    const isCardValidationError = errorMessage.includes('does not appear to be a trading card');
    const isContentSafetyError = errorMessage.includes('inappropriate content');
    const shouldCleanup = isCardValidationError || isContentSafetyError;

    logger.error(
      'RekognitionExtract task failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        userId,
        cardId,
        s3Keys,
        requestId,
        isCardValidationError,
        isContentSafetyError,
      }
    );

    // If validation failed, clean up S3 and DynamoDB
    if (shouldCleanup) {
      const cleanupReason = isContentSafetyError ? 'inappropriate content' : 'invalid card type';

      logger.info('Cleaning up rejected upload', {
        userId,
        cardId,
        s3Keys,
        requestId,
        reason: cleanupReason,
      });

      try {
        // Hard delete: removes both DynamoDB record and S3 objects
        await deleteCard(userId, cardId, requestId, true);

        logger.info('Rejected upload cleaned up successfully', {
          userId,
          cardId,
          requestId,
          reason: cleanupReason,
        });
      } catch (cleanupError) {
        // Log cleanup failure but don't mask the original validation error
        logger.error(
          'Failed to clean up rejected upload',
          cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError)),
          {
            userId,
            cardId,
            s3Keys,
            requestId,
            reason: cleanupReason,
          }
        );
      }
    }

    // Re-throw error to trigger Step Functions retry/error handling
    throw error;
  }
};
