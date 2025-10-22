/**
 * Bedrock OCR Reasoning Service Tests
 * Tests for OCR interpretation and card metadata extraction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BedrockOcrReasoningService } from '../adapters/bedrock-ocr-reasoning.js';
import type { OCRBlock } from '@collectiq/shared';
import type { OcrContext, CardMetadata } from '../adapters/bedrock-ocr-reasoning.js';

// Mock AWS SDK
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  ConverseCommand: vi.fn(),
}));

// Mock utilities
vi.mock('../utils/index.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  metrics: {
    recordBedrockInvocation: vi.fn(),
  },
  tracing: {
    captureAWSv3Client: vi.fn((client) => client),
    trace: vi.fn((name, fn) => fn()),
  },
}));

describe('BedrockOcrReasoningService', () => {
  let service: BedrockOcrReasoningService;

  beforeEach(() => {
    service = new BedrockOcrReasoningService();
    vi.clearAllMocks();
  });

  describe('createSystemPrompt', () => {
    it('should include Pokémon TCG expert role definition', () => {
      const prompt = (service as any).createSystemPrompt();
      expect(prompt).toContain('Pokémon Trading Card Game');
      expect(prompt).toContain('expert');
      expect(prompt).toContain('OCR');
    });

    it('should include fuzzy matching instructions', () => {
      const prompt = (service as any).createSystemPrompt();
      expect(prompt).toContain('fuzzy matching');
      expect(prompt).toContain('OCR errors');
    });

    it('should include JSON output schema', () => {
      const prompt = (service as any).createSystemPrompt();
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('name');
      expect(prompt).toContain('rarity');
      expect(prompt).toContain('set');
      expect(prompt).toContain('confidence');
      expect(prompt).toContain('rationale');
    });

    it('should include confidence scoring guidelines', () => {
      const prompt = (service as any).createSystemPrompt();
      expect(prompt).toContain('0.9-1.0');
      expect(prompt).toContain('0.7-0.9');
      expect(prompt).toContain('0.5-0.7');
      expect(prompt).toContain('0.3-0.5');
      expect(prompt).toContain('0.0-0.3');
    });

    it('should emphasize context-only processing', () => {
      const prompt = (service as any).createSystemPrompt();
      expect(prompt).toContain('ONLY');
      expect(prompt).toContain('Do NOT make external API calls');
    });

    it('should request rationales for all fields', () => {
      const prompt = (service as any).createSystemPrompt();
      expect(prompt).toContain('rationale');
      expect(prompt).toContain('explain');
    });
  });

  describe('createUserPrompt', () => {
    const mockOcrBlocks: OCRBlock[] = [
      {
        text: 'Pikachu',
        confidence: 0.95,
        boundingBox: { top: 0.1, left: 0.2, width: 0.3, height: 0.05 },
        type: 'LINE',
      },
      {
        text: 'HP 60',
        confidence: 0.98,
        boundingBox: { top: 0.12, left: 0.7, width: 0.15, height: 0.04 },
        type: 'LINE',
      },
      {
        text: 'Thunder Shock 30',
        confidence: 0.92,
        boundingBox: { top: 0.5, left: 0.1, width: 0.4, height: 0.05 },
        type: 'LINE',
      },
      {
        text: '©1999 Nintendo',
        confidence: 0.88,
        boundingBox: { top: 0.92, left: 0.1, width: 0.3, height: 0.03 },
        type: 'LINE',
      },
    ];

    const mockContext: OcrContext = {
      ocrBlocks: mockOcrBlocks,
      visualContext: {
        holoVariance: 0.65,
        borderSymmetry: 0.92,
        imageQuality: {
          blurScore: 0.85,
          glareDetected: false,
        },
      },
    };

    it('should format OCR blocks by region', () => {
      const prompt = (service as any).createUserPrompt(mockContext);
      expect(prompt).toContain('Top Region');
      expect(prompt).toContain('Middle Region');
      expect(prompt).toContain('Bottom Region');
    });

    it('should include OCR text and confidence scores', () => {
      const prompt = (service as any).createUserPrompt(mockContext);
      expect(prompt).toContain('Pikachu');
      expect(prompt).toContain('95.0%');
      expect(prompt).toContain('Thunder Shock 30');
      expect(prompt).toContain('©1999 Nintendo');
    });

    it('should include visual context data', () => {
      const prompt = (service as any).createUserPrompt(mockContext);
      expect(prompt).toContain('Holographic Variance');
      expect(prompt).toContain('65.0%');
      expect(prompt).toContain('Border Symmetry');
      expect(prompt).toContain('92.0%');
      expect(prompt).toContain('Image Blur Score');
      expect(prompt).toContain('85.0%');
      expect(prompt).toContain('Glare Detected: No');
    });

    it('should include card hints when provided', () => {
      const contextWithHints: OcrContext = {
        ...mockContext,
        cardHints: {
          expectedSet: 'Base Set',
          expectedRarity: 'Rare Holo',
        },
      };

      const prompt = (service as any).createUserPrompt(contextWithHints);
      expect(prompt).toContain('Hints');
      expect(prompt).toContain('Base Set');
      expect(prompt).toContain('Rare Holo');
    });

    it('should handle empty OCR blocks gracefully', () => {
      const emptyContext: OcrContext = {
        ocrBlocks: [],
        visualContext: mockContext.visualContext,
      };

      const prompt = (service as any).createUserPrompt(emptyContext);
      expect(prompt).toContain('No text detected');
    });

    it('should include task instructions', () => {
      const prompt = (service as any).createUserPrompt(mockContext);
      expect(prompt).toContain('Your Task');
      expect(prompt).toContain('Identify and correct');
      expect(prompt).toContain('Infer the card rarity');
      expect(prompt).toContain('Determine the card set');
    });
  });

  describe('parseResponse', () => {
    const validMetadata: CardMetadata = {
      name: { value: 'Pikachu', confidence: 0.95, rationale: 'Clear OCR match' },
      rarity: { value: 'Common', confidence: 0.85, rationale: 'No holo pattern' },
      set: { value: 'Base Set', confidence: 0.9, rationale: 'Copyright text match' },
      setSymbol: { value: null, confidence: 0.0, rationale: 'No symbol detected' },
      collectorNumber: { value: '58/102', confidence: 0.92, rationale: 'Clear number format' },
      copyrightRun: {
        value: '©1999 Nintendo',
        confidence: 0.88,
        rationale: 'Bottom text extraction',
      },
      illustrator: { value: 'Ken Sugimori', confidence: 0.9, rationale: 'Standard format' },
      overallConfidence: 0.88,
      reasoningTrail: 'Base Set Pikachu identified from OCR and visual context',
    };

    it('should extract JSON from valid response', () => {
      const response = JSON.stringify(validMetadata);
      const result = (service as any).parseResponse(response);
      expect(result).toEqual(validMetadata);
    });

    it('should extract JSON from markdown code blocks', () => {
      const response = `Here is the analysis:\n\`\`\`json\n${JSON.stringify(validMetadata)}\n\`\`\`\n`;
      const result = (service as any).parseResponse(response);
      expect(result).toEqual(validMetadata);
    });

    it('should extract JSON from response with surrounding text', () => {
      const response = `Analysis complete. ${JSON.stringify(validMetadata)} End of response.`;
      const result = (service as any).parseResponse(response);
      expect(result).toEqual(validMetadata);
    });

    it('should throw error for malformed JSON', () => {
      const response = '{ invalid json }';
      expect(() => (service as any).parseResponse(response)).toThrow();
    });

    it('should throw error when no JSON found', () => {
      const response = 'No JSON in this response';
      expect(() => (service as any).parseResponse(response)).toThrow('No JSON found');
    });

    it('should validate schema and reject invalid confidence scores', () => {
      const invalidMetadata = {
        ...validMetadata,
        name: { value: 'Pikachu', confidence: 1.5, rationale: 'Invalid confidence' },
      };
      const response = JSON.stringify(invalidMetadata);
      expect(() => (service as any).parseResponse(response)).toThrow();
    });

    it('should validate schema and reject missing required fields', () => {
      const incompleteMetadata = {
        name: { value: 'Pikachu', confidence: 0.95, rationale: 'Clear match' },
        // Missing other required fields
      };
      const response = JSON.stringify(incompleteMetadata);
      expect(() => (service as any).parseResponse(response)).toThrow();
    });
  });

  describe('createFallbackMetadata', () => {
    it('should extract name from topmost OCR block', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Charizard',
          confidence: 0.92,
          boundingBox: { top: 0.05, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
        {
          text: 'HP 120',
          confidence: 0.95,
          boundingBox: { top: 0.1, left: 0.7, width: 0.15, height: 0.04 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);
      expect(result.name.value).toBe('Charizard');
      expect(result.verifiedByAI).toBe(false);
    });

    it('should reduce confidence by 30%', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Pikachu',
          confidence: 0.9,
          boundingBox: { top: 0.1, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);
      // Original confidence 0.9, reduced by 30% = 0.9 * 0.7 = 0.63
      expect(result.name.confidence).toBeCloseTo(0.63, 2);
    });

    it('should set all other fields to null with 0.0 confidence', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Pikachu',
          confidence: 0.9,
          boundingBox: { top: 0.1, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);
      expect(result.rarity.value).toBeNull();
      expect(result.rarity.confidence).toBe(0.0);
      expect(result.set.value).toBeNull();
      expect(result.set.confidence).toBe(0.0);
      expect(result.illustrator.value).toBeNull();
      expect(result.illustrator.confidence).toBe(0.0);
    });

    it('should include fallback rationale messages', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Pikachu',
          confidence: 0.9,
          boundingBox: { top: 0.1, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);
      expect(result.name.rationale).toContain('Fallback');
      expect(result.name.rationale).toContain('AI reasoning unavailable');
      expect(result.reasoningTrail).toContain('Fallback mode');
      expect(result.reasoningTrail).toContain('Bedrock invocation failed');
    });

    it('should set verifiedByAI flag to false', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Pikachu',
          confidence: 0.9,
          boundingBox: { top: 0.1, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);
      expect(result.verifiedByAI).toBe(false);
    });

    it('should handle empty OCR blocks', () => {
      const result = (service as any).createFallbackMetadata([]);
      expect(result.name.value).toBeNull();
      expect(result.name.confidence).toBe(0.0);
      expect(result.overallConfidence).toBe(0.0);
    });
  });

  describe('interpretOcr', () => {
    it('should handle empty OCR blocks', async () => {
      const context: OcrContext = {
        ocrBlocks: [],
        visualContext: {
          holoVariance: 0.5,
          borderSymmetry: 0.9,
          imageQuality: {
            blurScore: 0.8,
            glareDetected: false,
          },
        },
      };

      const result = await service.interpretOcr(context);
      expect(result.name.value).toBeNull();
      expect(result.overallConfidence).toBe(0.0);
      expect(result.reasoningTrail).toContain('No OCR text detected');
      expect(result.verifiedByAI).toBe(false);
    });

    it('should return fallback metadata when Bedrock fails', async () => {
      const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
      const mockSend = vi.fn().mockRejectedValue(new Error('Bedrock unavailable'));
      vi.mocked(BedrockRuntimeClient).mockImplementation(
        () =>
          ({
            send: mockSend,
          }) as unknown as InstanceType<typeof BedrockRuntimeClient>
      );

      const context: OcrContext = {
        ocrBlocks: [
          {
            text: 'Pikachu',
            confidence: 0.9,
            boundingBox: { top: 0.1, left: 0.1, width: 0.3, height: 0.05 },
            type: 'LINE',
          },
        ],
        visualContext: {
          holoVariance: 0.5,
          borderSymmetry: 0.9,
          imageQuality: {
            blurScore: 0.8,
            glareDetected: false,
          },
        },
      };

      const result = await service.interpretOcr(context);
      expect(result.verifiedByAI).toBe(false);
      expect(result.name.value).toBe('Pikachu');
      expect(result.reasoningTrail).toContain('Fallback mode');
    });
  });

  describe('Schema Validation', () => {
    it('should validate complete CardMetadata', () => {
      const completeMetadata: CardMetadata = {
        name: { value: 'Charizard', confidence: 0.95, rationale: 'Clear OCR match' },
        rarity: { value: 'Rare Holo', confidence: 0.9, rationale: 'Holographic pattern detected' },
        set: { value: 'Base Set', confidence: 0.92, rationale: 'Copyright text indicates 1999' },
        setSymbol: { value: null, confidence: 0.0, rationale: 'No symbol visible' },
        collectorNumber: {
          value: '4/102',
          confidence: 0.95,
          rationale: 'Clear number format in bottom right',
        },
        copyrightRun: {
          value: '©1995, 96, 98 Nintendo',
          confidence: 0.88,
          rationale: 'Standard WOTC copyright',
        },
        illustrator: {
          value: 'Mitsuhiro Arita',
          confidence: 0.92,
          rationale: 'Standard illustrator format',
        },
        overallConfidence: 0.91,
        reasoningTrail: 'Base Set Charizard identified with high confidence',
      };

      const response = JSON.stringify(completeMetadata);
      const result = (service as any).parseResponse(response);
      expect(result).toEqual(completeMetadata);
    });

    it('should validate partial metadata with missing optional values', () => {
      const partialMetadata = {
        name: { value: 'Pikachu', confidence: 0.85, rationale: 'Partial OCR' },
        rarity: { value: null, confidence: 0.3, rationale: 'Unclear rarity indicators' },
        set: { value: null, confidence: 0.2, rationale: 'Copyright text unclear' },
        setSymbol: { value: null, confidence: 0.0, rationale: 'No symbol detected' },
        collectorNumber: { value: null, confidence: 0.0, rationale: 'Number not visible' },
        copyrightRun: { value: null, confidence: 0.1, rationale: 'Text too blurry' },
        illustrator: { value: null, confidence: 0.0, rationale: 'Not visible' },
        overallConfidence: 0.35,
        reasoningTrail: 'Low confidence extraction due to image quality',
      };

      const response = JSON.stringify(partialMetadata);
      const result = (service as any).parseResponse(response);
      expect(result.name.value).toBe('Pikachu');
      expect(result.rarity.value).toBeNull();
      expect(result.set.value).toBeNull();
    });

    it('should validate multi-candidate field for set', () => {
      const metadataWithCandidates = {
        name: { value: 'Venusaur', confidence: 0.95, rationale: 'Clear name' },
        rarity: { value: 'Rare Holo', confidence: 0.9, rationale: 'Holo pattern' },
        set: {
          value: 'Base Set',
          candidates: [
            { value: 'Base Set', confidence: 0.7 },
            { value: 'Base Set 2', confidence: 0.5 },
          ],
          rationale: 'Ambiguous copyright year, could be Base Set or Base Set 2',
        },
        setSymbol: { value: null, confidence: 0.0, rationale: 'No symbol' },
        collectorNumber: { value: '15/102', confidence: 0.92, rationale: 'Clear number' },
        copyrightRun: { value: '©1999 Nintendo', confidence: 0.85, rationale: 'Standard format' },
        illustrator: { value: 'Ken Sugimori', confidence: 0.9, rationale: 'Standard format' },
        overallConfidence: 0.83,
        reasoningTrail: 'Set identification has some ambiguity',
      };

      const response = JSON.stringify(metadataWithCandidates);
      const result = (service as any).parseResponse(response);
      expect(result.set.value).toBe('Base Set');
      expect((result.set as any).candidates).toHaveLength(2);
      expect((result.set as any).candidates[0].value).toBe('Base Set');
    });

    it('should reject confidence scores outside 0.0-1.0 range', () => {
      const invalidMetadata = {
        name: { value: 'Pikachu', confidence: 1.5, rationale: 'Invalid confidence' },
        rarity: { value: 'Common', confidence: 0.8, rationale: 'Valid' },
        set: { value: 'Base Set', confidence: 0.9, rationale: 'Valid' },
        setSymbol: { value: null, confidence: 0.0, rationale: 'Valid' },
        collectorNumber: { value: null, confidence: 0.0, rationale: 'Valid' },
        copyrightRun: { value: null, confidence: 0.0, rationale: 'Valid' },
        illustrator: { value: null, confidence: 0.0, rationale: 'Valid' },
        overallConfidence: 0.8,
        reasoningTrail: 'Test',
      };

      const response = JSON.stringify(invalidMetadata);
      expect(() => (service as any).parseResponse(response)).toThrow();
    });

    it('should reject negative confidence scores', () => {
      const invalidMetadata = {
        name: { value: 'Pikachu', confidence: -0.1, rationale: 'Invalid confidence' },
        rarity: { value: 'Common', confidence: 0.8, rationale: 'Valid' },
        set: { value: 'Base Set', confidence: 0.9, rationale: 'Valid' },
        setSymbol: { value: null, confidence: 0.0, rationale: 'Valid' },
        collectorNumber: { value: null, confidence: 0.0, rationale: 'Valid' },
        copyrightRun: { value: null, confidence: 0.0, rationale: 'Valid' },
        illustrator: { value: null, confidence: 0.0, rationale: 'Valid' },
        overallConfidence: 0.8,
        reasoningTrail: 'Test',
      };

      const response = JSON.stringify(invalidMetadata);
      expect(() => (service as any).parseResponse(response)).toThrow();
    });

    it('should reject missing required fields', () => {
      const incompleteMetadata = {
        name: { value: 'Pikachu', confidence: 0.95, rationale: 'Clear match' },
        rarity: { value: 'Common', confidence: 0.85, rationale: 'No holo' },
        // Missing other required fields
      };

      const response = JSON.stringify(incompleteMetadata);
      expect(() => (service as any).parseResponse(response)).toThrow();
    });

    it('should reject fields missing rationale', () => {
      const invalidMetadata = {
        name: { value: 'Pikachu', confidence: 0.95 }, // Missing rationale
        rarity: { value: 'Common', confidence: 0.85, rationale: 'No holo' },
        set: { value: 'Base Set', confidence: 0.9, rationale: 'Copyright match' },
        setSymbol: { value: null, confidence: 0.0, rationale: 'No symbol' },
        collectorNumber: { value: null, confidence: 0.0, rationale: 'Not visible' },
        copyrightRun: { value: null, confidence: 0.0, rationale: 'Not visible' },
        illustrator: { value: null, confidence: 0.0, rationale: 'Not visible' },
        overallConfidence: 0.8,
        reasoningTrail: 'Test',
      };

      const response = JSON.stringify(invalidMetadata);
      expect(() => (service as any).parseResponse(response)).toThrow();
    });

    it('should accept confidence scores at boundary values', () => {
      const boundaryMetadata = {
        name: { value: 'Pikachu', confidence: 0.0, rationale: 'Minimum confidence' },
        rarity: { value: 'Common', confidence: 1.0, rationale: 'Maximum confidence' },
        set: { value: 'Base Set', confidence: 0.5, rationale: 'Mid confidence' },
        setSymbol: { value: null, confidence: 0.0, rationale: 'No symbol' },
        collectorNumber: { value: null, confidence: 0.0, rationale: 'Not visible' },
        copyrightRun: { value: null, confidence: 0.0, rationale: 'Not visible' },
        illustrator: { value: null, confidence: 0.0, rationale: 'Not visible' },
        overallConfidence: 0.5,
        reasoningTrail: 'Boundary test',
      };

      const response = JSON.stringify(boundaryMetadata);
      const result = (service as any).parseResponse(response);
      expect(result.name.confidence).toBe(0.0);
      expect(result.rarity.confidence).toBe(1.0);
    });

    it('should validate multi-candidate confidence scores', () => {
      const metadataWithCandidates = {
        name: { value: 'Venusaur', confidence: 0.95, rationale: 'Clear name' },
        rarity: { value: 'Rare Holo', confidence: 0.9, rationale: 'Holo pattern' },
        set: {
          value: 'Base Set',
          candidates: [
            { value: 'Base Set', confidence: 0.7 },
            { value: 'Base Set 2', confidence: 1.5 }, // Invalid confidence
          ],
          rationale: 'Ambiguous set',
        },
        setSymbol: { value: null, confidence: 0.0, rationale: 'No symbol' },
        collectorNumber: { value: null, confidence: 0.0, rationale: 'Not visible' },
        copyrightRun: { value: null, confidence: 0.0, rationale: 'Not visible' },
        illustrator: { value: null, confidence: 0.0, rationale: 'Not visible' },
        overallConfidence: 0.8,
        reasoningTrail: 'Test',
      };

      const response = JSON.stringify(metadataWithCandidates);
      expect(() => (service as any).parseResponse(response)).toThrow();
    });
  });

  describe('Fallback Logic', () => {
    it('should create fallback metadata with empty OCR blocks', () => {
      const result = (service as any).createFallbackMetadata([]);

      expect(result.name.value).toBeNull();
      expect(result.name.confidence).toBe(0.0);
      expect(result.rarity.value).toBeNull();
      expect(result.set.value).toBeNull();
      expect(result.overallConfidence).toBe(0.0);
      expect(result.verifiedByAI).toBe(false);
    });

    it('should create fallback metadata with valid OCR blocks', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Charizard',
          confidence: 0.95,
          boundingBox: { top: 0.08, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
        {
          text: 'HP 120',
          confidence: 0.98,
          boundingBox: { top: 0.12, left: 0.7, width: 0.15, height: 0.04 },
          type: 'LINE',
        },
        {
          text: '©1999 Nintendo',
          confidence: 0.88,
          boundingBox: { top: 0.92, left: 0.1, width: 0.3, height: 0.03 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);

      expect(result.name.value).toBe('Charizard');
      expect(result.name.confidence).toBeGreaterThan(0);
      expect(result.verifiedByAI).toBe(false);
    });

    it('should reduce confidence score by 30%', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Pikachu',
          confidence: 1.0,
          boundingBox: { top: 0.1, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);

      // Original confidence 1.0, reduced by 30% = 1.0 * 0.7 = 0.7
      expect(result.name.confidence).toBeCloseTo(0.7, 2);
    });

    it('should reduce confidence score by 30% for various values', () => {
      const testCases = [
        { original: 0.9, expected: 0.63 },
        { original: 0.8, expected: 0.56 },
        { original: 0.5, expected: 0.35 },
      ];

      testCases.forEach(({ original, expected }) => {
        const ocrBlocks: OCRBlock[] = [
          {
            text: 'TestCard',
            confidence: original,
            boundingBox: { top: 0.1, left: 0.1, width: 0.3, height: 0.05 },
            type: 'LINE',
          },
        ];

        const result = (service as any).createFallbackMetadata(ocrBlocks);
        expect(result.name.confidence).toBeCloseTo(expected, 2);
      });
    });

    it('should include fallback rationale in name field', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Blastoise',
          confidence: 0.9,
          boundingBox: { top: 0.1, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);

      expect(result.name.rationale).toContain('Fallback');
      expect(result.name.rationale).toContain('AI reasoning unavailable');
    });

    it('should include fallback rationale in all null fields', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Venusaur',
          confidence: 0.9,
          boundingBox: { top: 0.1, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);

      expect(result.rarity.rationale).toContain('Fallback');
      expect(result.set.rationale).toContain('Fallback');
      expect(result.setSymbol.rationale).toContain('Fallback');
      expect(result.collectorNumber.rationale).toContain('Fallback');
      expect(result.copyrightRun.rationale).toContain('Fallback');
      expect(result.illustrator.rationale).toContain('Fallback');
    });

    it('should include fallback message in reasoningTrail', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Mewtwo',
          confidence: 0.9,
          boundingBox: { top: 0.1, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);

      expect(result.reasoningTrail).toContain('Fallback mode');
      expect(result.reasoningTrail).toContain('Bedrock invocation failed');
    });

    it('should set verifiedByAI flag to false', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Mew',
          confidence: 0.9,
          boundingBox: { top: 0.1, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);

      expect(result.verifiedByAI).toBe(false);
    });

    it('should select topmost block from multiple blocks', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'HP 100',
          confidence: 0.98,
          boundingBox: { top: 0.15, left: 0.7, width: 0.15, height: 0.04 },
          type: 'LINE',
        },
        {
          text: 'Raichu',
          confidence: 0.92,
          boundingBox: { top: 0.05, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
        {
          text: '©1999 Nintendo',
          confidence: 0.88,
          boundingBox: { top: 0.92, left: 0.1, width: 0.3, height: 0.03 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);

      // Should select 'Raichu' as it has the lowest top value (0.05)
      expect(result.name.value).toBe('Raichu');
    });

    it('should filter blocks by top region before selecting topmost', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Bottom Text',
          confidence: 0.95,
          boundingBox: { top: 0.85, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
        {
          text: 'Jigglypuff',
          confidence: 0.92,
          boundingBox: { top: 0.12, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);

      // Should select 'Jigglypuff' from top region (< 0.3), not 'Bottom Text'
      expect(result.name.value).toBe('Jigglypuff');
    });

    it('should handle blocks with no top region text', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Middle Text',
          confidence: 0.9,
          boundingBox: { top: 0.5, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
        {
          text: 'Bottom Text',
          confidence: 0.88,
          boundingBox: { top: 0.9, left: 0.1, width: 0.3, height: 0.03 },
          type: 'LINE',
        },
      ];

      const result = (service as any).createFallbackMetadata(ocrBlocks);

      // No blocks in top region (< 0.3), should return null
      expect(result.name.value).toBeNull();
      expect(result.name.confidence).toBe(0.0);
    });

    it('should calculate overall confidence based on name confidence', () => {
      const ocrBlocks: OCRBlock[] = [
        {
          text: 'Snorlax',
          confidence: 0.8,
          boundingBox: { top: 0.1, left: 0.1, width: 0.3, height: 0.05 },
          type: 'LINE',
        },
      ];

      const result = (service as unknown).createFallbackMetadata(ocrBlocks);

      // Name confidence: 0.8 * 0.7 = 0.56
      // Overall confidence: 0.56 * 0.5 = 0.28
      const expectedOverall = 0.8 * 0.7 * 0.5;
      expect(result.overallConfidence).toBeCloseTo(expectedOverall, 2);
    });
  });
});
