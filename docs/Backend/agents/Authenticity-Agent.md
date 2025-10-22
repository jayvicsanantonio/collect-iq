# Authenticity Agent: Complete Technical Documentation

## Executive Summary

The Authenticity Agent is a sophisticated AI-powered system that determines whether a Pokémon Trading Card is authentic or counterfeit. It combines computer vision, perceptual hashing, multi-signal analysis, and generative AI to provide a comprehensive authenticity assessment with explainable confidence scores.

**Key Capabilities:**

- Multi-layered authenticity detection using 5 independent signals
- Perceptual hash comparison against reference samples
- AI-powered final judgment using Amazon Bedrock (Claude 4.0 Sonnet)
- Graceful degradation when reference data is unavailable
- Explainable results with detailed rationale

**Output:**

- Authenticity score (0.0 to 1.0)
- Binary fake detection flag
- Human-readable rationale
- Individual signal breakdowns
- AI verification status

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
│                    Authenticity Agent Lambda                     │
│                                                                   │
│  Input:                                                           │
│  • User ID, Card ID, Request ID                                  │
│  • Feature Envelope (from Rekognition)                           │
│  • Card Metadata (name, set, rarity)                             │
│  • S3 Keys (front/back images)                                   │
│  • OCR Reasoning Metadata (optional)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
```

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Visual Hash Computation │
│ │
│ 1. Download card image from S3 │
│ 2. Compute perceptual hash (pHash) │
│ • Resize to 32x32 grayscale │
│ • Apply Discrete Cosine Transform (DCT) │
│ • Extract low-frequency coefficients │
│ • Generate 64-bit hash │
│ 3. Compare with reference hashes (if available) │
│ • Calculate Hamming distance │
│ • Convert to similarity score │
│ │
│ Output: Visual Hash Confidence (0.0-1.0) │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Signal Computation │
│ │
│ Compute 5 independent authenticity signals: │
│ │
│ 1. Visual Hash Confidence (from Phase 1) │
│ 2. Text Match Confidence │
│ • Validate expected text patterns │
│ • Check OCR confidence scores │
│ • Verify card name presence │
│ │
│ 3. Holographic Pattern Confidence │
│ • Analyze holographic variance │
│ • Compare against expected rarity │
│ • Detect fake holographic overlays │
│ │
│ 4. Border Consistency │
│ • Check border symmetry │
│ • Validate border ratios │
│ • Detect printing irregularities │
│ │
│ 5. Font Validation │
│ • Analyze text alignment │
│ • Check kerning consistency │
│ • Validate font size variance │
│ │
│ Output: AuthenticitySignals object │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: AI Judgment (Bedrock) │
│ │
│ 1. Construct detailed prompt with: │
│ • Card metadata (name, set, rarity) │
│ • All 5 signal scores │
│ • Additional context (OCR blocks, quality metrics) │
│ │
│ 2. Invoke Amazon Bedrock (Claude 4.0 Sonnet) │
│ • System prompt: Expert authenticator persona │
│ • User prompt: Structured analysis request │
│ • Temperature: 0.2 (deterministic) │
│ • Max tokens: 2048 │
│ │
│ 3. Parse AI response (JSON format) │
│ • Authenticity score (0.0-1.0) │
│ • Fake detection flag │
│ • Human-readable rationale │
│ │
│ 4. Fallback on AI failure │
│ • Calculate simple average of signals │
│ • Mark as unverified by AI │
│ • Recommend manual review │
│ │
│ Output: AuthenticityResult │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ Return to Step Functions │
│ │
│ AuthenticityAgentOutput: │
│ • authenticityResult: AuthenticityResult │
│ • requestId: string │
└─────────────────────────────────────────────────────────────────┘

````

---

## Detailed Component Analysis

### 1. Perceptual Hash (pHash) System

#### What is Perceptual Hashing?

Perceptual hashing creates a "fingerprint" of an image that remains similar even when the image is slightly modified (resized, compressed, color-adjusted). Unlike cryptographic hashes (which change completely with any modification), perceptual hashes are designed to be similar for visually similar images.

#### Algorithm Implementation

**Step 1: Image Preprocessing**
```typescript
// Resize to 32x32 pixels and convert to grayscale
const resized = await sharp(imageBuffer)
  .resize(32, 32, { fit: 'fill' })
  .grayscale()
  .raw()
  .toBuffer({ resolveWithObject: true });
````

**Why 32x32?**

- Removes high-frequency details (noise, compression artifacts)
- Focuses on structural features
- Computationally efficient
- Standard size for DCT-based pHash

**Step 2: Discrete Cosine Transform (DCT)**

DCT converts spatial domain data into frequency domain. Low frequencies represent the overall structure, while high frequencies represent fine details.

```typescript
function computeDCT(matrix: number[][]): number[][] {
  const size = matrix.length;
  const dct: number[][] = Array(size)
    .fill(0)
    .map(() => Array(size).fill(0));

  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let sum = 0;
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          sum +=
            matrix[x][y] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size));
        }
      }
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      dct[u][v] = (2 / size) * cu * cv * sum;
    }
  }
  return dct;
}
```

**Step 3: Extract Low-Frequency Coefficients**

- Take top-left 8x8 DCT coefficients (excluding DC component at [0,0])
- These represent the image's structural features
- Resistant to minor variations

**Step 4: Generate Binary Hash**

```typescript
// Calculate median of coefficients
const median = sorted[Math.floor(sorted.length / 2)];

// Generate binary hash: 1 if > median, 0 otherwise
const binaryHash: number[] = [];
for (let u = 0; u < 8; u++) {
  for (let v = 0; v < 8; v++) {
    if (u === 0 && v === 0) continue; // Skip DC component
    binaryHash.push(dct[u][v] > median ? 1 : 0);
  }
}
```

**Step 5: Convert to Hexadecimal**

- 64 bits → 16 hexadecimal characters
- Compact representation for storage and comparison

#### Hamming Distance Comparison

**What is Hamming Distance?**
The number of bit positions where two hashes differ.

```typescript
function calculateHammingDistance(hash1: string, hash2: string): number {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const nibble1 = parseInt(hash1[i], 16);
    const nibble2 = parseInt(hash2[i], 16);
    const xor = nibble1 ^ nibble2;

    // Count set bits in XOR result
    let bits = xor;
    while (bits > 0) {
      distance += bits & 1;
      bits >>= 1;
    }
  }
  return distance;
}
```

**Similarity Score Calculation**

```typescript
function calculateSimilarityScore(hammingDistance: number): number {
  return Math.max(0, 1 - hammingDistance / 64);
}
```

**Interpretation:**

- Hamming distance 0-5: Nearly identical (similarity > 0.92)
- Hamming distance 6-10: Very similar (similarity > 0.84)
- Hamming distance 11-20: Similar (similarity > 0.69)
- Hamming distance > 20: Different (similarity < 0.69)

#### Reference Hash Storage

Reference hashes are stored in S3 at:

```
s3://{BUCKET_UPLOADS}/authentic-samples/{cardName}/{hash}.json
```

**Reference Hash Structure:**

```json
{
  "cardName": "Charizard",
  "hash": "a3f5c8d2e1b4f7a9",
  "variant": "Holo",
  "set": "Base Set"
}
```

**Graceful Degradation:**
When no reference hashes exist:

- Returns neutral confidence of 0.5 (50%)
- Logs warning but continues processing
- Other signals compensate for missing data
- AI makes final judgment without visual hash input

---

### 2. Text Match Confidence

#### Purpose

Validates that expected text patterns appear on the card with correct formatting and OCR confidence.

#### Authentic Text Patterns

```typescript
const AUTHENTIC_TEXT_PATTERNS = [
  'HP', // Hit Points indicator
  '©', // Copyright symbol
  'Pokémon', // Brand name
  'Nintendo', // Publisher
  'Creatures', // Developer
  'GAME FREAK', // Developer
  'Illus.', // Illustrator credit
  'Weakness', // Game mechanic
  'Resistance', // Game mechanic
  'Retreat', // Game mechanic
];
```

#### Calculation Method

```typescript
function calculateTextMatchConfidence(ocrBlocks: OCRBlock[], expectedCardName?: string): number {
  const allText = ocrBlocks.map((block) => block.text).join(' ');
  const allTextLower = allText.toLowerCase();

  let matchScore = 0;
  let totalChecks = 0;

  // Check for authentic patterns
  for (const pattern of AUTHENTIC_TEXT_PATTERNS) {
    totalChecks++;
    if (allTextLower.includes(pattern.toLowerCase())) {
      matchScore++;
    }
  }

  // Check for expected card name
  if (expectedCardName) {
    totalChecks++;
    if (allTextLower.includes(expectedCardName.toLowerCase())) {
      matchScore++;
    }
  }

  // Calculate average OCR confidence
  const avgOcrConfidence =
    ocrBlocks.reduce((sum, block) => sum + block.confidence, 0) / ocrBlocks.length;

  // Combine: 70% pattern matching + 30% OCR confidence
  const patternMatchRatio = matchScore / totalChecks;
  return patternMatchRatio * 0.7 + avgOcrConfidence * 0.3;
}
```

#### Why This Works

- **Pattern Matching:** Fake cards often have typos or missing text
- **OCR Confidence:** Low confidence suggests blurry/poor quality printing
- **Card Name Validation:** Ensures the card matches expected identity

**Pros:**

- Simple and fast
- Language-independent (checks for symbols)
- Catches obvious fakes with text errors

**Cons:**

- Requires good OCR quality
- May miss sophisticated fakes with correct text
- Sensitive to image quality/angle

---

### 3. Holographic Pattern Confidence

#### Purpose

Analyzes holographic variance to detect authentic holographic effects or fake overlays.

#### Holographic Variance

Holographic variance measures the variation in pixel intensity across the card, indicating the presence and quality of holographic effects.

**Expected Characteristics:**

```typescript
const AUTHENTIC_HOLO_CHARACTERISTICS = {
  minVariance: 0.3, // Minimum for authentic holo cards
  maxVariance: 0.9, // Maximum (too high = tampering)
};
```

#### Calculation Logic

**For Non-Holographic Cards:**

```typescript
if (!expectedHolo) {
  if (holoVariance < 0.2)
    return 1.0; // Good - low variance
  else if (holoVariance < 0.4)
    return 0.7; // Acceptable
  else return 0.3; // Suspicious - unexpected holo
}
```

**For Holographic Cards:**

```typescript
if (holoVariance >= 0.3 && holoVariance <= 0.9) {
  // Within expected range
  const optimalVariance = 0.6;
  const deviation = Math.abs(holoVariance - optimalVariance);
  const confidence = 1 - deviation / 0.3;
  return Math.max(0.5, confidence);
} else if (holoVariance < 0.3) {
  // Too low - might be fake or poor scan
  return 0.3 + (holoVariance / 0.3) * 0.2;
} else {
  // Too high - might indicate tampering
  const excessVariance = holoVariance - 0.9;
  return Math.max(0.2, 0.5 - excessVariance);
}
```

#### Detection Scenarios

**Scenario 1: Fake Holographic Overlay**

- Non-holo card with holographic sticker applied
- High variance (> 0.4) on non-holo card
- Confidence: 0.3 (suspicious)

**Scenario 2: Authentic Holographic Card**

- Variance between 0.3-0.9
- Optimal around 0.6
- Confidence: 0.7-1.0

**Scenario 3: Poor Quality Scan**

- Holo card with low variance (< 0.3)
- Lighting didn't capture holographic effect
- Confidence: 0.3-0.5 (uncertain)

**Pros:**

- Detects fake holographic overlays
- Validates expected rarity characteristics
- Quantitative measurement

**Cons:**

- Sensitive to lighting conditions
- Requires good image quality
- May misclassify poor scans

---

### 4. Border Consistency

#### Purpose

Analyzes border metrics to detect printing irregularities, cutting errors, or fake reproductions.

#### Border Metrics

```typescript
interface BorderMetrics {
  topRatio: number; // Top border as % of image height
  bottomRatio: number; // Bottom border as % of image height
  leftRatio: number; // Left border as % of image width
  rightRatio: number; // Right border as % of image width
  symmetryScore: number; // 0-1 score for border symmetry
}
```

#### Expected Characteristics

```typescript
const AUTHENTIC_BORDER_CHARACTERISTICS = {
  minSymmetry: 0.8, // Minimum symmetry for authentic cards
  expectedBorderRatio: 0.15, // Expected border ratio (normalized)
  borderTolerance: 0.1, // Tolerance for deviation
};
```

#### Calculation Method

```typescript
function calculateBorderConsistency(borders: BorderMetrics): number {
  // 1. Symmetry confidence (40% weight)
  const symmetryConfidence = borders.symmetryScore;

  // 2. Border variance confidence (30% weight)
  const borderRatios = [
    borders.topRatio,
    borders.bottomRatio,
    borders.leftRatio,
    borders.rightRatio,
  ];
  const avgBorderRatio = borderRatios.reduce((sum, ratio) => sum + ratio, 0) / 4;
  const borderVariance =
    borderRatios.reduce((sum, ratio) => sum + Math.pow(ratio - avgBorderRatio, 2), 0) / 4;
  const varianceConfidence = Math.max(0, 1 - borderVariance * 10);

  // 3. Ratio confidence (30% weight)
  const ratioDeviation = Math.abs(avgBorderRatio - 0.15);
  let ratioConfidence = 1.0;
  if (ratioDeviation > 0.1) {
    ratioConfidence = Math.max(0, 1 - (ratioDeviation - 0.1) / 0.15);
  }

  // Combine all factors
  return symmetryConfidence * 0.4 + varianceConfidence * 0.3 + ratioConfidence * 0.3;
}
```

#### What This Detects

**Authentic Cards:**

- Consistent border width on all sides
- High symmetry (left/right, top/bottom)
- Standard border ratio (~15% of card dimensions)

**Fake Cards:**

- Uneven borders (poor cutting)
- Asymmetric borders (misaligned printing)
- Wrong border ratios (incorrect card dimensions)

**Pros:**

- Catches printing/cutting errors
- Quantitative and objective
- Works regardless of card content

**Cons:**

- Sensitive to image cropping
- Requires well-framed photos
- May flag legitimate variations

---

### 5. Font Validation

#### Purpose

Analyzes font metrics to detect incorrect fonts, poor kerning, or printing quality issues.

#### Font Metrics

```typescript
interface FontMetrics {
  kerning: number[]; // Spacing between characters
  alignment: number; // Text alignment score (0-1)
  fontSizeVariance: number; // Variance in font sizes
}
```

#### Expected Characteristics

```typescript
const AUTHENTIC_FONT_CHARACTERISTICS = {
  minAlignment: 0.7, // Minimum alignment for authentic cards
  maxKerningVariance: 0.05, // Maximum kerning variance
  maxFontSizeVariance: 50, // Maximum font size variance
};
```

#### Calculation Method

```typescript
function calculateFontValidation(fontMetrics: FontMetrics): number {
  // 1. Alignment confidence (40% weight)
  const alignmentConfidence = fontMetrics.alignment;

  // 2. Kerning consistency (30% weight)
  let kerningConfidence = 1.0;
  if (fontMetrics.kerning.length > 1) {
    const avgKerning =
      fontMetrics.kerning.reduce((sum, k) => sum + k, 0) / fontMetrics.kerning.length;
    const kerningVariance =
      fontMetrics.kerning.reduce((sum, k) => sum + Math.pow(k - avgKerning, 2), 0) /
      fontMetrics.kerning.length;
    kerningConfidence = Math.max(0, 1 - kerningVariance / 0.05);
  }

  // 3. Font size consistency (30% weight)
  const fontSizeConfidence = Math.max(0, 1 - fontMetrics.fontSizeVariance / 50);

  // Combine all factors
  return alignmentConfidence * 0.4 + kerningConfidence * 0.3 + fontSizeConfidence * 0.3;
}
```

#### What This Detects

**Authentic Cards:**

- Professional typography with consistent kerning
- Proper text alignment
- Uniform font sizes within text blocks

**Fake Cards:**

- Inconsistent character spacing
- Poor alignment (text not straight)
- Varying font sizes (unprofessional printing)

**Pros:**

- Catches low-quality reproductions
- Detects font substitution
- Objective measurements

**Cons:**

- Requires high-resolution images
- Sensitive to OCR accuracy
- May miss sophisticated fakes

---

## AI Judgment Layer (Amazon Bedrock)

### Why Use AI for Final Judgment?

While the 5 signals provide quantitative measurements, authenticity assessment requires:

- **Contextual understanding:** Some signals matter more for certain card types
- **Holistic analysis:** Combining multiple weak signals into strong evidence
- **Explainability:** Human-readable rationale for decisions
- **Adaptability:** Learning from edge cases and new counterfeiting techniques

### Bedrock Integration

#### Model Configuration

```typescript
const BEDROCK_CONFIG = {
  modelId: 'anthropic.claude-sonnet-4-20250514-v1:0',
  maxTokens: 2048,
  temperature: 0.2, // Low temperature for deterministic results
  maxRetries: 5,
  baseRetryDelay: 2000,
  maxRetryDelay: 30000,
};
```

#### System Prompt (Expert Persona)

```
You are an expert Pokémon TCG card authenticator with deep knowledge of card
production, printing techniques, and common counterfeiting methods.

Your task is to analyze card authenticity based on visual features and computed
signals. You will receive:
1. Visual hash confidence (comparison with authentic reference samples)
2. Text match confidence (OCR validation of expected text patterns)
3. Holographic pattern confidence (analysis of holographic effects)
4. Border consistency (symmetry and ratio analysis)
5. Font validation (kerning, alignment, and size consistency)

Based on these signals, provide:
1. An overall authenticity score (0.0 to 1.0)
2. A boolean flag indicating if the card is likely fake (true if score <= 0.50)
3. A clear, concise rationale explaining your assessment

Be thorough but concise. Focus on the most significant indicators of
authenticity or fakeness.
```

#### User Prompt (Structured Data)

```
Analyze the authenticity of this Pokémon card:

**Card Information:**
- Name: Charizard
- Set: Base Set
- Rarity: Holo Rare
- Expected Holographic: Yes

**Authenticity Signals:**
- Visual Hash Confidence: 85.3%
- Text Match Confidence: 92.1%
- Holographic Pattern Confidence: 78.5%
- Border Consistency: 88.9%
- Font Validation: 81.2%

**Additional Context:**
- OCR Blocks Detected: 24
- Image Quality (Blur Score): 91.5%
- Glare Detected: No
- Border Symmetry: 89.7%

Provide your analysis in the following JSON format:
{
  "authenticityScore": <number between 0.0 and 1.0>,
  "fakeDetected": <boolean>,
  "rationale": "<2-3 sentence explanation>"
}
```

#### Response Parsing

The AI returns structured JSON:

```json
{
  "authenticityScore": 0.87,
  "fakeDetected": false,
  "rationale": "The card shows strong authenticity indicators across all signals, with particularly high text match (92.1%) and border consistency (88.9%). The visual hash confidence of 85.3% suggests good alignment with reference samples. The holographic pattern confidence of 78.5% is within expected range for authentic holo cards."
}
```

#### Retry Logic with Exponential Backoff

```typescript
private async invokeWithRetry(input: ConverseCommandInput): Promise<ConverseCommandOutput> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= BEDROCK_CONFIG.maxRetries; attempt++) {
    try {
      const command = new ConverseCommand(input);
      return await bedrockClient.send(command);
    } catch (error) {
      lastError = error;
      const isRateLimitError =
        error.message.includes('Too many requests') ||
        error.message.includes('ThrottlingException');

      if (attempt < BEDROCK_CONFIG.maxRetries) {
        // Exponential backoff with jitter
        const baseDelay = isRateLimitError ? 4000 : 2000;
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * exponentialDelay * 0.5;
        const delay = Math.min(exponentialDelay + jitter, 30000);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
```

**Why Exponential Backoff?**

- Handles rate limiting gracefully
- Prevents thundering herd problem
- Jitter prevents synchronized retries
- Aggressive backoff for rate limits (4s base vs 2s)

#### Fallback Mechanism

If Bedrock invocation fails after all retries:

```typescript
// Calculate simple average of signals as fallback
const fallbackScore =
  (signals.visualHashConfidence +
    signals.textMatchConfidence +
    signals.holoPatternConfidence +
    signals.borderConsistency +
    signals.fontValidation) /
  5;

return {
  authenticityScore: fallbackScore,
  fakeDetected: fallbackScore <= 0.5,
  rationale:
    'AI analysis unavailable. Score based on automated signals only. Manual review recommended.',
  signals: signals,
  verifiedByAI: false, // Important flag!
};
```

**Why This Matters:**

- System remains operational during Bedrock outages
- Users get results (with reduced confidence)
- `verifiedByAI: false` flag alerts downstream systems
- Recommendation for manual review

---

## Signal Weighting and Scoring

### Individual Signal Weights

When calculating fallback score (without AI):

```typescript
const weights = {
  visualHashConfidence: 0.3, // 30% - Most reliable when available
  textMatchConfidence: 0.25, // 25% - Strong indicator
  holoPatternConfidence: 0.2, // 20% - Rarity-dependent
  borderConsistency: 0.15, // 15% - Objective measurement
  fontValidation: 0.1, // 10% - Requires high-res images
};
```

### Why These Weights?

**Visual Hash (30%):**

- Direct comparison with known authentic samples
- Most reliable when reference data exists
- Resistant to minor variations
- **Limitation:** Requires reference database

**Text Match (25%):**

- Catches obvious fakes with text errors
- Validates expected patterns
- OCR confidence adds reliability
- **Limitation:** Sensitive to image quality

**Holographic Pattern (20%):**

- Detects fake holographic overlays
- Validates rarity expectations
- Quantitative measurement
- **Limitation:** Lighting-dependent

**Border Consistency (15%):**

- Objective geometric measurement
- Catches printing/cutting errors
- Works regardless of content
- **Limitation:** Sensitive to cropping

**Font Validation (10%):**

- Detects low-quality reproductions
- Catches font substitution
- Professional typography indicator
- **Limitation:** Requires high resolution

### AI Overrides Weighted Average

The AI doesn't use these weights directly. Instead, it:

1. Considers all signals holistically
2. Applies contextual understanding
3. Weighs signals based on card type
4. Identifies patterns humans might miss

**Example:** For a non-holo card, the AI might:

- Downweight holographic pattern confidence
- Upweight text match and border consistency
- Flag unexpected holographic variance as suspicious

---

## Data Structures

### Input: AuthenticityAgentInput

```typescript
interface AuthenticityAgentInput {
  userId: string;
  cardId: string;
  features: FeatureEnvelope;
  cardMeta: {
    name?: string;
    set?: string;
    rarity?: string;
    frontS3Key: string;
    ocrMetadata?: {
      name?: { value: string | null; confidence: number; rationale: string };
      rarity?: { value: string | null; confidence: number; rationale: string };
      set?:
        | { value: string | null; confidence: number; rationale: string }
        | {
            value: string | null;
            candidates: Array<{ value: string; confidence: number }>;
            rationale: string;
          };
      collectorNumber?: { value: string | null; confidence: number; rationale: string };
      overallConfidence?: number;
      reasoningTrail?: string;
      verifiedByAI?: boolean;
    };
  };
  s3Keys: {
    front: string;
    back?: string;
  };
  requestId: string;
}
```

### FeatureEnvelope Structure

```typescript
interface FeatureEnvelope {
  ocr: OCRBlock[]; // Text blocks from Rekognition
  borders: BorderMetrics; // Border measurements
  holoVariance: number; // Holographic variance
  fontMetrics: FontMetrics; // Font analysis
  quality: ImageQuality; // Image quality metrics
  imageMeta: ImageMetadata; // Image metadata
}

interface OCRBlock {
  text: string;
  confidence: number; // 0-1
  boundingBox: BoundingBox;
  type: 'LINE' | 'WORD';
}

interface BorderMetrics {
  topRatio: number;
  bottomRatio: number;
  leftRatio: number;
  rightRatio: number;
  symmetryScore: number; // 0-1
}

interface FontMetrics {
  kerning: number[];
  alignment: number; // 0-1
  fontSizeVariance: number;
}

interface ImageQuality {
  blurScore: number; // 0-1
  glareDetected: boolean;
  brightness: number;
}
```

### Output: AuthenticityAgentOutput

```typescript
interface AuthenticityAgentOutput {
  authenticityResult: AuthenticityResult;
  requestId: string;
}

interface AuthenticityResult {
  authenticityScore: number; // 0.0-1.0
  fakeDetected: boolean; // true if score <= 0.5
  rationale: string; // Human-readable explanation
  signals: AuthenticitySignals; // Individual signal scores
  verifiedByAI: boolean; // true if Bedrock succeeded
}

interface AuthenticitySignals {
  visualHashConfidence: number; // 0-1
  textMatchConfidence: number; // 0-1
  holoPatternConfidence: number; // 0-1
  borderConsistency: number; // 0-1
  fontValidation: number; // 0-1
}
```

---

## Error Handling and Edge Cases

### 1. Missing Reference Hashes

**Scenario:** No reference samples exist for the card.

**Behavior:**

```typescript
if (referenceHashes.length === 0) {
  logger.warn('No reference hashes available for comparison', { cardName });
  return 0.5; // Neutral confidence
}
```

**Impact:**

- Visual hash confidence = 0.5 (neutral)
- Other 4 signals still computed
- AI makes judgment with reduced information
- System continues to function

**Mitigation:**

- Build reference database over time
- Prioritize popular cards
- Accept user-submitted authentic samples

### 2. Poor Image Quality

**Scenario:** Blurry, dark, or glare-affected images.

**Behavior:**

- OCR confidence drops → Lower text match confidence
- Border detection less accurate → Lower border consistency
- Font metrics unreliable → Lower font validation
- Overall authenticity score decreases

**Mitigation:**

- Image quality metrics included in AI prompt
- AI considers quality when making judgment
- Frontend guides users to take better photos

### 3. Bedrock Rate Limiting

**Scenario:** Too many requests to Bedrock API.

**Behavior:**

```typescript
const isRateLimitError =
  error.message.includes('Too many requests') || error.message.includes('ThrottlingException');

if (isRateLimitError) {
  // Use aggressive backoff (4s base instead of 2s)
  const baseDelay = 4000;
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * exponentialDelay * 0.5;
  const delay = Math.min(exponentialDelay + jitter, 30000);
  await sleep(delay);
}
```

**Impact:**

- Automatic retry with exponential backoff
- Up to 5 retry attempts
- Maximum 30-second delay
- Falls back to signal-based scoring if all retries fail

### 4. Bedrock Service Outage

**Scenario:** Bedrock API completely unavailable.

**Behavior:**

- All 5 retry attempts fail
- Fallback to signal-based scoring
- `verifiedByAI: false` flag set
- Rationale includes manual review recommendation

**Impact:**

- System remains operational
- Users receive results (with disclaimer)
- Downstream systems aware of reduced confidence

### 5. Unknown Card Name

**Scenario:** OCR fails to extract card name.

**Behavior:**

```typescript
const visualHashConfidence = cardName
  ? await computeVisualHashConfidence(frontHash, cardName)
  : 0.5; // Neutral confidence if card name unknown
```

**Impact:**

- Visual hash comparison skipped
- Text match confidence reduced
- Other signals still computed
- AI makes judgment with available data

### 6. Non-Standard Card Types

**Scenario:** Promotional cards, misprints, or special editions.

**Behavior:**

- Signals may score lower than typical cards
- AI considers card type in rationale
- May recommend manual review
- System doesn't automatically flag as fake

**Mitigation:**

- Expand reference database with variants
- Train AI on edge cases
- Provide manual override mechanism

---

## Performance Characteristics

### Latency Breakdown

**Typical Execution Time:** 3-5 seconds

| Phase                     | Duration  | Notes                           |
| ------------------------- | --------- | ------------------------------- |
| Visual Hash Computation   | 500-800ms | S3 download + pHash calculation |
| Reference Hash Comparison | 100-300ms | S3 list + download + comparison |
| Signal Computation        | 50-100ms  | Pure computation, very fast     |
| Bedrock Invocation        | 2-3s      | Network + AI inference          |
| **Total**                 | **3-5s**  | End-to-end                      |

**With Retries (Rate Limiting):**

- First retry: +2-4s
- Second retry: +4-8s
- Third retry: +8-16s
- Maximum: ~30s (with backoff cap)

### Cost Analysis

**Per Authenticity Check:**

| Component           | Cost              | Notes                          |
| ------------------- | ----------------- | ------------------------------ |
| Lambda execution    | $0.0000002        | 1GB RAM, 5s duration           |
| S3 GET requests     | $0.0000004        | 1 image + 1-3 reference hashes |
| S3 data transfer    | $0.00009          | ~1MB image download            |
| Bedrock invocation  | $0.003-0.015      | Claude 4.0 Sonnet, ~500 tokens |
| **Total per check** | **~$0.003-0.015** | Dominated by Bedrock cost      |

**Monthly Cost (1000 cards):**

- $3-15 for Bedrock
- <$1 for Lambda + S3
- **Total: $4-16/month**

### Scalability

**Bottlenecks:**

1. **Bedrock Rate Limits:**
   - Default: 10 requests/second
   - Can request increase
   - Retry logic handles bursts

2. **Lambda Concurrency:**
   - Default: 1000 concurrent executions
   - Can request increase
   - Step Functions manages parallelism

3. **S3 Throughput:**
   - 5,500 GET requests/second per prefix
   - Not a bottleneck for typical usage

**Horizontal Scaling:**

- Lambda auto-scales to handle load
- Step Functions orchestrates parallel execution
- No single point of failure

---

## Pros and Cons Analysis

### Overall System Pros

✅ **Multi-Layered Defense**

- 5 independent signals reduce false positives/negatives
- No single point of failure
- Compensates for missing data

✅ **Explainable AI**

- Human-readable rationale
- Individual signal breakdowns
- Transparent decision-making

✅ **Graceful Degradation**

- Works without reference hashes
- Falls back when Bedrock unavailable
- Continues with partial data

✅ **Scalable Architecture**

- Serverless components auto-scale
- Cost-effective for variable load
- No infrastructure management

✅ **Continuous Improvement**

- AI learns from new patterns
- Reference database grows over time
- Signals can be tuned independently

### Overall System Cons

❌ **Reference Database Dependency**

- Visual hash confidence requires reference samples
- New/rare cards have limited references
- Database maintenance overhead

❌ **Image Quality Sensitivity**

- Poor photos reduce all signal accuracy
- Lighting affects holographic analysis
- Angle/cropping impacts border consistency

❌ **Cost Per Analysis**

- Bedrock invocation costs $0.003-0.015 per card
- Not suitable for free-tier applications
- Costs scale linearly with volume

❌ **Latency**

- 3-5 second typical response time
- Can reach 30s with retries
- Not suitable for real-time applications

❌ **False Positives/Negatives**

- No system is 100% accurate
- Sophisticated fakes may pass
- Legitimate variants may be flagged

### Signal-Specific Pros and Cons

#### Visual Hash Confidence

**Pros:**

- Direct comparison with authentic samples
- Resistant to minor variations
- Quantitative and objective

**Cons:**

- Requires reference database
- Neutral (0.5) when references missing
- Sensitive to image preprocessing

#### Text Match Confidence

**Pros:**

- Catches obvious text errors
- Fast and simple
- Language-independent patterns

**Cons:**

- Requires good OCR quality
- May miss sophisticated fakes
- Sensitive to image angle

#### Holographic Pattern Confidence

**Pros:**

- Detects fake holographic overlays
- Validates rarity expectations
- Quantitative measurement

**Cons:**

- Highly lighting-dependent
- Poor scans misclassified
- Rarity must be known

#### Border Consistency

**Pros:**

- Objective geometric measurement
- Catches printing errors
- Content-independent

**Cons:**

- Sensitive to image cropping
- Requires well-framed photos
- May flag legitimate variations

#### Font Validation

**Pros:**

- Detects low-quality reproductions
- Catches font substitution
- Professional typography indicator

**Cons:**

- Requires high-resolution images
- Sensitive to OCR accuracy
- May miss sophisticated fakes

---

## Future Improvements

### 1. Expand Reference Database

**Goal:** Increase visual hash confidence coverage

**Approach:**

- Crowdsource authentic card images
- Partner with grading companies (PSA, BGS)
- Automated reference extraction from verified sources
- Prioritize popular/valuable cards

**Impact:**

- Higher visual hash confidence scores
- Reduced reliance on neutral 0.5 fallback
- Better detection of sophisticated fakes

### 2. Machine Learning Enhancement

**Goal:** Replace rule-based signals with ML models

**Approach:**

- Train CNN for holographic pattern detection
- Use transformer models for text validation
- Ensemble learning for final judgment
- Active learning from user feedback

**Impact:**

- More accurate signal computation
- Adaptive to new counterfeiting techniques
- Reduced false positive/negative rates

### 3. Multi-Image Analysis

**Goal:** Analyze front and back images together

**Approach:**

- Compute perceptual hashes for both sides
- Cross-validate text patterns
- Check alignment between front/back
- Detect mismatched card halves

**Impact:**

- Higher confidence scores
- Catches more sophisticated fakes
- Better validation of card integrity

### 4. Historical Tracking

**Goal:** Track authenticity over time

**Approach:**

- Store authenticity results in DynamoDB
- Analyze trends in fake detection
- Identify emerging counterfeiting patterns
- Alert users to new threats

**Impact:**

- Proactive threat detection
- Improved AI training data
- Better user protection

### 5. Real-Time Reference Updates

**Goal:** Continuously update reference database

**Approach:**

- EventBridge triggers on new authentic cards
- Automated pHash computation and storage
- Versioned reference hashes
- A/B testing for new references

**Impact:**

- Always up-to-date reference data
- Faster coverage of new card releases
- Reduced manual maintenance

### 6. User Feedback Loop

**Goal:** Learn from user corrections

**Approach:**

- Allow users to report false positives/negatives
- Manual review queue for disputed results
- Retrain AI on corrected data
- Adjust signal weights based on feedback

**Impact:**

- Continuous accuracy improvement
- User trust and engagement
- Adaptive to edge cases

---

## Integration with CollectIQ Pipeline

### Upstream Dependencies

**1. Feature Extraction (Rekognition)**

- Provides FeatureEnvelope with OCR, borders, holo variance, fonts
- Must complete before Authenticity Agent runs
- Quality of features directly impacts signal accuracy

**2. OCR Reasoning Agent (Optional)**

- Enriches card metadata with AI-verified information
- Provides higher-confidence card name, set, rarity
- Improves text match and holographic pattern analysis

**3. S3 Upload**

- Card images must be uploaded to S3
- Presigned URLs expire in 60 seconds
- Images must be accessible to Lambda

### Downstream Consumers

**1. Aggregator Lambda**

- Receives AuthenticityResult
- Merges with pricing data
- Persists to DynamoDB
- Emits EventBridge events

**2. Frontend Display**

- Shows authenticity score with visual indicator
- Displays individual signal breakdowns
- Presents AI rationale
- Flags fake cards prominently

**3. EventBridge Events**

- `CardValuationCompleted` event includes authenticity data
- Downstream services can react to fake detection
- Analytics pipeline tracks authenticity trends

### Step Functions Orchestration

```json
{
  "Type": "Parallel",
  "Branches": [
    {
      "StartAt": "PricingAgent",
      "States": {
        "PricingAgent": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:...:function:pricing-agent",
          "End": true
        }
      }
    },
    {
      "StartAt": "AuthenticityAgent",
      "States": {
        "AuthenticityAgent": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:...:function:authenticity-agent",
          "End": true
        }
      }
    }
  ],
  "Next": "Aggregator"
}
```

**Parallel Execution:**

- Pricing and Authenticity agents run simultaneously
- Reduces total pipeline latency
- Independent failure handling
- Results merged by Aggregator

---

## Monitoring and Observability

### CloudWatch Metrics

**Custom Metrics:**

```typescript
await metrics.recordAuthenticityScore(authenticityScore, cardId);
await metrics.recordBedrockInvocation('authenticity', latency, tokenCount);
```

**Key Metrics:**

- `AuthenticityScore` (average, min, max, p50, p95, p99)
- `FakeDetectionRate` (percentage of cards flagged as fake)
- `BedrockLatency` (AI invocation time)
- `BedrockTokenUsage` (cost tracking)
- `SignalConfidence` (individual signal scores)
- `ReferenceHashHitRate` (percentage with references)

### X-Ray Tracing

**Traced Operations:**

```typescript
tracing.startSubsegment('authenticity_agent_handler', { userId, cardId });
tracing.trace('compute_perceptual_hash', () => computePerceptualHashFromS3(s3Key));
tracing.trace('compute_visual_hash_confidence', () => computeVisualHashConfidence(hash, name));
tracing.trace('bedrock_invoke_authenticity', () => bedrockService.invokeAuthenticity(context));
tracing.endSubsegment('authenticity_agent_handler', { success: true });
```

**Trace Insights:**

- End-to-end latency breakdown
- Bottleneck identification
- Error correlation
- Dependency mapping

### Structured Logging

**Log Levels:**

- `DEBUG`: Detailed computation steps
- `INFO`: Major milestones and results
- `WARN`: Missing references, retries, fallbacks
- `ERROR`: Failures requiring attention

**Key Log Events:**

```typescript
logger.info('Authenticity Agent invoked', { userId, cardId, cardName });
logger.warn('No reference hashes available', { cardName });
logger.info('Authenticity signals computed', signals);
logger.info('Bedrock authenticity analysis complete', { authenticityScore, fakeDetected });
logger.error('Authenticity Agent failed', error, { userId, cardId });
```

### Alerting

**Critical Alerts:**

- Bedrock invocation failure rate > 10%
- Average authenticity score drops significantly
- Fake detection rate spikes unexpectedly
- Lambda errors or timeouts

**Warning Alerts:**

- Reference hash hit rate < 50%
- Bedrock latency > 5 seconds
- High retry rate for Bedrock calls

---

## Security Considerations

### 1. User Data Isolation

**Enforcement:**

- User ID included in all operations
- DynamoDB uses `PK: USER#{sub}` for isolation
- S3 presigned URLs scoped to user
- Lambda execution context includes user ID

**Risk Mitigation:**

- Prevents cross-user data access
- Audit trail for all operations
- Compliance with data privacy regulations

### 2. S3 Access Control

**Configuration:**

- Lambda execution role has read-only S3 access
- Presigned URLs expire in 60 seconds
- Bucket policies enforce encryption at rest
- VPC endpoints for private S3 access

**Risk Mitigation:**

- Prevents unauthorized image access
- Limits exposure window
- Protects sensitive card images

### 3. Bedrock API Security

**Configuration:**

- IAM role with least-privilege permissions
- API calls logged to CloudTrail
- Rate limiting prevents abuse
- Retry logic prevents thundering herd

**Risk Mitigation:**

- Prevents unauthorized AI usage
- Audit trail for compliance
- Cost control through rate limiting

### 4. Input Validation

**Validation:**

- Zod schemas validate all inputs
- S3 keys sanitized to prevent injection
- Card metadata validated before use
- Feature envelope structure enforced

**Risk Mitigation:**

- Prevents injection attacks
- Ensures data integrity
- Catches malformed requests early

---

## Testing Strategy

### Unit Tests

**Coverage:**

- Perceptual hash computation
- Hamming distance calculation
- Individual signal calculations
- Bedrock response parsing
- Fallback logic

**Example:**

```typescript
describe('calculateTextMatchConfidence', () => {
  it('should return high confidence for authentic patterns', () => {
    const ocrBlocks = [
      { text: 'HP 120', confidence: 0.95, ... },
      { text: '© Nintendo', confidence: 0.98, ... },
      { text: 'Charizard', confidence: 0.99, ... },
    ];
    const confidence = calculateTextMatchConfidence(ocrBlocks, 'Charizard');
    expect(confidence).toBeGreaterThan(0.8);
  });
});
```

### Integration Tests

**Coverage:**

- End-to-end Lambda execution
- S3 image download and processing
- Bedrock API integration
- Error handling and retries

**Example:**

```typescript
describe('Authenticity Agent Integration', () => {
  it('should analyze authentic card correctly', async () => {
    const input = {
      userId: 'test-user',
      cardId: 'test-card',
      features: mockFeatureEnvelope,
      cardMeta: { name: 'Charizard', set: 'Base Set', rarity: 'Holo' },
      s3Keys: { front: 'test-images/charizard.jpg' },
      requestId: 'test-request',
    };

    const result = await handler(input);

    expect(result.authenticityResult.authenticityScore).toBeGreaterThan(0.7);
    expect(result.authenticityResult.fakeDetected).toBe(false);
    expect(result.authenticityResult.verifiedByAI).toBe(true);
  });
});
```

### E2E Tests

**Coverage:**

- Full Step Functions workflow
- Real S3 images
- Real Bedrock invocations
- DynamoDB persistence

**Example:**

```typescript
describe('Full Authenticity Pipeline', () => {
  it('should detect fake card', async () => {
    // Upload fake card image
    await uploadToS3('fake-card.jpg');

    // Trigger Step Functions
    const execution = await startExecution({ cardId: 'fake-card' });

    // Wait for completion
    await waitForExecution(execution.executionArn);

    // Verify result
    const card = await getCardFromDynamoDB('fake-card');
    expect(card.authenticityScore).toBeLessThan(0.5);
    expect(card.fakeDetected).toBe(true);
  });
});
```

---

## Troubleshooting Guide

### Issue: Low Authenticity Scores for Authentic Cards

**Symptoms:**

- Authentic cards consistently score < 0.7
- High false positive rate

**Possible Causes:**

1. Poor image quality (blurry, dark, glare)
2. Missing reference hashes
3. Incorrect card metadata
4. Signal weight misconfiguration

**Diagnosis:**

```bash
# Check individual signal scores
aws logs filter-pattern "Authenticity signals computed" \
  --log-group-name /aws/lambda/authenticity-agent

# Check reference hash hit rate
aws cloudwatch get-metric-statistics \
  --metric-name ReferenceHashHitRate \
  --namespace CollectIQ
```

**Resolution:**

- Improve image capture guidance in frontend
- Expand reference database
- Validate OCR metadata accuracy
- Adjust signal weights if needed

### Issue: Bedrock Rate Limiting

**Symptoms:**

- High latency (> 10 seconds)
- Frequent retry attempts
- "Too many requests" errors

**Possible Causes:**

1. Traffic spike exceeding rate limits
2. Insufficient Bedrock quota
3. Retry storm from failures

**Diagnosis:**

```bash
# Check Bedrock invocation metrics
aws cloudwatch get-metric-statistics \
  --metric-name BedrockLatency \
  --namespace CollectIQ \
  --statistics Average,Maximum

# Check retry rate
aws logs filter-pattern "Retrying Bedrock invocation" \
  --log-group-name /aws/lambda/authenticity-agent
```

**Resolution:**

- Request Bedrock quota increase
- Implement request queuing
- Add circuit breaker pattern
- Scale horizontally with more Lambda concurrency

### Issue: Missing Reference Hashes

**Symptoms:**

- Visual hash confidence always 0.5
- Warning logs: "No reference hashes found"

**Possible Causes:**

1. Reference database not populated
2. Card name mismatch
3. S3 bucket misconfiguration

**Diagnosis:**

```bash
# Check S3 reference samples
aws s3 ls s3://${BUCKET_UPLOADS}/authentic-samples/ --recursive

# Check card name extraction
aws logs filter-pattern "cardName" \
  --log-group-name /aws/lambda/authenticity-agent
```

**Resolution:**

- Populate reference database
- Verify OCR card name extraction
- Check S3 bucket permissions
- Normalize card names (handle variants)

### Issue: AI Verification Failures

**Symptoms:**

- `verifiedByAI: false` in results
- Fallback rationale messages
- Bedrock invocation errors

**Possible Causes:**

1. Bedrock service outage
2. IAM permission issues
3. Invalid model ID
4. Response parsing errors

**Diagnosis:**

```bash
# Check Bedrock errors
aws logs filter-pattern "Bedrock authenticity analysis failed" \
  --log-group-name /aws/lambda/authenticity-agent

# Verify IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn ${LAMBDA_ROLE_ARN} \
  --action-names bedrock:InvokeModel
```

**Resolution:**

- Check AWS Health Dashboard for Bedrock status
- Verify IAM role has `bedrock:InvokeModel` permission
- Validate model ID in environment variables
- Review Bedrock response format changes

---

## Appendix A: Example Scenarios

### Scenario 1: Authentic Holographic Charizard

**Input:**

- Card: Charizard, Base Set, Holo Rare
- Image: High-quality scan, good lighting
- Reference hashes: Available (3 samples)

**Signal Scores:**

- Visual Hash Confidence: 0.89 (Hamming distance: 7)
- Text Match Confidence: 0.94 (all patterns found)
- Holographic Pattern Confidence: 0.82 (variance: 0.58)
- Border Consistency: 0.91 (high symmetry)
- Font Validation: 0.87 (consistent kerning)

**AI Analysis:**

```json
{
  "authenticityScore": 0.91,
  "fakeDetected": false,
  "rationale": "Excellent authenticity indicators across all signals. Visual hash shows strong match with reference samples (89%). Text patterns and holographic variance are consistent with authentic Base Set holo cards. Border symmetry and font metrics are within expected ranges."
}
```

**Result:** ✅ Authentic (91% confidence)

---

### Scenario 2: Fake Non-Holo Pikachu

**Input:**

- Card: Pikachu, Base Set, Common
- Image: Medium quality, slight blur
- Reference hashes: Available (2 samples)

**Signal Scores:**

- Visual Hash Confidence: 0.42 (Hamming distance: 37)
- Text Match Confidence: 0.68 (missing "GAME FREAK")
- Holographic Pattern Confidence: 0.35 (unexpected variance: 0.45)
- Border Consistency: 0.71 (asymmetric borders)
- Font Validation: 0.59 (inconsistent kerning)

**AI Analysis:**

```json
{
  "authenticityScore": 0.38,
  "fakeDetected": true,
  "rationale": "Multiple red flags indicate likely counterfeit. Visual hash shows poor match with authentic samples (42%). Unexpected holographic variance on non-holo card suggests fake overlay. Missing copyright text and inconsistent font metrics are consistent with low-quality reproduction."
}
```

**Result:** ❌ Fake (38% confidence, flagged)

---

### Scenario 3: Authentic Card, No References

**Input:**

- Card: Umbreon VMAX, Evolving Skies, Secret Rare
- Image: Excellent quality, professional scan
- Reference hashes: None available (new card)

**Signal Scores:**

- Visual Hash Confidence: 0.50 (no references)
- Text Match Confidence: 0.96 (all patterns found)
- Holographic Pattern Confidence: 0.88 (variance: 0.62)
- Border Consistency: 0.93 (perfect symmetry)
- Font Validation: 0.91 (professional typography)

**AI Analysis:**

```json
{
  "authenticityScore": 0.84,
  "fakeDetected": false,
  "rationale": "Strong authenticity indicators despite lack of reference samples. Excellent text match (96%), appropriate holographic variance for secret rare, and professional border/font metrics. Visual hash comparison unavailable but other signals strongly suggest authentic card."
}
```

**Result:** ✅ Authentic (84% confidence, despite missing references)

---

### Scenario 4: Poor Quality Image

**Input:**

- Card: Mewtwo, Base Set, Rare
- Image: Very blurry, poor lighting, glare
- Reference hashes: Available (4 samples)

**Signal Scores:**

- Visual Hash Confidence: 0.61 (Hamming distance: 25)
- Text Match Confidence: 0.52 (low OCR confidence)
- Holographic Pattern Confidence: 0.48 (glare interference)
- Border Consistency: 0.67 (hard to detect borders)
- Font Validation: 0.44 (OCR unreliable)

**AI Analysis:**

```json
{
  "authenticityScore": 0.54,
  "fakeDetected": false,
  "rationale": "Image quality significantly impacts analysis reliability. Blur score of 45% and detected glare reduce confidence in all signals. While no definitive fake indicators present, recommend retaking photo with better lighting and focus for accurate assessment."
}
```

**Result:** ⚠️ Uncertain (54% confidence, recommend better photo)

---

### Scenario 5: Bedrock Failure Fallback

**Input:**

- Card: Blastoise, Base Set, Holo Rare
- Image: Good quality
- Reference hashes: Available
- Bedrock: Service unavailable

**Signal Scores:**

- Visual Hash Confidence: 0.87
- Text Match Confidence: 0.91
- Holographic Pattern Confidence: 0.79
- Border Consistency: 0.88
- Font Validation: 0.83

**Fallback Calculation:**

```typescript
const fallbackScore = (0.87 + 0.91 + 0.79 + 0.88 + 0.83) / 5 = 0.856
```

**Fallback Result:**

```json
{
  "authenticityScore": 0.86,
  "fakeDetected": false,
  "rationale": "AI analysis unavailable. Score based on automated signals only. Manual review recommended.",
  "verifiedByAI": false
}
```

**Result:** ✅ Likely Authentic (86% confidence, but unverified by AI)

---

## Appendix B: Configuration Reference

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
BUCKET_UPLOADS=collectiq-uploads-hackathon

# DynamoDB
DDB_TABLE=collectiq-cards-hackathon

# Bedrock Configuration
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
BEDROCK_MAX_TOKENS=2048
BEDROCK_TEMPERATURE=0.2

# EventBridge
EVENT_BUS_NAME=collectiq-events

# Logging
LOG_LEVEL=INFO
```

### IAM Permissions

**Lambda Execution Role:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::collectiq-uploads-hackathon/*",
        "arn:aws:s3:::collectiq-uploads-hackathon"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-*"
    },
    {
      "Effect": "Allow",
      "Action": ["xray:PutTraceSegments", "xray:PutTelemetryRecords"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### Lambda Configuration

```yaml
FunctionName: authenticity-agent
Runtime: nodejs20.x
Handler: dist/agents/authenticity_agent.handler
MemorySize: 1024 # 1GB for image processing
Timeout: 30 # 30 seconds max
ReservedConcurrentExecutions: 100 # Limit concurrency
Environment:
  Variables:
    NODE_OPTIONS: '--enable-source-maps'
Layers:
  - arn:aws:lambda:us-east-1:...:layer:sharp:1 # Image processing
Tracing: Active # X-Ray tracing enabled
```

---

## Appendix C: Glossary

**Authenticity Score:** A numerical value (0.0-1.0) representing the likelihood that a card is authentic. Scores above 0.5 suggest authentic, below 0.5 suggest fake.

**Bedrock:** Amazon's managed service for generative AI models. CollectIQ uses Claude 4.0 Sonnet for authenticity judgment.

**DCT (Discrete Cosine Transform):** A mathematical transformation that converts spatial domain data into frequency domain, used in perceptual hashing.

**Fake Detection:** Binary flag indicating whether a card is likely counterfeit (true if authenticity score ≤ 0.5).

**Feature Envelope:** A data structure containing all extracted features from a card image (OCR, borders, holographic variance, fonts, quality metrics).

**Hamming Distance:** The number of bit positions where two binary strings differ. Used to measure similarity between perceptual hashes.

**Holographic Variance:** A measure of pixel intensity variation across a card, indicating the presence and quality of holographic effects.

**OCR (Optical Character Recognition):** Technology that extracts text from images. CollectIQ uses Amazon Rekognition for OCR.

**Perceptual Hash (pHash):** A fingerprint of an image that remains similar for visually similar images, even with minor modifications.

**Reference Hash:** A perceptual hash of a known authentic card, stored for comparison with uploaded cards.

**Signal:** An independent measurement of authenticity (visual hash, text match, holographic pattern, border consistency, font validation).

**Step Functions:** AWS service for orchestrating Lambda functions in workflows. CollectIQ uses it to coordinate agents.

**Verified by AI:** Boolean flag indicating whether Amazon Bedrock successfully analyzed the card (true) or if fallback scoring was used (false).

---

## Appendix D: References

### Academic Papers

1. **Perceptual Hashing:**
   - Zauner, C. (2010). "Implementation and Benchmarking of Perceptual Image Hash Functions"
   - Venkatesan, R. et al. (2000). "Robust Image Hashing"

2. **Image Authenticity Detection:**
   - Farid, H. (2009). "Image Forgery Detection"
   - Popescu, A. & Farid, H. (2005). "Exposing Digital Forgeries by Detecting Traces of Resampling"

3. **Computer Vision:**
   - Lowe, D. (2004). "Distinctive Image Features from Scale-Invariant Keypoints"
   - Bay, H. et al. (2006). "SURF: Speeded Up Robust Features"

### AWS Documentation

- [Amazon Bedrock Developer Guide](https://docs.aws.amazon.com/bedrock/)
- [Amazon Rekognition Developer Guide](https://docs.aws.amazon.com/rekognition/)
- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- [AWS Step Functions Developer Guide](https://docs.aws.amazon.com/step-functions/)

### Related CollectIQ Documentation

- `OCR_AGENT_FLOW_DOCUMENTATION.md` - OCR Reasoning Agent details
- `PRICING_CACHE_REMOVAL.md` - Pricing system architecture
- `docs/Backend/AI Agents.md` - Agent system overview
- `docs/Backend/Step Functions Workflow.md` - Orchestration details

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

---

## Appendix E: Hackathon-Specific Modifications

### Increased Confidence for Missing Reference Hashes

**Date:** October 21, 2025  
**Reason:** Hackathon time constraints - reference database not yet populated  
**Impact:** Temporary adjustment to improve user experience during demo

#### Change Summary

For the hackathon deployment, the default confidence score when reference hashes are unavailable has been increased from **0.5 (neutral)** to **0.85 (high confidence)**.

#### Affected Code

**File:** `services/backend/src/utils/reference-hash-comparison.ts`

**Modified Functions:**

- `computeVisualHashConfidence()` - Returns 0.85 when no reference hashes found
- `computeAverageVisualHashConfidence()` - Returns 0.85 when no reference hashes found
- Error handling fallbacks - Return 0.85 instead of 0.5

#### Rationale

1. **Limited Reference Data:** The reference hash database is not yet populated with authentic card samples
2. **Demo Experience:** Lower confidence scores would negatively impact the hackathon demonstration
3. **Other Signals Compensate:** The remaining 4 authenticity signals (text match, holographic pattern, border consistency, font validation) still provide meaningful analysis
4. **AI Judgment:** Amazon Bedrock still makes the final determination based on all available signals

#### Behavior Changes

**Before (Production Default):**

```typescript
if (referenceHashes.length === 0) {
  logger.warn('No reference hashes available for comparison', { cardName });
  return 0.5; // Neutral confidence
}
```

**After (Hackathon):**

```typescript
if (referenceHashes.length === 0) {
  logger.warn('No reference hashes available for comparison', { cardName });
  // Return high confidence for hackathon (no reference data available yet)
  return 0.85;
}
```

#### Impact on Authenticity Scores

**Example Scenario:**

- Card: Charizard, Base Set, Holo Rare
- No reference hashes available
- Other signals: Text Match (0.94), Holo Pattern (0.82), Border (0.91), Font (0.87)

**Before:**

- Visual Hash Confidence: 0.50
- Average Signal Score: (0.50 + 0.94 + 0.82 + 0.91 + 0.87) / 5 = **0.81**

**After:**

- Visual Hash Confidence: 0.85
- Average Signal Score: (0.85 + 0.94 + 0.82 + 0.91 + 0.87) / 5 = **0.88**

**Result:** ~7% increase in overall authenticity scores when reference hashes are missing.

#### Risks and Limitations

⚠️ **Potential False Negatives:**

- Sophisticated fake cards may receive higher authenticity scores
- Visual hash comparison is bypassed entirely
- Reliance on other signals increases

⚠️ **Reduced Discrimination:**

- Less ability to distinguish between authentic and high-quality fakes
- Visual hash is typically the most reliable signal when available

⚠️ **User Expectations:**

- Users may develop false confidence in the system's accuracy
- Important to communicate limitations during demo

#### Post-Hackathon Action Items

**Priority 1: Revert to Production Default**

```typescript
// TODO: After hackathon, revert to 0.5 neutral confidence
return 0.5; // Neutral confidence when no references available
```

**Priority 2: Populate Reference Database**

- Collect authentic card samples from trusted sources
- Compute and store perceptual hashes
- Prioritize popular/valuable cards
- Target: 1000+ reference samples within 3 months

**Priority 3: Add Configuration Flag**

```typescript
const DEFAULT_CONFIDENCE = process.env.NO_REFERENCE_CONFIDENCE || '0.5';

if (referenceHashes.length === 0) {
  return parseFloat(DEFAULT_CONFIDENCE);
}
```

This allows environment-specific configuration without code changes.

#### Monitoring Recommendations

During hackathon, monitor these metrics closely:

1. **Fake Detection Rate:** Should remain stable despite confidence increase
2. **AI Override Rate:** How often does Bedrock disagree with high visual hash confidence?
3. **User Feedback:** Are users reporting false positives/negatives?
4. **Reference Hash Hit Rate:** Track as database grows post-hackathon

#### Related Changes

- No changes to other authenticity signals
- No changes to AI judgment logic
- No changes to fake detection threshold (still 0.5)
- No changes to frontend display

---

**Note:** This modification is temporary and should be reverted to production defaults (0.5 neutral confidence) once the reference hash database is adequately populated.
