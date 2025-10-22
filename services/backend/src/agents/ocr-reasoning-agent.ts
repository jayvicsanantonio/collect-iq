/**
 * OCR Reasoning Agent Lambda Handler
 * Step Functions task that interprets OCR results using Amazon Bedrock
 */

import type { Handler } from 'aws-lambda';
import type { FeatureEnvelope } from '@collectiq/shared';
import { logger, tracing } from '../utils/index.js';
import {
  bedrockOcrReasoningService,
  type CardMetadata,
  type OcrContext,
} from '../adapters/bedrock-ocr-reasoning.js';
import { getPokemonTCGSetResolver } from '../adapters/pokemontcg-set-resolver.js';

/**
 * Input structure for OCR Reasoning Agent
 * Received from Step Functions workflow
 */
interface OcrReasoningAgentInput {
  userId: string;
  cardId: string;
  features: FeatureEnvelope;
  requestId: string;
}

/**
 * Output structure for OCR Reasoning Agent
 * Returned to Step Functions workflow
 */
interface OcrReasoningAgentOutput {
  cardMetadata: CardMetadata;
  requestId: string;
}

/**
 * OCR Reasoning Agent Lambda Handler
 * Interprets OCR results from Rekognition using Bedrock AI reasoning
 *
 * @param event - Input from Step Functions with features from Rekognition
 * @returns Enriched card metadata with confidence scores and rationales
 */
export const handler: Handler<OcrReasoningAgentInput, OcrReasoningAgentOutput> = async (event) => {
  const { userId, cardId, features, requestId } = event;
  const startTime = Date.now();

  tracing.startSubsegment('ocr_reasoning_agent_handler', { userId, cardId, requestId });
  tracing.addAnnotation('operation', 'ocr_reasoning_agent');
  tracing.addAnnotation('cardId', cardId);

  // INFO: OCR reasoning start with cardId and OCR block count
  logger.info('OCR reasoning started', {
    cardId,
    userId,
    ocrBlockCount: features.ocr?.length || 0,
    requestId,
  });

  try {
    // Step 1: Extract OCR blocks from FeatureEnvelope
    const ocrBlocks = features.ocr || [];

    if (ocrBlocks.length === 0) {
      logger.warn('No OCR blocks found in FeatureEnvelope', {
        userId,
        cardId,
        requestId,
      });
    }

    // Step 2: Build OcrContext with OCR blocks and visual features
    const ocrContext: OcrContext = {
      ocrBlocks,
      visualContext: {
        holoVariance: features.holoVariance || 0,
        borderSymmetry: features.borders?.symmetryScore || 0,
        imageQuality: {
          blurScore: features.quality?.blurScore || 0,
          glareDetected: features.quality?.glareDetected || false,
        },
      },
    };

    logger.info('OCR context built', {
      ocrBlockCount: ocrBlocks.length,
      holoVariance: ocrContext.visualContext.holoVariance,
      borderSymmetry: ocrContext.visualContext.borderSymmetry,
      blurScore: ocrContext.visualContext.imageQuality.blurScore,
      glareDetected: ocrContext.visualContext.imageQuality.glareDetected,
      requestId,
    });

    // Step 3: Invoke BedrockOcrReasoningService with context
    const bedrockStartTime = Date.now();

    const cardMetadata = await tracing.trace(
      'bedrock_ocr_reasoning_invocation',
      () => bedrockOcrReasoningService.interpretOcr(ocrContext, requestId),
      { userId, cardId, requestId }
    );

    const bedrockLatency = Date.now() - bedrockStartTime;

    // Step 4: Verify set using Pokémon TCG API (if card name and collector number available)
    if (cardMetadata.name.value && cardMetadata.collectorNumber.value) {
      logger.info('Verifying set via Pokémon TCG API', {
        cardId,
        cardName: cardMetadata.name.value,
        collectorNumber: cardMetadata.collectorNumber.value,
        aiSet: cardMetadata.set.value,
        requestId,
      });

      try {
        const resolver = getPokemonTCGSetResolver();
        const setMatch = await resolver.resolveSet(
          cardMetadata.name.value,
          cardMetadata.collectorNumber.value,
          requestId
        );

        if (setMatch) {
          // Update set with API-verified data
          const previousSet = cardMetadata.set.value;
          cardMetadata.set = {
            value: setMatch.setName,
            confidence: setMatch.confidence,
            rationale: `${setMatch.matchReason}. Verified via Pokémon TCG API. ${
              previousSet && previousSet !== setMatch.setName
                ? `AI initially suggested "${previousSet}".`
                : ''
            }`,
          };

          logger.info('Set verified and updated via API', {
            cardId,
            cardName: cardMetadata.name.value,
            collectorNumber: cardMetadata.collectorNumber.value,
            aiSet: previousSet,
            verifiedSet: setMatch.setName,
            matchReason: setMatch.matchReason,
            confidence: setMatch.confidence,
            requestId,
          });
        } else {
          logger.warn('Could not verify set via API, using AI result', {
            cardId,
            cardName: cardMetadata.name.value,
            collectorNumber: cardMetadata.collectorNumber.value,
            aiSet: cardMetadata.set.value,
            requestId,
          });
        }
      } catch (error) {
        logger.error(
          'Failed to verify set via API, using AI result',
          error instanceof Error ? error : new Error(String(error)),
          {
            cardId,
            cardName: cardMetadata.name.value,
            collectorNumber: cardMetadata.collectorNumber.value,
            requestId,
          }
        );
      }
    }

    // Step 5: Handle successful responses and enrich card metadata
    const setInfo = cardMetadata.set;
    const setValueForLog =
      setInfo.value ||
      ('candidates' in setInfo && setInfo.candidates.length > 0
        ? setInfo.candidates[0].value
        : null);

    // INFO: Bedrock response with latency, token count, and confidence
    logger.info('OCR reasoning complete', {
      cardId,
      cardName: cardMetadata.name.value,
      nameConfidence: cardMetadata.name.confidence,
      rarity: cardMetadata.rarity.value,
      set: setValueForLog,
      overallConfidence: cardMetadata.overallConfidence,
      verifiedByAI: cardMetadata.verifiedByAI,
      latency: bedrockLatency,
      requestId,
    });

    // Log detailed metadata for debugging
    logger.debug('OCR metadata details', {
      cardId,
      metadata: {
        name: cardMetadata.name,
        rarity: cardMetadata.rarity,
        set: cardMetadata.set,
        collectorNumber: cardMetadata.collectorNumber,
        illustrator: cardMetadata.illustrator,
      },
      reasoningTrail: cardMetadata.reasoningTrail,
      requestId,
    });

    // Return enriched CardMetadata to Step Functions
    tracing.endSubsegment('ocr_reasoning_agent_handler', {
      success: true,
      cardId,
      userId,
      durationMs: Date.now() - startTime,
      overallConfidence: cardMetadata.overallConfidence,
      verifiedByAI: cardMetadata.verifiedByAI,
    });

    return {
      cardMetadata,
      requestId,
    };
  } catch (error) {
    // Step 5: Implement fallback logic for Bedrock failures
    // The BedrockOcrReasoningService already handles fallback internally,
    // but we catch any unexpected errors here
    const durationMs = Date.now() - startTime;

    tracing.endSubsegment('ocr_reasoning_agent_handler', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      cardId,
      userId,
      durationMs,
    });

    // ERROR: Failures with full error details and retry count
    logger.error(
      'OCR reasoning agent failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        userId,
        cardId,
        ocrBlockCount: features.ocr?.length || 0,
        durationMs,
        requestId,
      }
    );

    // Re-throw error to trigger Step Functions retry/error handling
    throw error;
  }
};
