/**
 * Authenticity Agent Lambda Handler
 * Step Functions task that analyzes card authenticity using visual features and AI
 */

import type { Handler } from 'aws-lambda';
import type { FeatureEnvelope, AuthenticityResult } from '@collectiq/shared';
import { logger } from '../utils/logger.js';
import { tracing } from '../utils/tracing.js';
import { computePerceptualHashFromS3 } from '../utils/phash.js';
import { computeVisualHashConfidence } from '../utils/reference-hash-comparison.js';
import { computeAuthenticitySignals } from '../utils/authenticity-signals.js';
import { bedrockService } from '../adapters/bedrock-service.js';

/**
 * Input structure for Authenticity Agent
 * Received from Step Functions workflow
 */
interface AuthenticityAgentInput {
  userId: string;
  cardId: string;
  features: FeatureEnvelope;
  cardMeta: {
    name?: string;
    set?: string;
    rarity?: string;
    frontS3Key: string;
    backS3Key?: string;
  };
  requestId: string;
}

/**
 * Output structure for Authenticity Agent
 * Returned to Step Functions workflow
 */
interface AuthenticityAgentOutput {
  authenticityResult: AuthenticityResult;
  requestId: string;
}

/**
 * Determine if card is expected to be holographic based on rarity
 */
function isExpectedHolographic(rarity?: string): boolean {
  if (!rarity) return false;

  const holoRarities = [
    'holo',
    'holographic',
    'reverse holo',
    'ultra rare',
    'secret rare',
    'rainbow rare',
    'full art',
    'vmax',
    'vstar',
    'ex',
    'gx',
  ];

  const rarityLower = rarity.toLowerCase();
  return holoRarities.some((holoRarity) => rarityLower.includes(holoRarity));
}

/**
 * Authenticity Agent Lambda Handler
 * Analyzes card authenticity using visual hash comparison, feature analysis, and AI judgment
 *
 * @param event - Input from Step Functions with features and card metadata
 * @returns Authenticity result with score, signals, and rationale
 */
export const handler: Handler<AuthenticityAgentInput, AuthenticityAgentOutput> = async (event) => {
  const { userId, cardId, features, cardMeta, requestId } = event;
  const startTime = Date.now();

  tracing.startSubsegment('authenticity_agent_handler', { userId, cardId, requestId });
  tracing.addAnnotation('operation', 'authenticity_agent');
  tracing.addAnnotation('cardId', cardId);

  logger.info('Authenticity Agent invoked', {
    userId,
    cardId,
    cardName: cardMeta.name,
    requestId,
  });

  try {
    // Step 1: Compute visual hash from front image
    logger.info('Computing visual hash', { s3Key: cardMeta.frontS3Key });

    const frontHash = await tracing.trace(
      'compute_perceptual_hash',
      () => computePerceptualHashFromS3(cardMeta.frontS3Key),
      { cardId, userId },
    );

    logger.info('Visual hash computed', { frontHash });

    // Step 2: Compare with reference hashes
    logger.info('Comparing with reference hashes', { cardName: cardMeta.name });

    const visualHashConfidence = cardMeta.name
      ? await tracing.trace(
          'compute_visual_hash_confidence',
          () => computeVisualHashConfidence(frontHash, cardMeta.name as string),
          { cardId, cardName: cardMeta.name },
        )
      : 0.5; // Neutral confidence if card name unknown

    logger.info('Visual hash confidence computed', { visualHashConfidence });

    // Step 3: Determine if card is expected to be holographic
    const expectedHolo = isExpectedHolographic(cardMeta.rarity);

    logger.info('Holographic expectation determined', {
      rarity: cardMeta.rarity,
      expectedHolo,
    });

    // Step 4: Compute authenticity signals
    logger.info('Computing authenticity signals');

    const signals = computeAuthenticitySignals(
      features,
      visualHashConfidence,
      cardMeta.name,
      expectedHolo,
    );

    logger.info('Authenticity signals computed', signals);

    // Step 5: Invoke Bedrock for AI-powered authenticity judgment
    logger.info('Invoking Bedrock for authenticity judgment');

    const authenticityResult = await tracing.trace(
      'bedrock_invoke_authenticity',
      () =>
        bedrockService.invokeAuthenticity({
          features,
          signals,
          cardMeta: {
            name: cardMeta.name,
            set: cardMeta.set,
            rarity: cardMeta.rarity,
            expectedHolo,
          },
        }),
      { userId, cardId, requestId },
    );

    logger.info('Authenticity analysis complete', {
      authenticityScore: authenticityResult.authenticityScore,
      fakeDetected: authenticityResult.fakeDetected,
      verifiedByAI: authenticityResult.verifiedByAI,
    });

    // Return result to Step Functions
    tracing.endSubsegment('authenticity_agent_handler', {
      success: true,
      cardId,
      userId,
      durationMs: Date.now() - startTime,
      authenticityScore: authenticityResult.authenticityScore,
    });

    return {
      authenticityResult,
      requestId,
    };
  } catch (error) {
    tracing.endSubsegment('authenticity_agent_handler', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      cardId,
      userId,
      durationMs: Date.now() - startTime,
    });

    logger.error(
      'Authenticity Agent failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        userId,
        cardId,
        requestId,
      },
    );

    // Re-throw error to trigger Step Functions retry/error handling
    throw error;
  }
};
