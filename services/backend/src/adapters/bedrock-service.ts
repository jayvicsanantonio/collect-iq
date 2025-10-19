/**
 * Bedrock Service
 * Handles AWS Bedrock integration for AI-powered valuation and authenticity analysis
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import type {
  AuthenticitySignals,
  AuthenticityResult,
  ValuationSummary,
  FeatureEnvelope,
  PricingResult,
} from '@collectiq/shared';
import { logger, metrics, tracing } from '../utils/index.js';
import { z } from 'zod';

const bedrockClient = tracing.captureAWSv3Client(
  new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
  }),
);

/**
 * Bedrock configuration from environment
 */
const BEDROCK_CONFIG = {
  modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
  maxTokens: parseInt(process.env.BEDROCK_MAX_TOKENS || '2048', 10),
  temperature: parseFloat(process.env.BEDROCK_TEMPERATURE || '0.2'),
  maxRetries: 3,
  retryDelay: 1000, // milliseconds
};

/**
 * Authenticity context for Bedrock analysis
 */
interface AuthenticityContext {
  features: FeatureEnvelope;
  signals: AuthenticitySignals;
  cardMeta: {
    name?: string;
    set?: string;
    rarity?: string;
    expectedHolo?: boolean;
  };
}

/**
 * Valuation context for Bedrock analysis
 */
interface ValuationContext {
  cardName: string;
  set: string;
  condition: string;
  pricingResult: PricingResult;
  historicalTrend?: string;
}

/**
 * Bedrock response schema for authenticity
 */
const BedrockAuthenticityResponseSchema = z.object({
  authenticityScore: z.number().min(0).max(1),
  fakeDetected: z.boolean(),
  rationale: z.string(),
});

/**
 * Bedrock response schema for valuation
 */
const BedrockValuationResponseSchema = z.object({
  summary: z.string(),
  fairValue: z.number(),
  trend: z.enum(['rising', 'falling', 'stable']),
  recommendation: z.string(),
  confidence: z.number().min(0).max(1),
});

/**
 * BedrockService class
 * Provides methods for invoking Bedrock AI models
 */
export class BedrockService {
  /**
   * Invoke Bedrock with retry logic
   * @param input - Converse command input
   * @returns Converse command output
   */
  private async invokeWithRetry(input: ConverseCommandInput): Promise<ConverseCommandOutput> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= BEDROCK_CONFIG.maxRetries; attempt++) {
      try {
        logger.debug('Invoking Bedrock', {
          attempt,
          modelId: input.modelId,
        });

        const command = new ConverseCommand(input);
        const response = await tracing.trace(
          'bedrock_converse',
          () => bedrockClient.send(command),
          { modelId: input.modelId, attempt },
        );

        logger.info('Bedrock invocation successful', {
          attempt,
          stopReason: response.stopReason,
        });

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn('Bedrock invocation failed', {
          attempt,
          maxRetries: BEDROCK_CONFIG.maxRetries,
          error: lastError.message,
        });

        if (attempt < BEDROCK_CONFIG.maxRetries) {
          // Exponential backoff
          const delay = BEDROCK_CONFIG.retryDelay * Math.pow(2, attempt - 1);
          logger.debug('Retrying Bedrock invocation', { delay, nextAttempt: attempt + 1 });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Bedrock invocation failed after ${BEDROCK_CONFIG.maxRetries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Create system prompt for authenticity analysis
   */
  private createAuthenticitySystemPrompt(): string {
    return `You are an expert Pokémon TCG card authenticator with deep knowledge of card production, printing techniques, and common counterfeiting methods.

Your task is to analyze card authenticity based on visual features and computed signals. You will receive:
1. Visual hash confidence (comparison with authentic reference samples)
2. Text match confidence (OCR validation of expected text patterns)
3. Holographic pattern confidence (analysis of holographic effects)
4. Border consistency (symmetry and ratio analysis)
5. Font validation (kerning, alignment, and size consistency)

Based on these signals, provide:
1. An overall authenticity score (0.0 to 1.0)
2. A boolean flag indicating if the card is likely fake (true if score < 0.85)
3. A clear, concise rationale explaining your assessment

Be thorough but concise. Focus on the most significant indicators of authenticity or fakeness.`;
  }

  /**
   * Create user prompt for authenticity analysis
   */
  private createAuthenticityUserPrompt(context: AuthenticityContext): string {
    const { signals, cardMeta, features } = context;

    return `Analyze the authenticity of this Pokémon card:

**Card Information:**
- Name: ${cardMeta.name || 'Unknown'}
- Set: ${cardMeta.set || 'Unknown'}
- Rarity: ${cardMeta.rarity || 'Unknown'}
- Expected Holographic: ${cardMeta.expectedHolo ? 'Yes' : 'No'}

**Authenticity Signals:**
- Visual Hash Confidence: ${(signals.visualHashConfidence * 100).toFixed(1)}%
- Text Match Confidence: ${(signals.textMatchConfidence * 100).toFixed(1)}%
- Holographic Pattern Confidence: ${(signals.holoPatternConfidence * 100).toFixed(1)}%
- Border Consistency: ${(signals.borderConsistency * 100).toFixed(1)}%
- Font Validation: ${(signals.fontValidation * 100).toFixed(1)}%

**Additional Context:**
- OCR Blocks Detected: ${features.ocr.length}
- Image Quality (Blur Score): ${(features.quality.blurScore * 100).toFixed(1)}%
- Glare Detected: ${features.quality.glareDetected ? 'Yes' : 'No'}
- Border Symmetry: ${(features.borders.symmetryScore * 100).toFixed(1)}%

Provide your analysis in the following JSON format:
{
  "authenticityScore": <number between 0.0 and 1.0>,
  "fakeDetected": <boolean>,
  "rationale": "<2-3 sentence explanation>"
}`;
  }

  /**
   * Create system prompt for valuation analysis
   */
  private createValuationSystemPrompt(): string {
    return `You are an expert Pokémon TCG card valuator with extensive knowledge of market trends, card conditions, and pricing dynamics.

Your task is to analyze pricing data and provide a fair market valuation with actionable recommendations. You will receive:
1. Aggregated pricing data from multiple sources (eBay, TCGPlayer, PriceCharting)
2. Card condition information
3. Market confidence and volatility metrics

Based on this data, provide:
1. A concise 2-3 sentence summary of the card's value
2. A fair value estimate
3. Market trend assessment (rising, falling, or stable)
4. A brief recommendation for collectors or sellers

Be practical and data-driven. Consider market confidence and volatility in your assessment.`;
  }

  /**
   * Create user prompt for valuation analysis
   */
  private createValuationUserPrompt(context: ValuationContext): string {
    const { cardName, set, condition, pricingResult, historicalTrend } = context;

    return `Analyze the market valuation for this Pokémon card:

**Card Information:**
- Name: ${cardName}
- Set: ${set}
- Condition: ${condition}

**Pricing Data:**
- Value Range: $${pricingResult.valueLow.toFixed(2)} - $${pricingResult.valueHigh.toFixed(2)}
- Median Value: $${pricingResult.valueMedian.toFixed(2)}
- Comparables Count: ${pricingResult.compsCount}
- Data Window: ${pricingResult.windowDays} days
- Sources: ${pricingResult.sources.join(', ')}
- Market Confidence: ${(pricingResult.confidence * 100).toFixed(1)}%
- Volatility: ${(pricingResult.volatility * 100).toFixed(1)}%

${historicalTrend ? `**Historical Trend:** ${historicalTrend}` : ''}

Provide your analysis in the following JSON format:
{
  "summary": "<2-3 sentence market summary>",
  "fairValue": <number>,
  "trend": "<rising|falling|stable>",
  "recommendation": "<brief recommendation>",
  "confidence": <number between 0.0 and 1.0>
}`;
  }

  /**
   * Parse Bedrock response text to extract JSON
   */
  private parseBedrockResponse(responseText: string): unknown {
    // Try to extract JSON from response
    // Bedrock might wrap JSON in markdown code blocks
    const jsonMatch =
      responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in Bedrock response');
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];

    try {
      return JSON.parse(jsonText);
    } catch (error) {
      logger.error(
        'Failed to parse Bedrock JSON response',
        error instanceof Error ? error : new Error(String(error)),
        {
          responseText: jsonText,
        },
      );
      throw new Error('Invalid JSON in Bedrock response');
    }
  }

  /**
   * Invoke Bedrock for authenticity judgment
   * @param context - Authenticity context with features and signals
   * @returns Authenticity result with score, detection flag, and rationale
   */
  async invokeAuthenticity(context: AuthenticityContext): Promise<AuthenticityResult> {
    logger.info('Invoking Bedrock for authenticity analysis', {
      cardName: context.cardMeta.name,
      set: context.cardMeta.set,
    });

    try {
      const startTime = Date.now();

      const input: ConverseCommandInput = {
        modelId: BEDROCK_CONFIG.modelId,
        messages: [
          {
            role: 'user',
            content: [
              {
                text: this.createAuthenticityUserPrompt(context),
              },
            ],
          },
        ],
        system: [
          {
            text: this.createAuthenticitySystemPrompt(),
          },
        ],
        inferenceConfig: {
          maxTokens: BEDROCK_CONFIG.maxTokens,
          temperature: BEDROCK_CONFIG.temperature,
        },
      };
      const response = await this.invokeWithRetry(input);
      const latency = Date.now() - startTime;
      const tokenCount = response.usage?.outputTokens ?? response.usage?.totalTokens ?? undefined;
      // Extract response text
      const responseText = response.output?.message?.content?.[0]?.text;
      if (!responseText) {
        throw new Error('Empty response from Bedrock');
      }

      await metrics.recordBedrockInvocation('authenticity', latency, tokenCount);

      logger.debug('Bedrock authenticity response received', {
        responseLength: responseText.length,
      });

      // Parse and validate response
      const parsedResponse = this.parseBedrockResponse(responseText);
      const validatedResponse = BedrockAuthenticityResponseSchema.parse(parsedResponse);

      // Construct final result
      const modelDetectedFake = validatedResponse.fakeDetected;
      const scoreTriggersFake = validatedResponse.authenticityScore < 0.85;
      const result: AuthenticityResult = {
        authenticityScore: validatedResponse.authenticityScore,
        fakeDetected: modelDetectedFake || scoreTriggersFake,
        rationale: validatedResponse.rationale,
        signals: context.signals,
        verifiedByAI: true,
      };

      logger.info('Bedrock authenticity analysis complete', {
        authenticityScore: result.authenticityScore,
        fakeDetected: result.fakeDetected,
      });

      return result;
    } catch (error) {
      logger.error(
        'Bedrock authenticity analysis failed',
        error instanceof Error ? error : new Error(String(error)),
        { cardName: context.cardMeta.name },
      );

      // Fallback: return signals-only result with reduced confidence
      logger.warn('Returning fallback authenticity result based on signals only');

      // Calculate simple average of signals as fallback score
      const fallbackScore =
        (context.signals.visualHashConfidence +
          context.signals.textMatchConfidence +
          context.signals.holoPatternConfidence +
          context.signals.borderConsistency +
          context.signals.fontValidation) /
        5;

      return {
        authenticityScore: fallbackScore,
        fakeDetected: fallbackScore < 0.85,
        rationale:
          'AI analysis unavailable. Score based on automated signals only. Manual review recommended.',
        signals: context.signals,
        verifiedByAI: false,
      };
    }
  }

  /**
   * Invoke Bedrock for valuation analysis
   * @param context - Valuation context with pricing data
   * @returns Valuation summary with fair value and recommendations
   */
  async invokeValuation(context: ValuationContext): Promise<ValuationSummary> {
    logger.info('Invoking Bedrock for valuation analysis', {
      cardName: context.cardName,
      set: context.set,
      condition: context.condition,
    });

    try {
      const startTime = Date.now();

      const input: ConverseCommandInput = {
        modelId: BEDROCK_CONFIG.modelId,
        messages: [
          {
            role: 'user',
            content: [
              {
                text: this.createValuationUserPrompt(context),
              },
            ],
          },
        ],
        system: [
          {
            text: this.createValuationSystemPrompt(),
          },
        ],
        inferenceConfig: {
          maxTokens: BEDROCK_CONFIG.maxTokens,
          temperature: BEDROCK_CONFIG.temperature,
        },
      };
      const response = await this.invokeWithRetry(input);
      const latency = Date.now() - startTime;
      const tokenCount = response.usage?.outputTokens ?? response.usage?.totalTokens ?? undefined;
      // Extract response text
      const responseText = response.output?.message?.content?.[0]?.text;
      if (!responseText) {
        throw new Error('Empty response from Bedrock');
      }

      await metrics.recordBedrockInvocation('valuation', latency, tokenCount);

      logger.debug('Bedrock valuation response received', {
        responseLength: responseText.length,
      });

      // Parse and validate response
      const parsedResponse = this.parseBedrockResponse(responseText);
      const validatedResponse = BedrockValuationResponseSchema.parse(parsedResponse);

      logger.info('Bedrock valuation analysis complete', {
        fairValue: validatedResponse.fairValue,
        trend: validatedResponse.trend,
        confidence: validatedResponse.confidence,
      });

      return validatedResponse;
    } catch (error) {
      logger.error(
        'Bedrock valuation analysis failed',
        error instanceof Error ? error : new Error(String(error)),
        { cardName: context.cardName },
      );

      // Fallback: return basic valuation based on pricing data
      logger.warn('Returning fallback valuation result based on pricing data only');

      return {
        summary: `Based on ${context.pricingResult.compsCount} recent sales, this card is valued between $${context.pricingResult.valueLow.toFixed(2)} and $${context.pricingResult.valueHigh.toFixed(2)}. AI analysis unavailable.`,
        fairValue: context.pricingResult.valueMedian,
        trend: 'stable',
        recommendation: 'Manual review recommended for accurate valuation.',
        confidence: Math.max(0.3, context.pricingResult.confidence * 0.7), // Reduced confidence
      };
    }
  }
}

// Export singleton instance
export const bedrockService = new BedrockService();
