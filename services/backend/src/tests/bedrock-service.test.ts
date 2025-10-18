/**
 * Bedrock Service Tests
 * Tests for AWS Bedrock integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BedrockService } from '../adapters/bedrock-service.js';
import type { AuthenticitySignals, FeatureEnvelope, PricingResult } from '@collectiq/shared';

// Mock AWS SDK
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  ConverseCommand: vi.fn(),
}));

describe('BedrockService', () => {
  let bedrockService: BedrockService;

  beforeEach(() => {
    bedrockService = new BedrockService();
    vi.clearAllMocks();
  });

  describe('Class Structure', () => {
    it('should have invokeAuthenticity method', () => {
      expect(bedrockService.invokeAuthenticity).toBeDefined();
      expect(typeof bedrockService.invokeAuthenticity).toBe('function');
    });

    it('should have invokeValuation method', () => {
      expect(bedrockService.invokeValuation).toBeDefined();
      expect(typeof bedrockService.invokeValuation).toBe('function');
    });
  });

  describe('Fallback Handling', () => {
    it('should return fallback authenticity result when Bedrock fails', async () => {
      // Mock Bedrock client to throw error
      const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
      const mockSend = vi.fn().mockRejectedValue(new Error('Bedrock unavailable'));
      vi.mocked(BedrockRuntimeClient).mockImplementation(
        () =>
          ({
            send: mockSend,
          }) as unknown as InstanceType<typeof BedrockRuntimeClient>,
      );

      const mockSignals: AuthenticitySignals = {
        visualHashConfidence: 0.9,
        textMatchConfidence: 0.85,
        holoPatternConfidence: 0.8,
        borderConsistency: 0.95,
        fontValidation: 0.88,
      };

      const mockFeatures: FeatureEnvelope = {
        ocr: [],
        borders: {
          topRatio: 0.1,
          bottomRatio: 0.1,
          leftRatio: 0.05,
          rightRatio: 0.05,
          symmetryScore: 0.95,
        },
        holoVariance: 0.5,
        fontMetrics: {
          kerning: [1, 2, 3],
          alignment: 0.9,
          fontSizeVariance: 0.1,
        },
        quality: {
          blurScore: 0.8,
          glareDetected: false,
          brightness: 0.7,
        },
        imageMeta: {
          width: 1000,
          height: 1400,
          format: 'jpeg',
          sizeBytes: 500000,
        },
      };

      const context = {
        features: mockFeatures,
        signals: mockSignals,
        cardMeta: {
          name: 'Charizard',
          set: 'Base Set',
          rarity: 'Rare Holo',
        },
      };

      const result = await bedrockService.invokeAuthenticity(context);

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.verifiedByAI).toBe(false);
      expect(result.signals).toEqual(mockSignals);
      expect(result.rationale).toContain('AI analysis unavailable');
      expect(typeof result.authenticityScore).toBe('number');
      expect(result.authenticityScore).toBeGreaterThanOrEqual(0);
      expect(result.authenticityScore).toBeLessThanOrEqual(1);
    });

    it('should return fallback valuation result when Bedrock fails', async () => {
      // Mock Bedrock client to throw error
      const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
      const mockSend = vi.fn().mockRejectedValue(new Error('Bedrock unavailable'));
      vi.mocked(BedrockRuntimeClient).mockImplementation(
        () =>
          ({
            send: mockSend,
          }) as unknown as InstanceType<typeof BedrockRuntimeClient>,
      );

      const mockPricingResult: PricingResult = {
        valueLow: 100,
        valueMedian: 150,
        valueHigh: 200,
        compsCount: 25,
        windowDays: 14,
        sources: ['eBay', 'TCGPlayer'],
        confidence: 0.85,
        volatility: 0.15,
      };

      const context = {
        cardName: 'Charizard',
        set: 'Base Set',
        condition: 'Near Mint',
        pricingResult: mockPricingResult,
      };

      const result = await bedrockService.invokeValuation(context);

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.summary).toContain('AI analysis unavailable');
      expect(result.fairValue).toBe(mockPricingResult.valueMedian);
      expect(result.trend).toBe('stable');
      expect(result.confidence).toBeLessThan(mockPricingResult.confidence);
    });
  });
});
