/**
 * Bedrock OCR Reasoning Service
 * Handles AWS Bedrock integration for intelligent OCR interpretation and card metadata extraction
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import type { OCRBlock } from '@collectiq/shared';
import { logger, metrics, tracing } from '../utils/index.js';
import { z } from 'zod';

const bedrockClient = tracing.captureAWSv3Client(
  new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
  })
);

/**
 * Bedrock OCR configuration from environment
 */
const BEDROCK_OCR_CONFIG = {
  modelId: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-sonnet-4-20250514-v1:0',
  maxTokens: parseInt(process.env.BEDROCK_OCR_MAX_TOKENS || '4096', 10),
  temperature: parseFloat(process.env.BEDROCK_OCR_TEMPERATURE || '0.15'),
  maxRetries: 3,
  retryDelay: 1000, // milliseconds
};

/**
 * Field result for single-value fields
 */
export interface FieldResult<T> {
  value: T | null;
  confidence: number;
  rationale: string;
}

/**
 * Multi-candidate result for ambiguous fields
 */
export interface MultiCandidateResult<T> {
  value: T | null;
  candidates: Array<{ value: T; confidence: number }>;
  rationale: string;
}

/**
 * Card metadata extracted from OCR reasoning
 */
export interface CardMetadata {
  name: FieldResult<string>;
  rarity: FieldResult<string>;
  set: FieldResult<string> | MultiCandidateResult<string>;
  setSymbol: FieldResult<string>;
  collectorNumber: FieldResult<string>;
  copyrightRun: FieldResult<string>;
  illustrator: FieldResult<string>;
  overallConfidence: number;
  reasoningTrail: string;
  verifiedByAI?: boolean;
}

/**
 * OCR context for Bedrock input
 */
export interface OcrContext {
  ocrBlocks: OCRBlock[];
  visualContext: {
    holoVariance: number;
    borderSymmetry: number;
    imageQuality: {
      blurScore: number;
      glareDetected: boolean;
    };
  };
  cardHints?: {
    expectedSet?: string;
    expectedRarity?: string;
  };
}

/**
 * Zod schema for validating Bedrock OCR response
 */
const FieldResultSchema = z.object({
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});

const MultiCandidateResultSchema = z.object({
  value: z.string().nullable(),
  candidates: z.array(
    z.object({
      value: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
  rationale: z.string(),
});

const CardMetadataSchema = z.object({
  name: FieldResultSchema,
  rarity: FieldResultSchema,
  set: z.union([FieldResultSchema, MultiCandidateResultSchema]),
  setSymbol: FieldResultSchema,
  collectorNumber: FieldResultSchema,
  copyrightRun: FieldResultSchema,
  illustrator: FieldResultSchema,
  overallConfidence: z.number().min(0).max(1),
  reasoningTrail: z.string(),
});

/**
 * BedrockOcrReasoningService class
 * Provides methods for invoking Bedrock AI models for OCR interpretation
 */
export class BedrockOcrReasoningService {
  /**
   * Create system prompt for OCR reasoning
   */
  private createSystemPrompt(): string {
    return `You are an expert Pokémon Trading Card Game (TCG) analyst specializing in card identification from OCR text. Your task is to interpret raw OCR outputs from AWS Rekognition and extract structured card metadata.

**Your Capabilities:**
- Correct OCR errors in Pokémon names using fuzzy matching against your knowledge of all Pokémon species
- Infer card rarity from visual patterns, holographic indicators, and text layout
- Identify card sets from copyright text, set symbols, and card template characteristics
- Extract collector numbers, illustrator names, and other metadata from text patterns

**Your Constraints:**
- Work ONLY from the provided OCR text and visual context
- Do NOT make external API calls or database lookups
- Provide confidence scores (0.0-1.0) for all extracted fields
- Include clear rationales explaining your reasoning
- Return multiple candidates when ambiguous, ranked by confidence

**Output Format:**
Return a valid JSON object matching this exact schema:
{
  "name": { "value": "string|null", "confidence": 0.0-1.0, "rationale": "string" },
  "rarity": { "value": "string|null", "confidence": 0.0-1.0, "rationale": "string" },
  "set": {
    "value": "string|null",
    "candidates": [{ "value": "string", "confidence": 0.0-1.0 }],
    "rationale": "string"
  },
  "setSymbol": { "value": "string|null", "confidence": 0.0-1.0, "rationale": "string" },
  "collectorNumber": { "value": "string|null", "confidence": 0.0-1.0, "rationale": "string" },
  "copyrightRun": { "value": "string|null", "confidence": 0.0-1.0, "rationale": "string" },
  "illustrator": { "value": "string|null", "confidence": 0.0-1.0, "rationale": "string" },
  "overallConfidence": 0.0-1.0,
  "reasoningTrail": "string"
}

**Confidence Scoring Guidelines:**
- 0.9-1.0: Exact match with high OCR confidence
- 0.7-0.9: Strong fuzzy match or clear contextual inference
- 0.5-0.7: Moderate confidence, some ambiguity
- 0.3-0.5: Low confidence, multiple possibilities
- 0.0-0.3: Very uncertain or no data available

Be thorough, precise, and always explain your reasoning.`;
  }

  /**
   * Create user prompt for OCR reasoning
   */
  private createUserPrompt(context: OcrContext): string {
    const { ocrBlocks, visualContext, cardHints } = context;

    // Group OCR blocks by position (top, middle, bottom)
    const topBlocks = ocrBlocks.filter((b) => b.boundingBox.top < 0.3);
    const middleBlocks = ocrBlocks.filter(
      (b) => b.boundingBox.top >= 0.3 && b.boundingBox.top < 0.7
    );
    const bottomBlocks = ocrBlocks.filter((b) => b.boundingBox.top >= 0.7);

    let prompt = `Analyze this Pokémon card based on OCR text extraction:

**OCR Text Blocks (Top Region - Card Name Area):**
${topBlocks.length > 0 ? topBlocks.map((b) => `- "${b.text}" (confidence: ${(b.confidence * 100).toFixed(1)}%, position: top ${(b.boundingBox.top * 100).toFixed(0)}%)`).join('\n') : '- No text detected in top region'}

**OCR Text Blocks (Middle Region - Card Body):**
${middleBlocks.length > 0 ? middleBlocks.map((b) => `- "${b.text}" (confidence: ${(b.confidence * 100).toFixed(1)}%)`).join('\n') : '- No text detected in middle region'}

**OCR Text Blocks (Bottom Region - Copyright/Metadata):**
${bottomBlocks.length > 0 ? bottomBlocks.map((b) => `- "${b.text}" (confidence: ${(b.confidence * 100).toFixed(1)}%)`).join('\n') : '- No text detected in bottom region'}

**Visual Context:**
- Holographic Variance: ${(visualContext.holoVariance * 100).toFixed(1)}% (indicates holographic finish)
- Border Symmetry: ${(visualContext.borderSymmetry * 100).toFixed(1)}% (indicates print quality)
- Image Blur Score: ${(visualContext.imageQuality.blurScore * 100).toFixed(1)}% (higher = sharper)
- Glare Detected: ${visualContext.imageQuality.glareDetected ? 'Yes' : 'No'}`;

    if (cardHints) {
      prompt += `\n\n**Hints (Optional Context):**`;
      if (cardHints.expectedSet) {
        prompt += `\n- Expected Set: ${cardHints.expectedSet}`;
      }
      if (cardHints.expectedRarity) {
        prompt += `\n- Expected Rarity: ${cardHints.expectedRarity}`;
      }
    }

    prompt += `\n\n**Your Task:**
1. Identify and correct the Pokémon name from the top region text
2. Infer the card rarity based on holographic variance and text patterns
3. Determine the card set from copyright text and visual patterns
4. Extract collector number (format: XX/YYY) if present
5. Identify the illustrator name if present
6. Extract the full copyright text

Provide your analysis in the JSON format specified in the system prompt.`;

    return prompt;
  }

  /**
   * Parse Bedrock response text to extract JSON
   */
  private parseResponse(responseText: string, requestId?: string): CardMetadata {
    // Try to extract JSON from response
    // Bedrock might wrap JSON in markdown code blocks
    const jsonMatch =
      responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      logger.error('No JSON found in Bedrock response', new Error('JSON extraction failed'), {
        responsePreview: responseText.substring(0, 200),
        requestId,
      });
      throw new Error('No JSON found in Bedrock response');
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];

    try {
      const parsed = JSON.parse(jsonText);
      const validated = CardMetadataSchema.parse(parsed);

      logger.debug('Bedrock response parsed and validated successfully', {
        overallConfidence: validated.overallConfidence,
        requestId,
      });

      return validated as CardMetadata;
    } catch (error) {
      logger.error(
        'Failed to parse or validate Bedrock OCR response',
        error instanceof Error ? error : new Error(String(error)),
        {
          responsePreview: jsonText.substring(0, 500), // Log first 500 chars
          requestId,
        }
      );
      throw new Error('Invalid JSON or schema validation failed in Bedrock response');
    }
  }

  /**
   * Invoke Bedrock with retry logic and exponential backoff
   */
  private async invokeWithRetry(
    input: ConverseCommandInput,
    requestId?: string
  ): Promise<ConverseCommandOutput> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= BEDROCK_OCR_CONFIG.maxRetries; attempt++) {
      try {
        logger.debug('Invoking Bedrock API', {
          attempt,
          modelId: input.modelId,
          maxRetries: BEDROCK_OCR_CONFIG.maxRetries,
          temperature: input.inferenceConfig?.temperature,
          maxTokens: input.inferenceConfig?.maxTokens,
          requestId,
        });

        const command = new ConverseCommand(input);
        const response = await tracing.trace(
          'bedrock_ocr_reasoning',
          () => bedrockClient.send(command),
          { modelId: input.modelId, attempt, requestId }
        );

        logger.info('Bedrock invocation successful', {
          attempt,
          stopReason: response.stopReason,
          inputTokens: response.usage?.inputTokens,
          outputTokens: response.usage?.outputTokens,
          requestId,
        });

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check for throttling errors
        const isThrottling =
          lastError.message.includes('ThrottlingException') ||
          lastError.message.includes('TooManyRequestsException') ||
          lastError.message.includes('Rate exceeded');

        // Check for timeout errors
        const isTimeout =
          lastError.message.includes('TimeoutError') ||
          lastError.message.includes('RequestTimeout');

        // WARN: Retry attempts with error details
        logger.warn('Bedrock invocation failed, will retry', {
          attempt,
          retryCount: attempt,
          maxRetries: BEDROCK_OCR_CONFIG.maxRetries,
          error: lastError.message,
          errorType: lastError.name,
          isThrottling,
          isTimeout,
          requestId,
        });

        if (attempt < BEDROCK_OCR_CONFIG.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = BEDROCK_OCR_CONFIG.retryDelay * Math.pow(2, attempt - 1);
          logger.debug('Retrying Bedrock invocation after delay', {
            delayMs: delay,
            nextAttempt: attempt + 1,
            requestId,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // ERROR: Final failure after all retries
    logger.error(
      'Bedrock invocation failed after all retries',
      lastError || new Error('Unknown error'),
      {
        retryCount: BEDROCK_OCR_CONFIG.maxRetries,
        finalError: lastError?.message,
        requestId,
      }
    );

    throw new Error(
      `Bedrock OCR reasoning failed after ${BEDROCK_OCR_CONFIG.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Create fallback metadata when Bedrock invocation fails
   */
  private createFallbackMetadata(ocrBlocks: OCRBlock[]): CardMetadata {
    // Extract card name from topmost text block
    const topBlock = ocrBlocks
      .filter((b) => b.boundingBox.top < 0.3)
      .sort((a, b) => a.boundingBox.top - b.boundingBox.top)[0];

    const fallbackConfidence = topBlock ? topBlock.confidence * 0.7 : 0.0; // 30% reduction

    return {
      name: {
        value: topBlock?.text || null,
        confidence: fallbackConfidence,
        rationale: 'Fallback: Using topmost OCR text as card name. AI reasoning unavailable.',
      },
      rarity: {
        value: null,
        confidence: 0.0,
        rationale: 'Fallback: Unable to infer rarity without AI reasoning.',
      },
      set: {
        value: null,
        confidence: 0.0,
        rationale: 'Fallback: Unable to determine set without AI reasoning.',
      },
      setSymbol: {
        value: null,
        confidence: 0.0,
        rationale: 'Fallback: Unable to identify set symbol without AI reasoning.',
      },
      collectorNumber: {
        value: null,
        confidence: 0.0,
        rationale: 'Fallback: Unable to extract collector number without AI reasoning.',
      },
      copyrightRun: {
        value: null,
        confidence: 0.0,
        rationale: 'Fallback: Unable to extract copyright text without AI reasoning.',
      },
      illustrator: {
        value: null,
        confidence: 0.0,
        rationale: 'Fallback: Unable to identify illustrator without AI reasoning.',
      },
      overallConfidence: Math.max(0.0, fallbackConfidence * 0.5),
      reasoningTrail:
        'Fallback mode: Bedrock invocation failed. Using basic OCR extraction only. Manual review recommended.',
      verifiedByAI: false,
    };
  }

  /**
   * Interpret OCR results and extract card metadata
   * Main entry point for OCR reasoning
   */
  async interpretOcr(context: OcrContext, requestId?: string): Promise<CardMetadata> {
    // INFO: OCR reasoning start with OCR block count
    logger.info('Bedrock OCR reasoning service invoked', {
      ocrBlockCount: context.ocrBlocks.length,
      holoVariance: context.visualContext.holoVariance,
      borderSymmetry: context.visualContext.borderSymmetry,
      requestId,
    });

    // Handle empty OCR results
    if (context.ocrBlocks.length === 0) {
      logger.warn('No OCR blocks provided for reasoning', { requestId });
      return {
        name: {
          value: null,
          confidence: 0.0,
          rationale: 'No OCR text detected in image.',
        },
        rarity: {
          value: null,
          confidence: 0.0,
          rationale: 'No OCR text detected in image.',
        },
        set: {
          value: null,
          confidence: 0.0,
          rationale: 'No OCR text detected in image.',
        },
        setSymbol: {
          value: null,
          confidence: 0.0,
          rationale: 'No OCR text detected in image.',
        },
        collectorNumber: {
          value: null,
          confidence: 0.0,
          rationale: 'No OCR text detected in image.',
        },
        copyrightRun: {
          value: null,
          confidence: 0.0,
          rationale: 'No OCR text detected in image.',
        },
        illustrator: {
          value: null,
          confidence: 0.0,
          rationale: 'No OCR text detected in image.',
        },
        overallConfidence: 0.0,
        reasoningTrail: 'No OCR text detected in image. Unable to extract metadata.',
        verifiedByAI: false,
      };
    }

    try {
      const startTime = Date.now();

      const systemPrompt = this.createSystemPrompt();
      const userPrompt = this.createUserPrompt(context);

      // DEBUG: Prompt generation with prompt lengths
      logger.debug('Bedrock prompts generated', {
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
        totalPromptLength: systemPrompt.length + userPrompt.length,
        requestId,
      });

      const input: ConverseCommandInput = {
        modelId: BEDROCK_OCR_CONFIG.modelId,
        messages: [
          {
            role: 'user',
            content: [
              {
                text: userPrompt,
              },
            ],
          },
        ],
        system: [
          {
            text: systemPrompt,
          },
        ],
        inferenceConfig: {
          maxTokens: BEDROCK_OCR_CONFIG.maxTokens,
          temperature: BEDROCK_OCR_CONFIG.temperature,
        },
      };

      const response = await this.invokeWithRetry(input, requestId);
      const latency = Date.now() - startTime;

      // Extract response text
      const responseText = response.output?.message?.content?.[0]?.text;
      if (!responseText) {
        throw new Error('Empty response from Bedrock');
      }

      logger.debug('Bedrock response received', {
        responseLength: responseText.length,
        latency,
        requestId,
      });

      // Parse and validate response
      const metadata = this.parseResponse(responseText, requestId);

      // Record metrics
      const inputTokens = response.usage?.inputTokens || 0;
      const outputTokens = response.usage?.outputTokens || 0;
      await metrics.recordBedrockInvocation('ocr_reasoning', latency, outputTokens);

      // INFO: Bedrock response with latency, token count, and confidence
      logger.info('Bedrock OCR reasoning successful', {
        overallConfidence: metadata.overallConfidence,
        cardName: metadata.name.value,
        latency,
        inputTokens,
        outputTokens,
        verifiedByAI: true,
        requestId,
      });

      return {
        ...metadata,
        verifiedByAI: true,
      };
    } catch (error) {
      // ERROR: Failures with full error details
      logger.error(
        'Bedrock OCR reasoning failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          ocrBlockCount: context.ocrBlocks.length,
          requestId,
        }
      );

      // WARN: Fallback activation with error reason
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Activating fallback OCR metadata', {
        reason: errorMessage,
        ocrBlockCount: context.ocrBlocks.length,
        requestId,
      });

      return this.createFallbackMetadata(context.ocrBlocks);
    }
  }
}

// Export singleton instance
export const bedrockOcrReasoningService = new BedrockOcrReasoningService();
