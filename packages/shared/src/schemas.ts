/**
 * Shared Zod schemas for CollectIQ
 * These schemas are used for validation across frontend and backend
 */

import { z } from 'zod';

// ============================================================================
// Authentication Schemas
// ============================================================================

export const AuthContextSchema = z.object({
  sub: z.string().describe('Cognito user ID'),
  email: z.string().email().optional(),
  username: z.string().optional(),
  groups: z.array(z.string()).optional(),
  iat: z.number(),
  exp: z.number(),
});

export type AuthContext = z.infer<typeof AuthContextSchema>;

// ============================================================================
// Upload Schemas
// ============================================================================

export const PresignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^image\/(jpeg|png|heic)$/),
  sizeBytes: z
    .number()
    .positive()
    .max(12 * 1024 * 1024), // 12MB max
});

export type PresignRequest = z.infer<typeof PresignRequestSchema>;

export const PresignResponseSchema = z.object({
  uploadUrl: z.string().url(),
  key: z.string(),
  expiresIn: z.number(),
});

export type PresignResponse = z.infer<typeof PresignResponseSchema>;

// ============================================================================
// Card Schemas
// ============================================================================

/**
 * Card identification candidate
 */
export const CandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  set: z.string(),
  rarity: z.string(),
  confidence: z.number().min(0).max(1),
  imageUrl: z.string().url().optional(),
  number: z.string().optional(),
});

export type Candidate = z.infer<typeof CandidateSchema>;

export const IdentificationResultSchema = z.object({
  candidates: z.array(CandidateSchema),
  processingTime: z.number().optional(),
});

export type IdentificationResult = z.infer<typeof IdentificationResultSchema>;

export const AuthenticitySignalsSchema = z.object({
  visualHashConfidence: z.number().min(0).max(1),
  textMatchConfidence: z.number().min(0).max(1),
  holoPatternConfidence: z.number().min(0).max(1),
  borderConsistency: z.number().min(0).max(1),
  fontValidation: z.number().min(0).max(1),
});

export type AuthenticitySignals = z.infer<typeof AuthenticitySignalsSchema>;

/**
 * Authenticity details for frontend display
 */
export const AuthenticityDetailsSchema = z.object({
  visualHashConfidence: z.number().min(0).max(1),
  textMatchConfidence: z.number().min(0).max(1),
  holoPatternConfidence: z.number().min(0).max(1),
  rationale: z.string(),
  fakeDetected: z.boolean(),
});

export type AuthenticityDetails = z.infer<typeof AuthenticityDetailsSchema>;

export const CardSchema = z.object({
  cardId: z.string().uuid(),
  userId: z.string(),
  name: z.string().optional(),
  set: z.string().optional(),
  number: z.string().optional(),
  rarity: z.string().optional(),
  conditionEstimate: z.string().optional(),
  frontS3Key: z.string(),
  backS3Key: z.string().optional(),
  idConfidence: z.number().min(0).max(1).optional(),
  authenticityScore: z.number().min(0).max(1).optional(),
  authenticitySignals: AuthenticitySignalsSchema.optional(),
  valueLow: z.number().optional(),
  valueMedian: z.number().optional(),
  valueHigh: z.number().optional(),
  compsCount: z.number().optional(),
  sources: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Card = z.infer<typeof CardSchema>;

export const CreateCardRequestSchema = z.object({
  frontS3Key: z.string(),
  backS3Key: z.string().optional(),
  name: z.string().optional(),
  set: z.string().optional(),
  number: z.string().optional(),
  rarity: z.string().optional(),
  conditionEstimate: z.string().optional(),
});

export type CreateCardRequest = z.infer<typeof CreateCardRequestSchema>;

export const UpdateCardRequestSchema = z.object({
  name: z.string().optional(),
  set: z.string().optional(),
  number: z.string().optional(),
  rarity: z.string().optional(),
  conditionEstimate: z.string().optional(),
});

export type UpdateCardRequest = z.infer<typeof UpdateCardRequestSchema>;

export const ListCardsResponseSchema = z.object({
  items: z.array(CardSchema),
  nextCursor: z.string().optional(),
});

export type ListCardsResponse = z.infer<typeof ListCardsResponseSchema>;

// ============================================================================
// Pricing Schemas
// ============================================================================

export const PricingResultSchema = z.object({
  valueLow: z.number(),
  valueMedian: z.number(),
  valueHigh: z.number(),
  compsCount: z.number(),
  windowDays: z.number(),
  sources: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  volatility: z.number(),
});

export type PricingResult = z.infer<typeof PricingResultSchema>;

/**
 * Valuation data for frontend display
 */
export const ValuationDataSchema = z.object({
  low: z.number(),
  median: z.number(),
  high: z.number(),
  trend: z.object({
    direction: z.enum(['up', 'down', 'stable']),
    percentage: z.number(),
  }),
  confidence: z.number().min(0).max(1),
  compsCount: z.number(),
  windowDays: z.number(),
  sources: z.array(
    z.object({
      name: z.string(),
      logo: z.string(),
    }),
  ),
  lastUpdated: z.string(),
});

export type ValuationData = z.infer<typeof ValuationDataSchema>;

export const RawCompSchema = z.object({
  source: z.string(),
  price: z.number(),
  currency: z.string(),
  condition: z.string(),
  soldDate: z.string().datetime(),
  listingUrl: z.string().url().optional(),
});

export type RawComp = z.infer<typeof RawCompSchema>;

export const PriceQuerySchema = z.object({
  cardName: z.string(),
  set: z.string().optional(),
  number: z.string().optional(),
  condition: z.string().optional(),
  windowDays: z.number().default(14),
});

export type PriceQuery = z.infer<typeof PriceQuerySchema>;

// ============================================================================
// Feature Extraction Schemas
// ============================================================================

export const BoundingBoxSchema = z.object({
  left: z.number(),
  top: z.number(),
  width: z.number(),
  height: z.number(),
});

export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const OCRBlockSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1),
  boundingBox: BoundingBoxSchema,
  type: z.enum(['LINE', 'WORD']),
});

export type OCRBlock = z.infer<typeof OCRBlockSchema>;

export const BorderMetricsSchema = z.object({
  topRatio: z.number(),
  bottomRatio: z.number(),
  leftRatio: z.number(),
  rightRatio: z.number(),
  symmetryScore: z.number().min(0).max(1),
});

export type BorderMetrics = z.infer<typeof BorderMetricsSchema>;

export const FontMetricsSchema = z.object({
  kerning: z.array(z.number()),
  alignment: z.number().min(0).max(1),
  fontSizeVariance: z.number(),
});

export type FontMetrics = z.infer<typeof FontMetricsSchema>;

export const ImageQualitySchema = z.object({
  blurScore: z.number().min(0).max(1),
  glareDetected: z.boolean(),
  brightness: z.number(),
});

export type ImageQuality = z.infer<typeof ImageQualitySchema>;

export const ImageMetadataSchema = z.object({
  width: z.number(),
  height: z.number(),
  format: z.string(),
  sizeBytes: z.number(),
});

export type ImageMetadata = z.infer<typeof ImageMetadataSchema>;

export const FeatureEnvelopeSchema = z.object({
  ocr: z.array(OCRBlockSchema),
  borders: BorderMetricsSchema,
  holoVariance: z.number(),
  fontMetrics: FontMetricsSchema,
  quality: ImageQualitySchema,
  imageMeta: ImageMetadataSchema,
});

export type FeatureEnvelope = z.infer<typeof FeatureEnvelopeSchema>;

// ============================================================================
// AI Agent Schemas
// ============================================================================

export const AuthenticityResultSchema = z.object({
  authenticityScore: z.number().min(0).max(1),
  fakeDetected: z.boolean(),
  rationale: z.string(),
  signals: AuthenticitySignalsSchema,
  verifiedByAI: z.boolean(),
});

export type AuthenticityResult = z.infer<typeof AuthenticityResultSchema>;

export const ValuationSummarySchema = z.object({
  summary: z.string(),
  fairValue: z.number(),
  trend: z.enum(['rising', 'falling', 'stable']),
  recommendation: z.string(),
  confidence: z.number().min(0).max(1),
});

export type ValuationSummary = z.infer<typeof ValuationSummarySchema>;

// ============================================================================
// Revaluation Schemas
// ============================================================================

export const RevalueRequestSchema = z.object({
  cardId: z.string().uuid(),
  forceRefresh: z.boolean().optional().default(false),
});

export type RevalueRequest = z.infer<typeof RevalueRequestSchema>;

export const RevalueResponseSchema = z.object({
  executionArn: z.string(),
  status: z.literal('RUNNING'),
  message: z.string(),
});

export type RevalueResponse = z.infer<typeof RevalueResponseSchema>;

// ============================================================================
// Error Schemas (RFC 7807 ProblemDetails)
// ============================================================================

export const ProblemDetailsSchema = z.object({
  type: z.string().describe('URI reference identifying the problem type'),
  title: z.string().describe('Short, human-readable summary'),
  status: z.number().describe('HTTP status code'),
  detail: z.string().describe('Human-readable explanation'),
  instance: z.string().optional().describe('URI reference to specific occurrence'),
  requestId: z.string().optional().describe('Request ID for traceability'),
});

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
