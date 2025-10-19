import { z } from 'zod';

// -----------------------------------------------------------------------------
// Problem Details (RFC 7807)
// -----------------------------------------------------------------------------

export const ProblemDetailsSchema = z.object({
  type: z.string().default('about:blank'),
  title: z.string().default('Request Failed'),
  status: z.number(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  requestId: z.string().optional(),
});

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

// -----------------------------------------------------------------------------
// File Upload Presigning
// -----------------------------------------------------------------------------

export const PresignRequestSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export type PresignRequest = z.infer<typeof PresignRequestSchema>;

export const PresignResponseSchema = z.object({
  uploadUrl: z.string().url(),
  key: z.string().min(1),
  expiresIn: z.number().int().positive(),
});

export type PresignResponse = z.infer<typeof PresignResponseSchema>;

// -----------------------------------------------------------------------------
// Card Types
// -----------------------------------------------------------------------------

const AuthenticitySignalsSchema = z.object({
  visualHashConfidence: z.number().min(0).max(1).optional().nullable(),
  textMatchConfidence: z.number().min(0).max(1).optional().nullable(),
  holoPatternConfidence: z.number().min(0).max(1).optional().nullable(),
});

export type AuthenticitySignals = z.infer<typeof AuthenticitySignalsSchema>;

export const CardSchema = z.object({
  cardId: z.string().uuid(),
  userId: z.string(),
  frontS3Key: z.string().min(1),
  backS3Key: z.string().min(1).optional().nullable(),
  name: z.string().optional().nullable(),
  set: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  rarity: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  authenticityScore: z.number().min(0).max(1).optional().nullable(),
  authenticitySignals: AuthenticitySignalsSchema.optional().nullable(),
  valueLow: z.number().optional().nullable(),
  valueMedian: z.number().optional().nullable(),
  valueHigh: z.number().optional().nullable(),
  conditionEstimate: z.string().optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Card = z.infer<typeof CardSchema>;

export const ListCardsResponseSchema = z.object({
  items: z.array(CardSchema),
  nextCursor: z.string().optional().nullable(),
});

export type ListCardsResponse = z.infer<typeof ListCardsResponseSchema>;

export const CreateCardRequestSchema = z.object({
  frontS3Key: z.string().min(1),
  backS3Key: z.string().min(1).optional(),
  name: z.string().optional(),
  set: z.string().optional(),
  number: z.string().optional(),
  rarity: z.string().optional(),
  type: z.string().optional(),
  conditionEstimate: z.string().optional(),
  authenticityScore: z.number().min(0).max(1).optional(),
  authenticitySignals: AuthenticitySignalsSchema.optional(),
  valueLow: z.number().optional(),
  valueMedian: z.number().optional(),
  valueHigh: z.number().optional(),
});

export type CreateCardRequest = z.infer<typeof CreateCardRequestSchema>;

// -----------------------------------------------------------------------------
// Card Identification & Authenticity
// -----------------------------------------------------------------------------

export const CandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  set: z.string().nullable().optional(),
  number: z.string().nullable().optional(),
  rarity: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  imageUrl: z.string().url().nullable().optional(),
});

export type Candidate = z.infer<typeof CandidateSchema>;

export const AuthenticityDetailsSchema = z.object({
  visualHashConfidence: z.number().min(0).max(1).optional(),
  textMatchConfidence: z.number().min(0).max(1).optional(),
  holoPatternConfidence: z.number().min(0).max(1).optional(),
  rationale: z.string().optional(),
  fakeDetected: z.boolean(),
});

export type AuthenticityDetails = z.infer<typeof AuthenticityDetailsSchema>;

// -----------------------------------------------------------------------------
// Valuation / Revaluation
// -----------------------------------------------------------------------------

export const RevalueRequestSchema = z.object({
  forceRefresh: z.boolean().optional(),
});

export type RevalueRequest = z.infer<typeof RevalueRequestSchema>;

export const RevalueResponseSchema = z.object({
  executionArn: z.string(),
  status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED']),
  message: z.string().optional(),
});

export type RevalueResponse = z.infer<typeof RevalueResponseSchema>;
