/**
 * Adapters module exports
 */

// Pricing adapters
export type { PriceSource } from './base-price-adapter.js';
export { BasePriceAdapter } from './base-price-adapter.js';
export { EbayAdapter } from './ebay-adapter.js';
export { TCGPlayerAdapter } from './tcgplayer-adapter.js';
export { PriceChartingAdapter } from './pricecharting-adapter.js';
export { PricingService } from './pricing-service.js';
export { PricingOrchestrator, getPricingOrchestrator } from './pricing-orchestrator.js';

// Rekognition adapter
export { RekognitionAdapter, rekognitionAdapter } from './rekognition-adapter.js';

// Bedrock service
export { BedrockService, bedrockService } from './bedrock-service.js';

// Bedrock OCR reasoning service
export {
  BedrockOcrReasoningService,
  bedrockOcrReasoningService,
  type CardMetadata,
  type FieldResult,
  type MultiCandidateResult,
  type OcrContext,
} from './bedrock-ocr-reasoning.js';
