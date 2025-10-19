/**
 * Pricing Agent Lambda Handler
 * Step Functions task that computes card valuation using market data and AI
 */

import type { Handler } from 'aws-lambda';
import type { FeatureEnvelope, PricingResult, ValuationSummary } from '@collectiq/shared';
import { logger } from '../utils/logger.js';
import { tracing } from '../utils/tracing.js';
import { getPricingOrchestrator } from '../adapters/pricing-orchestrator.js';
import { bedrockService } from '../adapters/bedrock-service.js';

/**
 * Input structure for Pricing Agent
 * Received from Step Functions workflow
 */
interface PricingAgentInput {
  userId: string;
  cardId: string;
  features: FeatureEnvelope;
  cardMeta: {
    name?: string;
    set?: string;
    number?: string;
    rarity?: string;
    conditionEstimate?: string;
  };
  requestId: string;
  forceRefresh?: boolean;
}

/**
 * Output structure for Pricing Agent
 * Returned to Step Functions workflow
 */
interface PricingAgentOutput {
  pricingResult: PricingResult;
  valuationSummary: ValuationSummary;
  requestId: string;
}

/**
 * Pricing Agent Lambda Handler
 * Fetches market pricing data and generates AI-powered valuation summary
 *
 * @param event - Input from Step Functions with card metadata and features
 * @returns Pricing result and valuation summary
 */
export const handler: Handler<PricingAgentInput, PricingAgentOutput> = async (event) => {
  const { userId, cardId, cardMeta, requestId, forceRefresh = false } = event;
  const startTime = Date.now();

  tracing.startSubsegment('pricing_agent_handler', { userId, cardId, requestId });
  tracing.addAnnotation('operation', 'pricing_agent');
  tracing.addAnnotation('cardId', cardId);

  logger.info('Pricing Agent invoked', {
    userId,
    cardId,
    cardName: cardMeta.name,
    set: cardMeta.set,
    condition: cardMeta.conditionEstimate,
    forceRefresh,
    requestId,
  });

  try {
    // Step 1: Extract card information for pricing query
    const cardName = cardMeta.name || 'Unknown Card';
    const set = cardMeta.set || '';
    const condition = cardMeta.conditionEstimate || 'Near Mint';

    if (!cardMeta.name) {
      logger.warn('Card name not provided, pricing may be inaccurate', {
        userId,
        cardId,
        requestId,
      });
    }

    // Step 2: Fetch pricing data from multiple sources
    logger.info('Fetching pricing data', {
      cardName,
      set,
      condition,
      requestId,
    });

    const orchestrator = getPricingOrchestrator();

    const pricingResult = await tracing.trace(
      'pricing_fetch_all_comps',
      () =>
        orchestrator.fetchAllComps(
          {
            cardName,
            set: set || undefined,
            number: cardMeta.number || undefined,
            condition,
            windowDays: 14, // Default 14-day window
          },
          userId,
          cardId,
          forceRefresh,
        ),
      { userId, cardId, requestId },
    );

    logger.info('Pricing data fetched successfully', {
      compsCount: pricingResult.compsCount,
      sources: pricingResult.sources,
      valueMedian: pricingResult.valueMedian,
      confidence: pricingResult.confidence,
      requestId,
    });

    // Step 3: Invoke Bedrock for AI-powered valuation summary
    logger.info('Invoking Bedrock for valuation summary', {
      requestId,
    });

    const valuationSummary = await tracing.trace(
      'bedrock_invoke_valuation',
      () =>
        bedrockService.invokeValuation({
          cardName,
          set,
          condition,
          pricingResult,
          // historicalTrend could be added in future iterations
        }),
      { userId, cardId, requestId },
    );

    logger.info('Valuation summary generated', {
      fairValue: valuationSummary.fairValue,
      trend: valuationSummary.trend,
      confidence: valuationSummary.confidence,
      requestId,
    });

    // Return results to Step Functions
    tracing.endSubsegment('pricing_agent_handler', {
      success: true,
      cardId,
      userId,
      durationMs: Date.now() - startTime,
    });

    return {
      pricingResult,
      valuationSummary,
      requestId,
    };
  } catch (error) {
    tracing.endSubsegment('pricing_agent_handler', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      cardId,
      userId,
      durationMs: Date.now() - startTime,
    });

    logger.error(
      'Pricing Agent failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        userId,
        cardId,
        cardName: cardMeta.name,
        requestId,
      },
    );

    // Re-throw error to trigger Step Functions retry/error handling
    throw error;
  }
};
