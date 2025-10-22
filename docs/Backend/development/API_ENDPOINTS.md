# Card Metadata API Documentation

This document describes the CardMetadata schema returned by the OCR Reasoning Agent and used throughout the CollectIQ backend.

## Overview

The CardMetadata schema represents structured information extracted from Pokémon TCG card images using Amazon Bedrock (Claude Sonnet 4.0). It includes confidence-scored fields, multi-candidate support for ambiguous data, and human-readable rationales explaining extraction decisions.

## Schema Definition

### CardMetadata

The top-level metadata object containing all extracted card information.

```typescript
interface CardMetadata {
  name: FieldResult<string>;
  rarity: FieldResult<string>;
  set: FieldResult<string> | MultiCandidateResult<string>;
  setSymbol: FieldResult<string>;
  collectorNumber: FieldResult<string>;
  copyrightRun: FieldResult<string>;
  illustrator: FieldResult<string>;
  overallConfidence: number;
  reasoningTrail: string;
}
```

### FieldResult<T>

Represents a single-value field with confidence score and rationale.

```typescript
interface FieldResult<T> {
  value: T | null;
  confidence: number;
  rationale: string;
}
```

**Fields:**

- `value`: The extracted value, or `null` if not found
- `confidence`: Confidence score from 0.0 (no confidence) to 1.0 (certain)
- `rationale`: Human-readable explanation of how the value was determined

**Example:**

```json
{
  "value": "Venusaur",
  "confidence": 0.92,
  "rationale": "Corrected OCR text 'Yenusaur' to 'Venusaur' using fuzzy matching against known Pokémon names"
}
```

### MultiCandidateResult<T>

Represents a field with multiple possible values, ranked by confidence.

```typescript
interface MultiCandidateResult<T> {
  value: T | null;
  candidates: Array<{ value: T; confidence: number }>;
  rationale: string;
}
```

**Fields:**

- `value`: The most likely value (highest confidence candidate), or `null` if no candidates
- `candidates`: Array of possible values with confidence scores, sorted descending by confidence
- `rationale`: Human-readable explanation of the ambiguity and candidate selection

**Example:**

```json
{
  "value": "Base Set",
  "candidates": [
    { "value": "Base Set", "confidence": 0.85 },
    { "value": "Base Set 2", "confidence": 0.45 },
    { "value": "Legendary Collection", "confidence": 0.3 }
  ],
  "rationale": "Copyright text '©1999 Wizards' indicates WOTC era. Most likely Base Set based on card template, but could be Base Set 2 or Legendary Collection reprint."
}
```

## Field Descriptions

### name

**Type:** `FieldResult<string>`

**Description:** The Pokémon card name, corrected for OCR errors using fuzzy matching.

**Examples:**

- "Venusaur"
- "Charizard"
- "Pikachu"

**Confidence Guidelines:**

- 0.9-1.0: Exact match with high OCR confidence
- 0.7-0.9: Strong fuzzy match correction
- 0.5-0.7: Moderate confidence, some ambiguity
- 0.0-0.5: Low confidence or no data

**Example:**

```json
{
  "value": "Charizard",
  "confidence": 0.95,
  "rationale": "Exact match from top OCR block with 98% OCR confidence"
}
```

### rarity

**Type:** `FieldResult<string>`

**Description:** The card rarity, inferred from visual patterns and text indicators.

**Possible Values:**

- "Holo Rare"
- "Rare"
- "Uncommon"
- "Common"
- "Ultra Rare"
- "Secret Rare"

**Inference Sources:**

- Holographic variance (visual features)
- Rarity symbols (★, ◆, ●)
- Card template patterns
- Set-specific rarity indicators

**Example:**

```json
{
  "value": "Holo Rare",
  "confidence": 0.88,
  "rationale": "Inferred from holographic variance (85%) and card template. No explicit rarity symbol detected."
}
```

### set

**Type:** `FieldResult<string> | MultiCandidateResult<string>`

**Description:** The Pokémon TCG set name. May return multiple candidates if ambiguous.

**Examples:**

- "Base Set"
- "Jungle"
- "Fossil"
- "Team Rocket"
- "Sword & Shield"

**Inference Sources:**

- Copyright text patterns
- Set symbols
- Card template characteristics
- Release year

**Single-Value Example:**

```json
{
  "value": "Jungle",
  "confidence": 0.9,
  "rationale": "Copyright text '©1999 Wizards' and jungle set symbol clearly visible"
}
```

**Multi-Candidate Example:**

```json
{
  "value": "Base Set",
  "candidates": [
    { "value": "Base Set", "confidence": 0.85 },
    { "value": "Base Set 2", "confidence": 0.45 }
  ],
  "rationale": "Copyright text '©1999 Wizards' indicates WOTC era. Likely Base Set based on template, but could be Base Set 2 reprint."
}
```

### setSymbol

**Type:** `FieldResult<string>`

**Description:** The set symbol or icon, if visible in the image.

**Examples:**

- "none" (Base Set has no symbol)
- "jungle"
- "fossil"
- "★" (various sets)

**Example:**

```json
{
  "value": "jungle",
  "confidence": 0.75,
  "rationale": "Set symbol detected in bottom-right corner, matches Jungle set pattern"
}
```

### collectorNumber

**Type:** `FieldResult<string>`

**Description:** The collector number in "XX/YYY" format.

**Format:** `{cardNumber}/{totalInSet}`

**Examples:**

- "15/102" (Base Set Venusaur)
- "4/62" (Jungle Charizard)
- "136/135" (Secret Rare)

**Example:**

```json
{
  "value": "15/102",
  "confidence": 0.95,
  "rationale": "Extracted from bottom-right text pattern matching XX/YYY format"
}
```

### copyrightRun

**Type:** `FieldResult<string>`

**Description:** The full copyright text from the card bottom.

**Examples:**

- "©1995, 96, 98 Nintendo, Creatures, GAMEFREAK ©1999 Wizards"
- "©2021 Pokémon. ©1995-2021 Nintendo/Creatures Inc./GAME FREAK inc."

**Example:**

```json
{
  "value": "©1995, 96, 98 Nintendo, Creatures, GAMEFREAK ©1999 Wizards",
  "confidence": 0.88,
  "rationale": "Extracted from bottom OCR blocks with 88% average OCR confidence"
}
```

### illustrator

**Type:** `FieldResult<string>`

**Description:** The card illustrator name.

**Examples:**

- "Mitsuhiro Arita"
- "Ken Sugimori"
- "5ban Graphics"

**Example:**

```json
{
  "value": "Mitsuhiro Arita",
  "confidence": 0.9,
  "rationale": "Extracted from 'Illus. Mitsuhiro Arita' text in bottom-left corner"
}
```

### overallConfidence

**Type:** `number`

**Description:** Weighted average confidence score across all fields.

**Range:** 0.0 to 1.0

**Calculation:** Weighted average with higher weights for critical fields (name, set, rarity)

**Interpretation:**

- 0.9-1.0: Excellent extraction quality
- 0.7-0.9: Good extraction quality
- 0.5-0.7: Moderate quality, some uncertainty
- 0.3-0.5: Low quality, manual review recommended
- 0.0-0.3: Very poor quality, likely fallback mode

**Example:**

```json
{
  "overallConfidence": 0.88
}
```

### reasoningTrail

**Type:** `string`

**Description:** Summary of key factors in the extraction process.

**Purpose:** Provides transparency into AI decision-making and helps debug extraction issues.

**Example:**

```json
{
  "reasoningTrail": "High-quality OCR with clear text. Applied fuzzy matching for name correction ('Yenusaur' → 'Venusaur'). Inferred rarity from holographic variance (85%). Set determined from copyright text and card template. Collector number extracted from standard position."
}
```

## Usage Examples

### Accessing Metadata in Pricing Agent

```typescript
import type { PricingAgentInput } from './pricing-agent.js';

export const handler = async (event: PricingAgentInput) => {
  const { cardMeta } = event;

  // Check if OCR reasoning metadata is available
  if (cardMeta.ocrMetadata) {
    // Use enriched metadata
    const cardName = cardMeta.ocrMetadata.name?.value || 'Unknown Card';
    const set = cardMeta.ocrMetadata.set?.value || '';
    const rarity = cardMeta.ocrMetadata.rarity?.value;

    // Check confidence
    const nameConfidence = cardMeta.ocrMetadata.name?.confidence || 0;
    if (nameConfidence < 0.5) {
      logger.warn('Low name confidence', { cardName, nameConfidence });
    }

    // Handle multi-candidate sets
    if (cardMeta.ocrMetadata.set && 'candidates' in cardMeta.ocrMetadata.set) {
      const topCandidate = cardMeta.ocrMetadata.set.candidates[0];
      logger.info('Ambiguous set', {
        topCandidate: topCandidate.value,
        confidence: topCandidate.confidence,
        alternates: cardMeta.ocrMetadata.set.candidates.slice(1),
      });
    }
  } else {
    // Fallback to legacy metadata
    logger.warn('OCR reasoning metadata not available');
  }
};
```

### Persisting Metadata in Aggregator

```typescript
import type { CardMetadata } from './adapters/bedrock-ocr-reasoning.js';

export const persistCardMetadata = async (
  cardId: string,
  userId: string,
  ocrMetadata: CardMetadata
) => {
  const item = {
    PK: `USER#${userId}`,
    SK: `CARD#${cardId}`,

    // Store OCR metadata
    ocrName: ocrMetadata.name.value,
    ocrNameConfidence: ocrMetadata.name.confidence,
    ocrRarity: ocrMetadata.rarity.value,
    ocrRarityConfidence: ocrMetadata.rarity.confidence,
    ocrSet: ocrMetadata.set.value,
    ocrSetConfidence:
      'candidates' in ocrMetadata.set
        ? ocrMetadata.set.candidates[0]?.confidence
        : ocrMetadata.set.confidence,
    ocrCollectorNumber: ocrMetadata.collectorNumber.value,
    ocrIllustrator: ocrMetadata.illustrator.value,
    ocrOverallConfidence: ocrMetadata.overallConfidence,
    ocrReasoningTrail: ocrMetadata.reasoningTrail,
    ocrExtractedAt: new Date().toISOString(),

    // Store candidates for ambiguous fields
    ocrSetCandidates: 'candidates' in ocrMetadata.set ? ocrMetadata.set.candidates : undefined,
  };

  await dynamodb.putItem({ TableName: 'CollectIQ', Item: item });
};
```

### Displaying Metadata in Frontend

```typescript
interface CardDetailProps {
  card: {
    ocrMetadata?: {
      name?: { value: string | null; confidence: number; rationale: string };
      rarity?: { value: string | null; confidence: number; rationale: string };
      set?:
        | { value: string | null; confidence: number; rationale: string }
        | {
            value: string | null;
            candidates: Array<{ value: string; confidence: number }>;
            rationale: string
          };
      overallConfidence?: number;
      reasoningTrail?: string;
    };
  };
}

export const CardDetail: React.FC<CardDetailProps> = ({ card }) => {
  const { ocrMetadata } = card;

  if (!ocrMetadata) {
    return <div>No OCR metadata available</div>;
  }

  return (
    <div>
      <h2>{ocrMetadata.name?.value || 'Unknown Card'}</h2>

      {/* Show confidence indicator */}
      <ConfidenceBadge confidence={ocrMetadata.overallConfidence || 0} />

      {/* Show rarity */}
      <p>Rarity: {ocrMetadata.rarity?.value || 'Unknown'}</p>

      {/* Handle multi-candidate sets */}
      {ocrMetadata.set && 'candidates' in ocrMetadata.set ? (
        <div>
          <p>Set: {ocrMetadata.set.value} (ambiguous)</p>
          <details>
            <summary>Other possibilities</summary>
            <ul>
              {ocrMetadata.set.candidates.map((candidate, i) => (
                <li key={i}>
                  {candidate.value} ({(candidate.confidence * 100).toFixed(0)}%)
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : (
        <p>Set: {ocrMetadata.set?.value || 'Unknown'}</p>
      )}

      {/* Show reasoning trail for transparency */}
      <details>
        <summary>How was this determined?</summary>
        <p>{ocrMetadata.reasoningTrail}</p>
      </details>
    </div>
  );
};
```

## Validation

The CardMetadata schema is validated using Zod:

```typescript
import { z } from 'zod';

const FieldResultSchema = <T extends z.ZodType>(valueSchema: T) =>
  z.object({
    value: valueSchema.nullable(),
    confidence: z.number().min(0).max(1),
    rationale: z.string(),
  });

const MultiCandidateResultSchema = <T extends z.ZodType>(valueSchema: T) =>
  z.object({
    value: valueSchema.nullable(),
    candidates: z.array(
      z.object({
        value: valueSchema,
        confidence: z.number().min(0).max(1),
      })
    ),
    rationale: z.string(),
  });

export const CardMetadataSchema = z.object({
  name: FieldResultSchema(z.string()),
  rarity: FieldResultSchema(z.string()),
  set: z.union([FieldResultSchema(z.string()), MultiCandidateResultSchema(z.string())]),
  setSymbol: FieldResultSchema(z.string()),
  collectorNumber: FieldResultSchema(z.string()),
  copyrightRun: FieldResultSchema(z.string()),
  illustrator: FieldResultSchema(z.string()),
  overallConfidence: z.number().min(0).max(1),
  reasoningTrail: z.string(),
});

export type CardMetadata = z.infer<typeof CardMetadataSchema>;
```

## Error Handling

### Fallback Metadata

When Bedrock invocation fails, the OCR Reasoning Agent returns fallback metadata:

```json
{
  "name": {
    "value": "Venusaur",
    "confidence": 0.64,
    "rationale": "Fallback: Using topmost OCR text as card name. AI reasoning unavailable due to Bedrock timeout."
  },
  "rarity": {
    "value": null,
    "confidence": 0.0,
    "rationale": "Fallback: Unable to infer rarity without AI reasoning."
  },
  "set": {
    "value": null,
    "confidence": 0.0,
    "rationale": "Fallback: Unable to determine set without AI reasoning."
  },
  "setSymbol": {
    "value": null,
    "confidence": 0.0,
    "rationale": "Fallback: Unable to detect set symbol without AI reasoning."
  },
  "collectorNumber": {
    "value": null,
    "confidence": 0.0,
    "rationale": "Fallback: Unable to extract collector number without AI reasoning."
  },
  "copyrightRun": {
    "value": null,
    "confidence": 0.0,
    "rationale": "Fallback: Unable to extract copyright text without AI reasoning."
  },
  "illustrator": {
    "value": null,
    "confidence": 0.0,
    "rationale": "Fallback: Unable to extract illustrator without AI reasoning."
  },
  "overallConfidence": 0.3,
  "reasoningTrail": "Fallback mode: Bedrock invocation failed after 3 retry attempts. Using basic OCR extraction only. Confidence scores reduced by 30%."
}
```

**Key Indicators of Fallback Mode:**

- `overallConfidence` typically 0.3 or lower
- Rationales mention "Fallback" or "AI reasoning unavailable"
- Most fields have null values with 0.0 confidence
- `reasoningTrail` explains the failure reason

### Handling Missing Metadata

Always check for the presence of OCR metadata before using it:

```typescript
// Safe access pattern
const cardName = cardMeta.ocrMetadata?.name?.value || cardMeta.name || 'Unknown Card';
const nameConfidence = cardMeta.ocrMetadata?.name?.confidence || 0;

// Check if metadata is reliable
if (cardMeta.ocrMetadata && cardMeta.ocrMetadata.overallConfidence > 0.6) {
  // Use OCR reasoning metadata
} else {
  // Use legacy metadata or request manual review
}
```

## Performance Considerations

### Latency

- OCR Reasoning Agent typically completes in 2-3 seconds
- Total OCR pipeline (Rekognition + Reasoning) <5 seconds (95th percentile)

### Cost

- Input tokens: ~1500 per card
- Output tokens: ~800 per card
- Cost per card: ~$0.016
- Monthly cost (10,000 cards): ~$160

### Caching

Consider caching CardMetadata by OCR text hash to reduce costs and latency for duplicate uploads:

```typescript
const ocrHash = crypto
  .createHash('sha256')
  .update(JSON.stringify(features.ocrBlocks))
  .digest('hex');

// Check cache
const cached = await getFromCache(`ocr:${ocrHash}`);
if (cached) {
  return cached;
}

// Invoke Bedrock and cache result
const metadata = await bedrockOcrService.interpretOcr(context);
await setInCache(`ocr:${ocrHash}`, metadata, { ttl: 7 * 24 * 60 * 60 }); // 7 days
```

## Related Documentation

- [OCR Reasoning Agent](./README.md#ocr-reasoning-agent)
- [Bedrock OCR Reasoning Service](./README.md#bedrock-ocr-reasoning-service)
- [Troubleshooting Guide](./OCR_REASONING_TROUBLESHOOTING.md)
- [Design Document](../../.kiro/specs/bedrock-ocr-reasoning/design.md)
- [Requirements Document](../../.kiro/specs/bedrock-ocr-reasoning/requirements.md)
