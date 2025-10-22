# @collectiq/shared

Shared TypeScript types and Zod schemas for CollectIQ platform.

## Purpose

This package provides type-safe schemas and types that are shared between the frontend (Next.js) and backend (AWS Lambda) to ensure consistency across the entire application.

## Usage

### In Backend (Lambda)

```typescript
import { Card, CardSchema, PricingResult, AuthContext, validate } from '@collectiq/shared';

// Validate incoming data
const card = validate(CardSchema, requestBody);

// Use types for function signatures
function processCard(card: Card): PricingResult {
  // ...
}
```

### In Frontend (Next.js)

```typescript
import { Card, ListCardsResponse, PresignRequest, PresignResponse } from '@collectiq/shared';

// Type API responses
const response = await fetch('/api/cards');
const data: ListCardsResponse = await response.json();

// Type form data
const presignRequest: PresignRequest = {
  filename: file.name,
  contentType: file.type,
  sizeBytes: file.size,
};
```

## Available Schemas

### Authentication

- `AuthContextSchema` / `AuthContext` - JWT claims and user context

### Upload

- `PresignRequestSchema` / `PresignRequest` - S3 presigned URL request
- `PresignResponseSchema` / `PresignResponse` - S3 presigned URL response

### Cards

- `CardSchema` / `Card` - Card metadata and analysis results
- `CreateCardRequestSchema` / `CreateCardRequest` - Create card request
- `UpdateCardRequestSchema` / `UpdateCardRequest` - Update card request
- `ListCardsResponseSchema` / `ListCardsResponse` - List cards response
- `AuthenticitySignalsSchema` / `AuthenticitySignals` - Authenticity detection signals

### Pricing

- `PricingResultSchema` / `PricingResult` - Aggregated pricing data
- `RawCompSchema` / `RawComp` - Raw comparable sale
- `PriceQuerySchema` / `PriceQuery` - Pricing query parameters

### Feature Extraction

- `FeatureEnvelopeSchema` / `FeatureEnvelope` - Extracted visual features
- `OCRBlockSchema` / `OCRBlock` - OCR text block
- `BorderMetricsSchema` / `BorderMetrics` - Border measurements
- `FontMetricsSchema` / `FontMetrics` - Font analysis
- `ImageQualitySchema` / `ImageQuality` - Image quality metrics
- `ImageMetadataSchema` / `ImageMetadata` - Image metadata

### AI Agents

- `AuthenticityResultSchema` / `AuthenticityResult` - Authenticity analysis result
- `ValuationSummarySchema` / `ValuationSummary` - AI-generated valuation summary

### Revaluation

- `RevalueRequestSchema` / `RevalueRequest` - Revaluation request
- `RevalueResponseSchema` / `RevalueResponse` - Revaluation response

## Schema Validation

All schemas are built with Zod and can be used for runtime validation:

```typescript
import { CardSchema } from '@collectiq/shared';

// Parse and validate
const card = CardSchema.parse(data);

// Safe parse (no throw)
const result = CardSchema.safeParse(data);
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

## Type Inference

Types are automatically inferred from schemas:

```typescript
import { z } from 'zod';
import { CardSchema } from '@collectiq/shared';

// Type is automatically inferred
type Card = z.infer<typeof CardSchema>;
```

## Adding New Schemas

1. Define schema in `src/schemas.ts`
2. Export schema and inferred type
3. Run `pnpm typecheck` to verify
4. Use in frontend and backend

Example:

```typescript
export const NewFeatureSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  enabled: z.boolean(),
});

export type NewFeature = z.infer<typeof NewFeatureSchema>;
```
