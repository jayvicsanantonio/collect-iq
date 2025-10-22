# OCR Reasoning Agent - Complete Flow Documentation

## Overview

The OCR Reasoning Agent is a critical component in the CollectIQ card processing pipeline. It transforms raw OCR text from AWS Rekognition into structured, AI-verified card metadata using Claude Sonnet 4 (Amazon Bedrock).

## Architecture

```
┌───────────────────────────────────────────────────────┐
│              OCR Reasoning Agent                       │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐                │
│  │   Handler    │───▶│   Bedrock    │                │
│  │  (Lambda)    │    │   Service    │                │
│  └──────────────┘    └──────────────┘                │
│         │                    │                         │
│         ▼                    ▼                         │
│   Extract OCR         AI Reasoning                    │
│   Build Context       Extract Metadata                │
└───────────────────────────────────────────────────────┘
```

## Complete Flow

### Step 1: Lambda Invocation

**File**: `services/backend/src/agents/ocr-reasoning-agent.ts`

**Input** (from Step Functions):

```json
{
  "userId": "user-123",
  "cardId": "card-456",
  "features": {
    "ocr": [
      {
        "text": "Charizard VMAX",
        "confidence": 0.99,
        "boundingBox": { "top": 0.1, "left": 0.2, "width": 0.6, "height": 0.05 }
      },
      {
        "text": "© 2022 Pokémon",
        "confidence": 0.95,
        "boundingBox": { "top": 0.9, "left": 0.1, "width": 0.8, "height": 0.03 }
      }
    ],
    "holoVariance": 0.85,
    "borders": { "symmetryScore": 0.92 },
    "quality": { "blurScore": 0.88, "glareDetected": false }
  },
  "requestId": "req-789"
}
```

**Handler Entry Point** (Line 40):

```typescript
export const handler: Handler<OcrReasoningAgentInput, OcrReasoningAgentOutput> = async (event) => {
  const { userId, cardId, features, requestId } = event;
  const startTime = Date.now();

  // Initialize tracing
  tracing.startSubsegment('ocr_reasoning_agent_handler', { userId, cardId, requestId });

  logger.info('OCR reasoning started', {
    cardId,
    userId,
    ocrBlockCount: features.ocr?.length || 0,
    requestId,
  });
```

### Step 2: Extract OCR Blocks

**Lines 55-70**: Extract and validate OCR data

```typescript
// Extract OCR blocks from FeatureEnvelope
const ocrBlocks = features.ocr || [];

if (ocrBlocks.length === 0) {
  logger.warn('No OCR blocks found in FeatureEnvelope', {
    userId,
    cardId,
    requestId,
  });
}
```

**OCR Block Structure**:

```typescript
interface OCRBlock {
  text: string; // "Charizard VMAX"
  confidence: number; // 0.99
  boundingBox: {
    top: number; // 0.1 (10% from top)
    left: number; // 0.2 (20% from left)
    width: number; // 0.6 (60% width)
    height: number; // 0.05 (5% height)
  };
}
```

### Step 3: Build OCR Context

**Lines 72-95**: Combine OCR with visual features

```typescript
const ocrContext: OcrContext = {
  ocrBlocks,
  visualContext: {
    holoVariance: features.holoVariance || 0, // 0.85 = holographic
    borderSymmetry: features.borders?.symmetryScore || 0, // 0.92 = symmetric
    imageQuality: {
      blurScore: features.quality?.blurScore || 0, // 0.88 = sharp
      glareDetected: features.quality?.glareDetected || false,
    },
  },
};
```

**Why Visual Context Matters**:

- **holoVariance**: Helps determine rarity (high = holographic/ultra rare)
- **borderSymmetry**: Indicates print quality (authentic cards have symmetric borders)
- **blurScore**: Affects OCR confidence (blurry = less reliable)
- **glareDetected**: May obscure text (requires more AI reasoning)

### Step 4: Invoke Bedrock AI Reasoning

**File**: `services/backend/src/adapters/bedrock-ocr-reasoning.ts`

**Lines 97-105**: Call Bedrock service

```typescript
const cardMetadata = await tracing.trace(
  'bedrock_ocr_reasoning_invocation',
  () => bedrockOcrReasoningService.interpretOcr(ocrContext, requestId),
  { userId, cardId, requestId }
);
```

#### 4.1: Create System Prompt

**Lines 80-120**: Define Claude's role and capabilities

```typescript
private createSystemPrompt(): string {
  return `You are an expert Pokémon Trading Card Game (TCG) analyst specializing in card identification from OCR text.

**Your Capabilities:**
- Correct OCR errors in Pokémon names using fuzzy matching
- Infer card rarity from visual patterns and holographic indicators
- Identify card sets from copyright text and set symbols
- Extract collector numbers, illustrator names, and metadata

**Your Constraints:**
- Work ONLY from provided OCR text and visual context
- Do NOT make external API calls
- Provide confidence scores (0.0-1.0) for all fields
- Include clear rationales explaining your reasoning

**Output Format:**
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
}`;
}
```

#### 4.2: Create User Prompt

**Lines 150-220**: Provide OCR data to Claude

```typescript
private createUserPrompt(context: OcrContext): string {
  // Group OCR blocks by vertical position
  const topBlocks = ocrBlocks.filter((b) => b.boundingBox.top < 0.3);    // Card name area
  const middleBlocks = ocrBlocks.filter((b) => b.boundingBox.top >= 0.3 && b.boundingBox.top < 0.7);
  const bottomBlocks = ocrBlocks.filter((b) => b.boundingBox.top >= 0.7); // Copyright area

  let prompt = `Analyze this Pokémon card based on OCR text extraction:

**OCR Text Blocks (Top Region - Card Name Area):**
- "Charizard VMAX" (confidence: 99.4%, position: top 10%)

**OCR Text Blocks (Bottom Region - Copyright/Metadata):**
- "© 2022 Pokémon" (confidence: 95.0%)
- "018/195" (confidence: 92.3%)

**Visual Context:**
- Holographic Variance: 85.0% (indicates holographic finish)
- Border Symmetry: 92.0% (indicates print quality)
- Image Blur Score: 88.0% (higher = sharper)
- Glare Detected: No

**Your Task:**
1. Identify and correct the Pokémon name from the top region text
2. Infer the card rarity based on holographic variance and text patterns
3. Determine the card set from copyright text and visual patterns
4. Extract collector number (format: XX/YYY) if present
5. Identify the illustrator name if present
6. Extract the full copyright text`;

  return prompt;
}
```

#### 4.3: Invoke Bedrock with Retry Logic

**Lines 270-340**: Call Claude with exponential backoff

```typescript
private async invokeWithRetry(input: ConverseCommandInput, requestId?: string) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= BEDROCK_OCR_CONFIG.maxRetries; attempt++) {
    try {
      const command = new ConverseCommand(input);
      const response = await bedrockClient.send(command);

      logger.info('Bedrock invocation successful', {
        attempt,
        stopReason: response.stopReason,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        requestId,
      });

      return response;
    } catch (error) {
      // Check for throttling, timeout errors
      // Exponential backoff: 1s, 2s, 4s
      const delay = BEDROCK_OCR_CONFIG.retryDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Bedrock OCR reasoning failed after ${maxRetries} attempts`);
}
```

**Bedrock Configuration**:

```typescript
const BEDROCK_OCR_CONFIG = {
  modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0', // Cross-region inference profile
  maxTokens: 4096,
  temperature: 0.15, // Low temperature for deterministic output
  maxRetries: 3,
  retryDelay: 1000, // 1 second base delay
};
```

#### 4.4: Parse Claude's Response

**Lines 230-265**: Extract and validate JSON

````typescript
private parseResponse(responseText: string, requestId?: string): CardMetadata {
  // Claude might wrap JSON in markdown code blocks
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                    responseText.match(/\{[\s\S]*\}/);

  const jsonText = jsonMatch[1] || jsonMatch[0];
  const parsed = JSON.parse(jsonText);
  const validated = CardMetadataSchema.parse(parsed);  // Zod validation

  return validated as CardMetadata;
}
````

**Claude's Response Example**:

```json
{
  "name": {
    "value": "Charizard VMAX",
    "confidence": 0.95,
    "rationale": "OCR clearly shows 'Charizard VMAX' with 99.4% confidence in top region."
  },
  "rarity": {
    "value": "Ultra Rare",
    "confidence": 0.9,
    "rationale": "85% holographic variance indicates full holographic treatment typical of Ultra Rare cards."
  },
  "set": {
    "value": "Silver Tempest",
    "candidates": [
      { "value": "Silver Tempest", "confidence": 0.75 },
      { "value": "Shining Fates", "confidence": 0.6 }
    ],
    "rationale": "Copyright '© 2022 Pokémon' suggests 2022 release. Collector number format matches Silver Tempest."
  },
  "collectorNumber": {
    "value": "018/195",
    "confidence": 0.92,
    "rationale": "Clear OCR text '018/195' in bottom region with 92.3% confidence."
  },
  "overallConfidence": 0.88,
  "reasoningTrail": "High-quality OCR with clear card name and collector number. Holographic variance confirms ultra rare status.",
  "verifiedByAI": true
}
```

### Step 5: Return Enriched Metadata

**Lines 167-195**: Log and return results

```typescript
logger.info('OCR reasoning complete', {
  cardId,
  cardName: cardMetadata.name.value,
  nameConfidence: cardMetadata.name.confidence,
  rarity: cardMetadata.rarity.value,
  set: cardMetadata.set.value,
  overallConfidence: cardMetadata.overallConfidence,
  verifiedByAI: cardMetadata.verifiedByAI,
  latency: bedrockLatency,
  requestId,
});

return {
  cardMetadata,
  requestId,
};
```

**Output** (to Step Functions):

```json
{
  "cardMetadata": {
    "name": {
      "value": "Charizard VMAX",
      "confidence": 0.95,
      "rationale": "OCR clearly shows 'Charizard VMAX' with 99.4% confidence."
    },
    "rarity": {
      "value": "Ultra Rare",
      "confidence": 0.9,
      "rationale": "85% holographic variance indicates full holographic treatment."
    },
    "set": {
      "value": "Silver Tempest",
      "confidence": 0.75,
      "rationale": "Copyright '© 2022 Pokémon' suggests 2022 release. Collector number format matches Silver Tempest."
    },
    "setSymbol": {
      "value": null,
      "confidence": 0.0,
      "rationale": "No set symbol detected in OCR text."
    },
    "collectorNumber": {
      "value": "018/195",
      "confidence": 0.92,
      "rationale": "Clear OCR text '018/195' in bottom region."
    },
    "copyrightRun": {
      "value": "© 2022 Pokémon",
      "confidence": 0.95,
      "rationale": "Copyright text clearly visible in bottom region."
    },
    "illustrator": {
      "value": null,
      "confidence": 0.0,
      "rationale": "No illustrator name detected in OCR text."
    },
    "overallConfidence": 0.88,
    "reasoningTrail": "High-quality OCR with clear card name and collector number. Holographic variance confirms ultra rare status.",
    "verifiedByAI": true
  },
  "requestId": "req-789"
}
```

## Error Handling & Fallbacks

### Bedrock Failure

**Lines 550-590**: Fallback metadata when Bedrock fails

```typescript
private createFallbackMetadata(ocrBlocks: OCRBlock[]): CardMetadata {
  // Extract card name from topmost text block
  const topBlock = ocrBlocks
    .filter((b) => b.boundingBox.top < 0.3)
    .sort((a, b) => a.boundingBox.top - b.boundingBox.top)[0];

  return {
    name: {
      value: topBlock?.text || null,
      confidence: topBlock ? topBlock.confidence * 0.7 : 0.0,
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
    // ... all other fields null
    overallConfidence: Math.max(0.0, topBlock.confidence * 0.35),
    reasoningTrail: 'Fallback mode: Bedrock invocation failed. Using basic OCR extraction only.',
    verifiedByAI: false
  };
}
```

### No OCR Text

If no OCR blocks detected:

- Return all null values
- Confidence: 0.0
- Rationale: "No OCR text detected in image"

## Performance Metrics

**Typical Latencies**:

- Bedrock invocation: 2-5 seconds
- Total OCR agent: 2-6 seconds

**Token Usage** (Claude):

- Input tokens: 800-1500 (depends on OCR text volume)
- Output tokens: 400-600 (structured JSON response)

**Timeout Limits**:

- Lambda timeout: 30 seconds
- Bedrock retry: 3 attempts with exponential backoff

## Integration with Workflow

**Step Functions Flow**:

```
1. RekognitionExtract
   ↓ (features with OCR blocks)
2. OcrReasoningAgent ← YOU ARE HERE
   ↓ (cardMetadata)
3. ParallelAgents
   ├─ PricingAgent (uses cardMetadata.name, set, rarity)
   └─ AuthenticityAgent (uses cardMetadata for text matching)
   ↓
4. Aggregator (persists cardMetadata to DynamoDB)
```

## Key Files

1. **`ocr-reasoning-agent.ts`** - Lambda handler, orchestrates the flow
2. **`bedrock-ocr-reasoning.ts`** - Bedrock service, AI reasoning logic

## Configuration

**Environment Variables**:

```bash
REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-20250514-v1:0
BEDROCK_TEMPERATURE=0.15
BEDROCK_MAX_TOKENS=4096
BEDROCK_MAX_RETRIES=3
XRAY_ENABLED=false
```

**IAM Permissions Required**:

- `bedrock:Converse` - For Claude API calls
- `bedrock:ConverseStream` - For streaming responses
- `bedrock:InvokeModel` - Legacy API support
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` - CloudWatch logging

## Monitoring & Observability

**CloudWatch Logs**:

- INFO: OCR reasoning started/complete
- DEBUG: Prompt generation, response parsing
- WARN: Fallback activation
- ERROR: Bedrock failures, unexpected errors

**Metrics** (if CloudWatch permissions granted):

- Bedrock invocation latency
- Token usage (input/output)
- Overall confidence scores
- Fallback usage rate

**X-Ray Tracing**:

- Disabled by default (to avoid context issues)
- Can be enabled via `XRAY_ENABLED=true`

## Best Practices

1. **Always check `verifiedByAI` flag** - Indicates whether Bedrock succeeded
2. **Use confidence scores** - Filter low-confidence results for manual review
3. **Review reasoning trails** - Helps debug incorrect extractions
4. **Handle null values gracefully** - Not all fields are always present on cards

## Future Enhancements

1. **Image-based verification** - Compare uploaded image with reference card images
2. **Multi-language support** - Handle non-English cards
3. **Set symbol recognition** - Use computer vision for set symbols
4. **Enhanced set determination** - Improve AI reasoning for ambiguous cases
