# OCR Reasoning Agent: Complete Technical Documentation

## Executive Summary

The OCR Reasoning Agent is an AI-powered intelligent layer that transforms raw OCR text from AWS Rekognition into structured, confidence-scored card metadata using Amazon Bedrock (Claude 4.0 Sonnet). It serves as a critical bridge between computer vision and downstream agents, correcting OCR errors, inferring missing information, and providing explainable reasoning for all extracted fields.

**Key Capabilities:**

- OCR error correction using AI fuzzy matching (e.g., "Yenusaur" → "Venusaur")
- Rarity inference from visual patterns and holographic indicators
- Set identification from copyright text and card characteristics
- Collector number extraction with format validation
- Confidence scoring with detailed rationales
- Graceful fallback when AI unavailable

**Output:**

- Structured card metadata (name, set, rarity, collector number, illustrator)
- Per-field confidence scores (0.0-1.0)
- Human-readable rationales explaining reasoning
- Overall confidence score
- AI verification flag
- Complete reasoning trail

---

## Architecture Overview

### System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Step Functions Workflow                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Rekognition Extract Lambda                      │
│                                                                   │
│  • Detects text blocks with bounding boxes                       │
│  • Provides OCR confidence scores                                │
│  • Extracts visual features (holo, borders, quality)             │
│                                                                   │
│  Output: FeatureEnvelope                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
```

┌─────────────────────────────────────────────────────────────────┐
│ OCR Reasoning Agent Lambda │
│ │
│ Input: │
│ • User ID, Card ID, Request ID │
│ • Feature Envelope (OCR blocks + visual context) │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: OCR Context Building │
│ │
│ 1. Extract OCR blocks from FeatureEnvelope │
│ • Text content │
│ • Confidence scores │
│ • Bounding box positions │
│ │
│ 2. Group OCR blocks by vertical position │
│ • Top region (0-30%): Card name area │
│ • Middle region (30-70%): Card body │
│ • Bottom region (70-100%): Copyright/metadata │
│ │
│ 3. Extract visual context │
│ • Holographic variance (rarity indicator) │
│ • Border symmetry (print quality) │
│ • Image quality (blur score, glare) │
│ │
│ Output: OcrContext object │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Prompt Engineering │
│ │
│ 1. Create System Prompt │
│ • Define Claude's role as Pokémon TCG expert │
│ • Specify capabilities (error correction, inference) │
│ • Define constraints (no external calls) │
│ • Provide output schema (JSON structure) │
│ • Set confidence scoring guidelines │
│ │
│ 2. Create User Prompt │
│ • Format OCR blocks by region │
│ • Include OCR confidence scores │
│ • Add visual context metrics │
│ • Provide optional hints (expected set/rarity) │
│ • List specific extraction tasks │
│ │
│ Output: System + User prompts (~1500 tokens) │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: Bedrock Invocation │
│ │
│ 1. Configure Bedrock request │
│ • Model: Claude 4.0 Sonnet (cross-region profile) │
│ • Temperature: 0.15 (deterministic) │
│ • Max tokens: 4096 │
│ │
│ 2. Invoke with retry logic │
│ • Attempt 1: Immediate │
│ • Attempt 2: +1s delay (if throttled/timeout) │
│ • Attempt 3: +2s delay │
│ • Attempt 4: +4s delay (final) │
│ │
│ 3. Handle response │
│ • Extract JSON from markdown code blocks │
│ • Parse JSON structure │
│ • Validate against Zod schema │
│ │
│ 4. Fallback on failure │
│ • Use topmost OCR text as card name │
│ • Set all other fields to null │
│ • Reduce confidence scores by 30-50% │
│ • Mark as unverified by AI │
│ │
│ Output: CardMetadata (AI-verified or fallback) │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: Metadata Enrichment │
│ │
│ 1. Add verification flag │
│ • verifiedByAI: true (Bedrock succeeded) │
│ • verifiedByAI: false (fallback used) │
│ │
│ 2. Log detailed results │
│ • Card name and confidence │
│ • Set and rarity │
│ • Overall confidence │
│ • Latency and token usage │
│ │
│ 3. Record metrics │
│ • Bedrock invocation latency │
│ • Input/output token counts │
│ • Overall confidence score │
│ • Fallback usage flag │
│ │
│ Output: OcrReasoningAgentOutput │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ Return to Step Functions │
│ │
│ Next Steps: │
│ • Pricing Agent uses name, set, rarity for market lookup │
│ • Authenticity Agent uses metadata for text validation │
│ • Aggregator persists metadata to DynamoDB │
└─────────────────────────────────────────────────────────────────┘

````

---

## Detailed Component Analysis

### 1. OCR Context Building

#### Purpose
Transform raw Rekognition output into structured context for AI reasoning.

#### OCR Block Structure

```typescript
interface OCRBlock {
  text: string;              // "Charizard VMAX"
  confidence: number;        // 0.99 (99% confidence)
  boundingBox: {
    top: number;            // 0.1 (10% from top)
    left: number;           // 0.2 (20% from left)
    width: number;          // 0.6 (60% of image width)
    height: number;         // 0.05 (5% of image height)
  };
  type: 'LINE' | 'WORD';
}
````

#### Spatial Grouping Strategy

**Why Group by Vertical Position?**
Pokémon cards have consistent layout:

- **Top (0-30%):** Card name, HP, type
- **Middle (30-70%):** Attacks, abilities, flavor text
- **Bottom (70-100%):** Copyright, illustrator, collector number

**Implementation:**

```typescript
const topBlocks = ocrBlocks.filter((b) => b.boundingBox.top < 0.3);
const middleBlocks = ocrBlocks.filter((b) => b.boundingBox.top >= 0.3 && b.boundingBox.top < 0.7);
const bottomBlocks = ocrBlocks.filter((b) => b.boundingBox.top >= 0.7);
```

**Benefits:**

- Helps AI understand text context
- Improves field extraction accuracy
- Reduces ambiguity (e.g., "100" in top = HP, in bottom = collector number)

#### Visual Context Integration

**Visual Features:**

```typescript
interface VisualContext {
  holoVariance: number; // 0.0-1.0 (holographic effect strength)
  borderSymmetry: number; // 0.0-1.0 (print quality indicator)
  imageQuality: {
    blurScore: number; // 0.0-1.0 (sharpness)
    glareDetected: boolean; // Light reflection present
  };
}
```

**Why Visual Context Matters:**

**1. Holographic Variance → Rarity Inference**

```
holoVariance < 0.2  → Common/Uncommon (no holo)
holoVariance 0.2-0.5 → Reverse Holo
holoVariance 0.5-0.8 → Holo Rare
holoVariance > 0.8  → Ultra Rare/Secret Rare (full holo)
```

**2. Border Symmetry → Authenticity Indicator**

```
borderSymmetry > 0.9 → Professional print (likely authentic)
borderSymmetry 0.7-0.9 → Acceptable quality
borderSymmetry < 0.7 → Poor quality (possible fake or damage)
```

**3. Image Quality → OCR Reliability**

```
blurScore > 0.8 → High OCR confidence
blurScore 0.5-0.8 → Moderate OCR confidence
blurScore < 0.5 → Low OCR confidence (AI must infer more)
```

**4. Glare Detection → Text Obscuration**

```
glareDetected = true → Some text may be unreadable
                     → AI must use context clues
```

**Example Context:**

```typescript
const ocrContext: OcrContext = {
  ocrBlocks: [
    { text: "Charizard VMAX", confidence: 0.99, boundingBox: {...} },
    { text: "HP 330", confidence: 0.97, boundingBox: {...} },
    { text: "© 2022 Pokémon", confidence: 0.95, boundingBox: {...} }
  ],
  visualContext: {
    holoVariance: 0.85,      // Strong holo → Ultra Rare
    borderSymmetry: 0.92,    // High quality print
    imageQuality: {
      blurScore: 0.88,       // Sharp image
      glareDetected: false   // No glare
    }
  }
};
```

**Pros:**

- Provides non-textual clues for AI reasoning
- Helps infer rarity when text is ambiguous
- Improves confidence scoring
- Enables holistic card analysis

**Cons:**

- Visual features may be inaccurate (lighting, angle)
- Adds complexity to prompt
- Increases token usage
- May mislead AI if features are wrong

---

### 2. Prompt Engineering

#### System Prompt Design

**Purpose:** Define Claude's role, capabilities, constraints, and output format.

**Key Components:**

**1. Role Definition**

```
You are an expert Pokémon Trading Card Game (TCG) analyst specializing
in card identification from OCR text.
```

**Why This Works:**

- Activates Claude's Pokémon knowledge
- Sets expectation for domain expertise
- Primes for card-specific reasoning

**2. Capability Declaration**

```
**Your Capabilities:**
- Correct OCR errors in Pokémon names using fuzzy matching
- Infer card rarity from visual patterns and holographic indicators
- Identify card sets from copyright text and set symbols
- Extract collector numbers, illustrator names, and metadata
```

**Why This Works:**

- Explicitly states what AI should do
- Encourages proactive error correction
- Sets scope for inference tasks

**3. Constraint Specification**

```
**Your Constraints:**
- Work ONLY from provided OCR text and visual context
- Do NOT make external API calls or database lookups
- Provide confidence scores (0.0-1.0) for all fields
- Include clear rationales explaining your reasoning
```

**Why This Works:**

- Prevents hallucination (no external data)
- Enforces confidence scoring
- Requires explainability
- Keeps AI grounded in provided data

**4. Output Schema**

```json
{
  "name": { "value": "string|null", "confidence": 0.0-1.0, "rationale": "string" },
  "rarity": { "value": "string|null", "confidence": 0.0-1.0, "rationale": "string" },
  "set": {
    "value": "string|null",
    "candidates": [{ "value": "string", "confidence": 0.0-1.0 }],
    "rationale": "string"
  },
  ...
}
```

**Why This Works:**

- Structured output (easy to parse)
- Per-field confidence (granular trust)
- Rationales (explainability)
- Multi-candidate support (handles ambiguity)

**5. Confidence Scoring Guidelines**

```
- 0.9-1.0: Exact match with high OCR confidence
- 0.7-0.9: Strong fuzzy match or clear contextual inference
- 0.5-0.7: Moderate confidence, some ambiguity
- 0.3-0.5: Low confidence, multiple possibilities
- 0.0-0.3: Very uncertain or no data available
```

**Why This Works:**

- Calibrates AI's confidence assessment
- Provides consistent scoring across fields
- Helps downstream systems filter results
- Enables confidence-based workflows

#### User Prompt Design

**Purpose:** Provide OCR data and visual context in a structured, AI-friendly format.

**Prompt Structure:**

```
Analyze this Pokémon card based on OCR text extraction:

**OCR Text Blocks (Top Region - Card Name Area):**
- "Charizard VMAX" (confidence: 99.4%, position: top 10%)
- "HP 330" (confidence: 97.2%, position: top 12%)

**OCR Text Blocks (Middle Region - Card Body):**
- "G-Max Wildfire 300" (confidence: 94.8%)
- "This attack does 30 damage..." (confidence: 89.3%)

**OCR Text Blocks (Bottom Region - Copyright/Metadata):**
- "© 2022 Pokémon" (confidence: 95.0%)
- "018/195" (confidence: 92.3%)
- "Illus. aky CG Works" (confidence: 88.1%)

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
6. Extract the full copyright text
```

**Design Principles:**

**1. Spatial Organization**

- Groups text by card region
- Helps AI understand layout
- Reduces ambiguity

**2. Confidence Transparency**

- Shows OCR confidence for each block
- Helps AI weight evidence
- Indicates reliability

**3. Position Information**

- Includes vertical position percentages
- Helps AI understand card structure
- Enables layout-based reasoning

**4. Visual Context Integration**

- Provides non-textual clues
- Enables rarity inference
- Supports quality assessment

**5. Explicit Task List**

- Clear extraction goals
- Prioritized by importance
- Guides AI reasoning

**Pros:**

- Structured format (easy for AI to parse)
- Rich context (text + visual + spatial)
- Explicit instructions (clear expectations)
- Confidence-aware (AI knows OCR reliability)

**Cons:**

- Verbose (1000-1500 tokens)
- May include irrelevant text
- Spatial grouping may fail for unusual layouts
- Visual context may mislead if inaccurate

---

### 3. AI Reasoning Process

#### How Claude Processes the Input

**Step 1: Parse OCR Blocks**

- Identifies card name in top region
- Locates copyright text in bottom region
- Finds collector number pattern (XX/YYY)

**Step 2: Error Correction**

```
OCR: "Yenusaur"
Claude's Knowledge: Pokémon names database
Fuzzy Match: "Venusaur" (Levenshtein distance: 1)
Confidence: 0.95 (high match, minor OCR error)
```

**Step 3: Rarity Inference**

```
Evidence:
- Holographic variance: 85% (very high)
- No "Holo" text in OCR
- HP value: 330 (VMAX range)
- Card name: "Charizard VMAX"

Reasoning:
- High holo variance → full holographic treatment
- VMAX suffix → Ultra Rare category
- No contradictory evidence

Conclusion: "Ultra Rare" (confidence: 0.9)
```

**Step 4: Set Identification**

```
Evidence:
- Copyright: "© 2022 Pokémon"
- Collector number: "018/195"
- Card name: "Charizard VMAX"

Reasoning:
- 2022 copyright → 2022 sets
- 195 total cards → matches Silver Tempest (195 cards)
- Charizard VMAX in Silver Tempest → confirmed

Conclusion: "Silver Tempest" (confidence: 0.85)
```

**Step 5: Metadata Extraction**

```
Collector Number: "018/195" (confidence: 0.92)
- Clear OCR text
- Valid format (XX/YYY)
- High OCR confidence

Illustrator: "aky CG Works" (confidence: 0.88)
- Follows "Illus." prefix
- Moderate OCR confidence
- Known illustrator name

Copyright: "© 2022 Pokémon" (confidence: 0.95)
- Standard format
- High OCR confidence
```

**Step 6: Confidence Aggregation**

```
Overall Confidence = weighted average of field confidences
= (0.95 * 0.3) + (0.9 * 0.25) + (0.85 * 0.25) + (0.92 * 0.1) + (0.88 * 0.1)
= 0.285 + 0.225 + 0.2125 + 0.092 + 0.088
= 0.9025 ≈ 0.90
```

**Weights:**

- Name: 30% (most important)
- Rarity: 25% (critical for pricing)
- Set: 25% (critical for pricing)
- Collector Number: 10% (helpful but not critical)
- Illustrator: 10% (nice to have)

#### Example AI Response

```json
{
  "name": {
    "value": "Charizard VMAX",
    "confidence": 0.95,
    "rationale": "OCR clearly shows 'Charizard VMAX' in top region with 99.4% confidence. Name matches known Pokémon with VMAX suffix indicating modern card."
  },
  "rarity": {
    "value": "Ultra Rare",
    "confidence": 0.9,
    "rationale": "85% holographic variance indicates full holographic treatment typical of Ultra Rare cards. VMAX designation confirms Ultra Rare status. No contradictory evidence in OCR text."
  },
  "set": {
    "value": "Silver Tempest",
    "candidates": [
      { "value": "Silver Tempest", "confidence": 0.85 },
      { "value": "Crown Zenith", "confidence": 0.6 }
    ],
    "rationale": "Copyright '© 2022 Pokémon' indicates 2022 release. Collector number 018/195 matches Silver Tempest set size. Charizard VMAX confirmed in Silver Tempest. Crown Zenith also possible but less likely based on collector number."
  },
  "setSymbol": {
    "value": null,
    "confidence": 0.0,
    "rationale": "No set symbol detected in OCR text. Set symbols are typically small graphical elements not captured by text OCR."
  },
  "collectorNumber": {
    "value": "018/195",
    "confidence": 0.92,
    "rationale": "Clear OCR text '018/195' in bottom region with 92.3% confidence. Format matches standard collector number pattern (XXX/YYY)."
  },
  "copyrightRun": {
    "value": "© 2022 Pokémon",
    "confidence": 0.95,
    "rationale": "Copyright text clearly visible in bottom region with 95.0% OCR confidence. Standard modern Pokémon copyright format."
  },
  "illustrator": {
    "value": "aky CG Works",
    "confidence": 0.88,
    "rationale": "Text 'Illus. aky CG Works' detected in bottom region with 88.1% confidence. 'aky CG Works' is a known Pokémon card illustrator."
  },
  "overallConfidence": 0.9,
  "reasoningTrail": "High-quality OCR with clear card name (Charizard VMAX) and collector number (018/195). Strong holographic variance (85%) confirms Ultra Rare status. Copyright date and collector number pattern strongly suggest Silver Tempest set. All major fields extracted with high confidence. Minor uncertainty only in set identification due to multiple 2022 sets with similar characteristics."
}
```

---

### 4. Bedrock Integration

#### Model Configuration

```typescript
const BEDROCK_OCR_CONFIG = {
  modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  maxTokens: 4096,
  temperature: 0.15,
  maxRetries: 3,
  retryDelay: 1000,
};
```

**Model Selection: Claude 4.0 Sonnet**

**Why Claude 4.0 Sonnet?**

- **Knowledge Cutoff:** April 2024 (includes recent Pokémon sets)
- **Context Window:** 200K tokens (handles long OCR text)
- **Reasoning Ability:** Strong logical inference
- **JSON Output:** Reliable structured output
- **Cost:** $3/$15 per million tokens (input/output)

**Why Not Other Models?**

- **GPT-4:** No native AWS integration, higher latency
- **Claude 3.5 Sonnet:** Older knowledge cutoff
- **Claude Haiku:** Faster but weaker reasoning
- **Llama 3:** Weaker Pokémon knowledge

**Cross-Region Inference Profile**

**Model ID Format:**

```
us.anthropic.claude-sonnet-4-20250514-v1:0
```

**Why Cross-Region Profile?**

- **High Availability:** Automatic failover across regions
- **Better Throughput:** Distributed load
- **Lower Latency:** Routes to nearest region
- **No Regional Lock-in:** Flexible deployment

**Temperature: 0.15 (Low)**

**Why Low Temperature?**

- **Deterministic Output:** Same input → same output
- **Reduced Hallucination:** Sticks to provided data
- **Consistent Confidence:** Stable scoring
- **Predictable Behavior:** Easier to debug

**Trade-off:**

- Less creative (but we don't want creativity here)
- May miss edge cases (but reduces false positives)

**Max Tokens: 4096**

**Why 4096?**

- **Structured Output:** JSON response ~400-600 tokens
- **Detailed Rationales:** ~200-400 tokens per field
- **Reasoning Trail:** ~200-300 tokens
- **Safety Margin:** 2x expected usage

**Cost Impact:**

- Input: ~1500 tokens × $3/M = $0.0045
- Output: ~600 tokens × $15/M = $0.009
- **Total: ~$0.014 per card**

#### Retry Logic with Exponential Backoff

**Implementation:**

```typescript
private async invokeWithRetry(input: ConverseCommandInput, requestId?: string) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const command = new ConverseCommand(input);
      const response = await bedrockClient.send(command);
      return response;  // Success
    } catch (error) {
      lastError = error;

      if (attempt < 3) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = 1000 * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;  // All retries failed
}
```

**Retry Schedule:**

| Attempt | Delay | Cumulative Time | Use Case            |
| ------- | ----- | --------------- | ------------------- |
| 1       | 0ms   | 0ms             | Normal operation    |
| 2       | 1s    | 1s              | Transient error     |
| 3       | 2s    | 3s              | Throttling          |
| 4       | 4s    | 7s              | Service degradation |

**Error Types Handled:**

**1. Throttling Errors**

```
ThrottlingException
TooManyRequestsException
Rate exceeded
```

**Response:** Exponential backoff (gives service time to recover)

**2. Timeout Errors**

```
TimeoutError
RequestTimeout
```

**Response:** Retry (may succeed on next attempt)

**3. Service Errors**

```
ServiceUnavailable
InternalServerError
```

**Response:** Retry (transient AWS issues)

**4. Validation Errors**

```
ValidationException
InvalidRequestException
```

**Response:** No retry (permanent error, fallback immediately)

**Pros:**

- Handles transient failures automatically
- Reduces user-facing errors
- Gives service time to recover
- Industry-standard pattern

**Cons:**

- Adds latency (up to 7s)
- May retry unrecoverable errors
- Increases cost (multiple invocations)
- Complexity in error handling

---

### 5. Response Parsing and Validation

#### JSON Extraction

**Challenge:** Claude may wrap JSON in markdown code blocks.

**Solution:**

````typescript
private parseResponse(responseText: string): CardMetadata {
  // Try to extract JSON from markdown code blocks
  const jsonMatch =
    responseText.match(/```json\s*([\s\S]*?)\s*```/) ||  // Markdown
    responseText.match(/\{[\s\S]*\}/);                    // Raw JSON

  if (!jsonMatch) {
    throw new Error('No JSON found in Bedrock response');
  }

  const jsonText = jsonMatch[1] || jsonMatch[0];
  const parsed = JSON.parse(jsonText);

  return parsed;
}
````

**Example Responses:**

**Markdown Wrapped:**

````
Here's my analysis:

```json
{
  "name": { "value": "Charizard", "confidence": 0.95, "rationale": "..." },
  ...
}
```

The card appears to be authentic based on...
````

**Raw JSON:**

```
{
  "name": { "value": "Charizard", "confidence": 0.95, "rationale": "..." },
  ...
}
```

#### Schema Validation with Zod

**Purpose:** Ensure AI response matches expected structure.

**Schema Definition:**

```typescript
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
```

**Validation:**

```typescript
try {
  const validated = CardMetadataSchema.parse(parsed);
  return validated as CardMetadata;
} catch (error) {
  logger.error('Schema validation failed', error);
  throw new Error('Invalid JSON structure from Bedrock');
}
```

**What Validation Catches:**

**1. Missing Fields**

```json
{
  "name": { "value": "Charizard", "confidence": 0.95 }
  // Missing "rationale" field
}
```

**Error:** Required field missing

**2. Invalid Types**

```json
{
  "name": { "value": "Charizard", "confidence": "high", "rationale": "..." }
  // "confidence" should be number, not string
}
```

**Error:** Type mismatch

**3. Out of Range Values**

```json
{
  "name": { "value": "Charizard", "confidence": 1.5, "rationale": "..." }
  // Confidence > 1.0
}
```

**Error:** Value out of range

**4. Unexpected Structure**

```json
{
  "cardName": "Charizard", // Wrong field name
  "confidence": 0.95
}
```

**Error:** Schema mismatch

**Pros:**

- Catches AI output errors early
- Prevents downstream failures
- Type-safe TypeScript code
- Clear error messages

**Cons:**

- Rigid schema (AI must match exactly)
- May reject valid but differently formatted responses
- Adds parsing overhead
- Requires schema maintenance

---

### 6. Fallback Mechanism

#### When Fallback Activates

**Scenarios:**

1. All Bedrock retries fail
2. JSON parsing fails
3. Schema validation fails
4. Timeout exceeded (>30s)
5. Unexpected errors

#### Fallback Logic

```typescript
private createFallbackMetadata(ocrBlocks: OCRBlock[]): CardMetadata {
  // Extract card name from topmost text block
  const topBlock = ocrBlocks
    .filter(b => b.boundingBox.top < 0.3)
    .sort((a, b) => a.boundingBox.top - b.boundingBox.top)[0];

  const fallbackConfidence = topBlock ? topBlock.confidence * 0.7 : 0.0;

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
    reasoningTrail: 'Fallback mode: Bedrock invocation failed. Using basic OCR extraction only. Manual review recommended.',
    verifiedByAI: false,
  };
}
```

#### Fallback Strategy

**1. Extract Card Name**

- Use topmost OCR block (likely card name)
- Reduce confidence by 30% (no AI verification)
- Provide fallback rationale

**2. Null All Other Fields**

- Can't infer rarity without AI
- Can't determine set without AI
- Can't extract metadata without AI

**3. Reduce Overall Confidence**

- Multiply by 0.5 (50% reduction)
- Reflects lack of AI verification
- Signals low reliability

**4. Set Verification Flag**

- `verifiedByAI: false`
- Downstream systems can filter
- Frontend can show warning

**Example Fallback Output:**

```json
{
  "name": {
    "value": "Charizard VMAX",
    "confidence": 0.69,
    "rationale": "Fallback: Using topmost OCR text as card name. AI reasoning unavailable."
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
  "overallConfidence": 0.35,
  "reasoningTrail": "Fallback mode: Bedrock invocation failed. Using basic OCR extraction only. Manual review recommended.",
  "verifiedByAI": false
}
```

**Pros:**

- System remains operational
- Provides partial data (better than nothing)
- Clear indication of fallback mode
- Enables manual review workflow

**Cons:**

- Limited metadata (only name)
- Low confidence scores
- No rarity/set information
- Downstream agents may fail

---

## Data Structures

### Input: OcrReasoningAgentInput

```typescript
interface OcrReasoningAgentInput {
  userId: string;
  cardId: string;
  features: FeatureEnvelope;
  requestId: string;
}

interface FeatureEnvelope {
  ocr: OCRBlock[];
  holoVariance: number;
  borders: { symmetryScore: number };
  quality: { blurScore: number; glareDetected: boolean };
  // ... other features
}
```

### Output: CardMetadata

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
  verifiedByAI?: boolean;
}

interface FieldResult<T> {
  value: T | null;
  confidence: number;
  rationale: string;
}

interface MultiCandidateResult<T> {
  value: T | null;
  candidates: Array<{ value: T; confidence: number }>;
  rationale: string;
}
```

---

## Performance Characteristics

### Latency Breakdown

**Typical Execution Time:** 2-5 seconds

| Phase                | Duration | Notes                     |
| -------------------- | -------- | ------------------------- |
| OCR Context Building | 10-20ms  | Pure computation          |
| Prompt Generation    | 5-10ms   | String formatting         |
| Bedrock Invocation   | 2-4s     | Network + AI inference    |
| Response Parsing     | 10-20ms  | JSON parsing + validation |
| **Total**            | **2-5s** | End-to-end                |

**With Retries:**

- First retry: +1s
- Second retry: +2s
- Third retry: +4s
- Maximum: ~12s (with all retries)

### Token Usage

**Input Tokens:** 800-1500

- System prompt: ~600 tokens
- User prompt: ~200-900 tokens (depends on OCR text volume)

**Output Tokens:** 400-600

- Structured JSON: ~300-400 tokens
- Rationales: ~100-200 tokens

**Cost Per Card:**

- Input: 1500 × $3/M = $0.0045
- Output: 600 × $15/M = $0.009
- **Total: ~$0.014 per card**

**Monthly Cost (1000 cards):**

- $14 for OCR reasoning
- Dominated by Bedrock output tokens

### Scalability

**Bottlenecks:**

1. **Bedrock Rate Limits:**
   - Default: 10 requests/second
   - Can request increase
   - Retry logic handles bursts

2. **Lambda Concurrency:**
   - 1000 concurrent executions (default)
   - Can request increase
   - Step Functions manages parallelism

3. **Token Limits:**
   - 200K context window (Claude 4.0)
   - 4096 max output tokens
   - Not a bottleneck for typical cards

**Horizontal Scaling:**

- Lambda auto-scales
- Bedrock handles distributed load
- No single point of failure

---

## Pros and Cons Analysis

### Overall System Pros

✅ **Intelligent Error Correction**

- Fixes OCR mistakes automatically
- Uses AI knowledge of Pokémon names
- Improves accuracy significantly

✅ **Contextual Inference**

- Infers rarity from visual patterns
- Determines set from copyright text
- Fills gaps in OCR data

✅ **Explainable Results**

- Per-field rationales
- Reasoning trail
- Confidence scores

✅ **Graceful Degradation**

- Fallback when AI unavailable
- Partial data better than none
- Clear indication of fallback mode

✅ **Structured Output**

- JSON format (easy to parse)
- Type-safe with Zod validation
- Consistent schema

✅ **Multi-Candidate Support**

- Handles ambiguous cases
- Ranks possibilities by confidence
- Enables manual review

### Overall System Cons

❌ **Cost Per Card**

- $0.014 per card (Bedrock)
- Not suitable for free tier
- Costs scale linearly

❌ **Latency**

- 2-5 seconds typical
- Up to 12s with retries
- Slower than pure OCR

❌ **AI Dependency**

- Requires Bedrock availability
- Falls back to basic OCR if unavailable
- No offline mode

❌ **Prompt Engineering Complexity**

- Requires careful prompt design
- May need tuning for edge cases
- Difficult to debug AI reasoning

❌ **Token Usage**

- 1500-2100 tokens per card
- Increases with OCR text volume
- May hit limits for complex cards

❌ **Non-Deterministic**

- Temperature 0.15 (not 0.0)
- May vary slightly between runs
- Harder to test

---

## Future Improvements

### 1. Vision-Based OCR

**Goal:** Send card images directly to Claude (when vision API available).

**Approach:**

- Use Claude's vision capabilities
- Skip Rekognition OCR entirely
- Direct image-to-metadata extraction

**Impact:**

- Higher accuracy (no OCR errors)
- Simpler pipeline
- Better set symbol recognition
- Higher cost (vision tokens more expensive)

### 2. Confidence Calibration

**Goal:** Align confidence scores with actual accuracy.

**Approach:**

- Track accuracy vs. confidence
- Build calibration dataset
- Adjust confidence thresholds
- Continuous learning

**Impact:**

- More reliable confidence scores
- Better filtering thresholds
- Improved user trust

### 3. Multi-Language Support

**Goal:** Handle non-English Pokémon cards.

**Approach:**

- Detect language from OCR text
- Use language-specific prompts
- Translate to English for processing
- Support Japanese, French, German, Spanish

**Impact:**

- Global market coverage
- Increased user base
- More complex prompts
- Higher token usage

### 4. Historical Learning

**Goal:** Learn from past corrections and user feedback.

**Approach:**

- Store user corrections
- Analyze common errors
- Update prompts based on patterns
- Build feedback loop

**Impact:**

- Continuous improvement
- Reduced error rate
- Better edge case handling
- Requires user feedback system

### 5. Caching Layer

**Goal:** Cache AI responses for identical OCR text.

**Approach:**

- Hash OCR text + visual context
- Store responses in DynamoDB
- TTL: 30 days
- Cache hit = instant response

**Impact:**

- 50-70% cache hit rate (estimated)
- Sub-second response times
- 50-70% cost reduction
- Requires cache management

---

## Integration with CollectIQ Pipeline

### Upstream Dependencies

**1. Rekognition Extract**

- Provides FeatureEnvelope with OCR blocks
- Must complete before OCR reasoning
- Quality of OCR affects AI accuracy

**2. S3 Upload**

- Card images stored for reference
- Used by Rekognition for OCR

### Downstream Consumers

**1. Pricing Agent**

- Uses `name`, `set`, `rarity` for market lookup
- Higher confidence = better pricing accuracy
- Falls back to basic search if low confidence

**2. Authenticity Agent**

- Uses metadata for text validation
- Compares AI-extracted text with OCR
- Confidence scores affect authenticity assessment

**3. Aggregator**

- Persists metadata to DynamoDB
- Stores confidence scores
- Emits EventBridge events

### Step Functions Orchestration

```json
{
  "StartAt": "RekognitionExtract",
  "States": {
    "RekognitionExtract": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:function:rekognition-extract",
      "Next": "OcrReasoningAgent"
    },
    "OcrReasoningAgent": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:function:ocr-reasoning-agent",
      "Next": "ParallelAgents",
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "IntervalSeconds": 2,
          "MaxAttempts": 2,
          "BackoffRate": 2.0
        }
      ]
    },
    "ParallelAgents": {
      "Type": "Parallel",
      "Branches": [
        { "StartAt": "PricingAgent", ... },
        { "StartAt": "AuthenticityAgent", ... }
      ],
      "Next": "Aggregator"
    }
  }
}
```

---

## Monitoring and Observability

### CloudWatch Metrics

**Custom Metrics:**

```typescript
await metrics.recordBedrockOcrInvocation({
  latency: number,
  inputTokens: number,
  outputTokens: number,
  overallConfidence: number,
  fallbackUsed: boolean,
});
```

**Key Metrics:**

- `OcrOverallConfidence` (average, p50, p95, p99)
- `OcrFallbackRate` (percentage using fallback)
- `BedrockOcrLatency` (AI invocation time)
- `BedrockOcrTokenUsage` (cost tracking)
- `OcrFieldConfidence` (per-field confidence)

### X-Ray Tracing

**Traced Operations:**

```typescript
tracing.startSubsegment('ocr_reasoning_agent_handler', { userId, cardId });
tracing.trace('bedrock_ocr_reasoning_invocation', () => service.interpretOcr(context));
tracing.endSubsegment('ocr_reasoning_agent_handler', { success: true });
```

### Structured Logging

**Log Levels:**

- `DEBUG`: Prompt generation, response parsing
- `INFO`: Major milestones and results
- `WARN`: Fallback activation, retries
- `ERROR`: Failures requiring attention

**Key Log Events:**

```typescript
logger.info('OCR reasoning started', { cardId, ocrBlockCount });
logger.info('Bedrock invocation successful', { latency, tokenCount });
logger.warn('Fallback metadata used', { reason: error.message });
logger.error('OCR reasoning agent failed', error, { cardId });
```

---

## Security Considerations

### 1. IAM Permissions

**Required:**

- `bedrock:InvokeModel` - For Claude API calls
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` - CloudWatch logging

**Least Privilege:**

- Restrict to specific model ARN
- No write access to S3/DynamoDB
- Read-only access to Secrets Manager

### 2. Input Validation

**Validation:**

- OCR blocks validated before processing
- Text sanitized to prevent prompt injection
- Bounding boxes validated (0-1 range)

**Risk Mitigation:**

- Prevents malicious OCR text
- Limits prompt injection attacks
- Ensures data integrity

### 3. Output Validation

**Validation:**

- All responses validated against Zod schema
- Confidence scores checked (0-1 range)
- Rationales sanitized before storage

**Risk Mitigation:**

- Prevents invalid data propagation
- Catches AI output errors
- Ensures type safety

---

## Troubleshooting Guide

### Issue: Low Confidence Scores

**Symptoms:**

- Overall confidence consistently < 0.6
- Many fields with null values

**Possible Causes:**

1. Poor image quality (blur, glare)
2. Unusual card layout
3. Non-English text
4. Damaged/worn card

**Diagnosis:**

```bash
# Check OCR quality
aws logs filter-pattern "ocrBlockCount" \
  --log-group-name /aws/lambda/ocr-reasoning-agent

# Check confidence distribution
aws cloudwatch get-metric-statistics \
  --metric-name OcrOverallConfidence \
  --namespace CollectIQ
```

**Resolution:**

- Improve image capture guidance
- Add multi-language support
- Expand prompt with more examples
- Manual review for low confidence

### Issue: High Fallback Rate

**Symptoms:**

- `verifiedByAI: false` frequently
- Fallback rationales in logs

**Possible Causes:**

1. Bedrock service issues
2. Rate limiting
3. Invalid prompts
4. Schema validation failures

**Diagnosis:**

```bash
# Check fallback rate
aws logs filter-pattern "Fallback mode" \
  --log-group-name /aws/lambda/ocr-reasoning-agent

# Check Bedrock errors
aws logs filter-pattern "Bedrock invocation failed" \
  --log-group-name /aws/lambda/ocr-reasoning-agent
```

**Resolution:**

- Check AWS Health Dashboard
- Request Bedrock quota increase
- Review prompt engineering
- Fix schema validation issues

---

## Document Metadata

**Version:** 1.0  
**Last Updated:** October 22, 2025  
**Author:** CollectIQ Engineering Team  
**Status:** Production  
**Audience:** Developers, DevOps, Product Managers

**Change Log:**

- v1.0 (2025-10-22): Initial comprehensive documentation

---

**End of Document**
