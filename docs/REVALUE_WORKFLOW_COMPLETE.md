# Complete Revalue Workflow: What Happens When Revalue is Triggered

## Overview

When revalue is triggered (either automatically after upload or manually by the user), a sophisticated multi-agent AI workflow starts via AWS Step Functions. This document explains every step in detail.

---

## Trigger Points

Revalue can be triggered in two ways:

### 1. **Automatic Trigger (After Upload)**

```
User uploads card
  ↓
cards_create Lambda creates DynamoDB record
  ↓
cards_create emits "CardCreated" event to EventBridge
  ↓
EventBridge rule detects event
  ↓
Step Functions workflow starts automatically
```

### 2. **Manual Trigger (User Clicks Refresh)**

```
User clicks "Refresh" button on card detail page
  ↓
Frontend calls POST /cards/{id}/revalue
  ↓
cards_revalue Lambda starts Step Functions workflow
```

---

## Complete Workflow (5 Steps)

```
┌─────────────────────────────────────────────────────────────────┐
│                    STEP FUNCTIONS WORKFLOW                      │
│                    (15-25 seconds total)                        │
└─────────────────────────────────────────────────────────────────┘

Step 1: RekognitionExtract (5-10s)
  ↓
Step 2: ParallelAgents (8-15s)
  ├─ PricingAgent (parallel)
  └─ AuthenticityAgent (parallel)
  ↓
Step 3: Aggregator (2-3s)
  ↓
Done! Card updated in DynamoDB
```

---

## Step 1: RekognitionExtract Lambda (5-10 seconds)

### What It Does

Extracts visual features from the card image using Amazon Rekognition.

### AWS Services Connected

1. **S3** - Reads card image
2. **Rekognition** - Analyzes image
3. **CloudWatch** - Logs

### Detailed Flow

```
┌─────────────────────────────────────────────────────┐
│         rekognition_extract Lambda                  │
│                                                     │
│  Input:                                             │
│  {                                                  │
│    userId: "user123",                               │
│    cardId: "abc-123",                               │
│    s3Keys: {                                        │
│      front: "uploads/user123/uuid-file.jpg"        │
│    }                                                │
│  }                                                  │
└────┬────────────────────────────────────────────────┘
     │
     │ 1. Read image from S3
     ▼
┌─────────────────────────────────────────────────────┐
│                    Amazon S3                        │
│  GET uploads/user123/uuid-charizard.jpg            │
│  Returns: Binary image data                         │
└────┬────────────────────────────────────────────────┘
     │
     │ 2. Send to Rekognition for analysis
     ▼
┌─────────────────────────────────────────────────────┐
│              Amazon Rekognition                     │
│                                                     │
│  DetectText (OCR):                                  │
│  ├─ "Charizard"                                     │
│  ├─ "HP 120"                                        │
│  ├─ "Fire Spin"                                     │
│  └─ "© 1999 Nintendo"                               │
│                                                     │
│  DetectLabels:                                      │
│  ├─ "Trading Card" (99% confidence)                │
│  ├─ "Holographic" (85% confidence)                 │
│  └─ "Pokemon" (95% confidence)                      │
│                                                     │
│  Custom Analysis:                                   │
│  ├─ Holographic variance: 0.234                    │
│  ├─ Border consistency: 0.95                       │
│  ├─ Blur score: 0.12 (sharp)                       │
│  └─ Quality score: 0.88                            │
└────┬────────────────────────────────────────────────┘
     │
     │ 3. Return FeatureEnvelope
     ▼
┌─────────────────────────────────────────────────────┐
│         Output: FeatureEnvelope                     │
│  {                                                  │
│    ocr: [                                           │
│      { text: "Charizard", confidence: 0.99 },      │
│      { text: "HP 120", confidence: 0.95 }          │
│    ],                                               │
│    labels: [                                        │
│      { name: "Trading Card", confidence: 0.99 }    │
│    ],                                               │
│    holoVariance: 0.234,                            │
│    quality: {                                       │
│      blurScore: 0.12,                              │
│      brightness: 0.75,                             │
│      contrast: 0.82                                │
│    },                                               │
│    borders: {                                       │
│      consistency: 0.95,                            │
│      ratio: 0.88                                   │
│    }                                                │
│  }                                                  │
└─────────────────────────────────────────────────────┘
```

### Code Location

`services/backend/src/orchestration/rekognition-extract.ts`

### What Gets Extracted

1. **OCR Text** - Card name, HP, attacks, copyright
2. **Labels** - Object detection (Trading Card, Holographic, etc.)
3. **Holographic Patterns** - Pixel variance analysis for holo detection
4. **Quality Metrics** - Blur, brightness, contrast
5. **Border Analysis** - Consistency and ratio validation

---

## Step 2: ParallelAgents (8-15 seconds)

Two agents run **simultaneously** (in parallel) to save time:

### Branch 1: PricingAgent Lambda

#### What It Does

Fetches market pricing from multiple sources and generates AI valuation summary.

#### AWS Services Connected

1. **External APIs** - eBay, TCGPlayer, PriceCharting
2. **Bedrock** - Claude AI for valuation summary
3. **Secrets Manager** - API keys
4. **CloudWatch** - Logs

#### Detailed Flow

```
┌─────────────────────────────────────────────────────┐
│         pricing_agent Lambda                        │
│                                                     │
│  Input:                                             │
│  {                                                  │
│    userId: "user123",                               │
│    cardId: "abc-123",                               │
│    features: { ... },                               │
│    cardMeta: {                                      │
│      name: "Charizard",                             │
│      set: "Base Set",                               │
│      number: "4",                                   │
│      rarity: "Holo Rare",                           │
│      conditionEstimate: "Near Mint"                 │
│    }                                                │
│  }                                                  │
└────┬────────────────────────────────────────────────┘
     │
     │ 1. Fetch pricing from multiple sources
     │
     ├─► eBay API
     │   └─ Returns: 15 recent sales ($420, $450, $480...)
     │
     ├─► TCGPlayer API
     │   └─ Returns: Market price $445, Low $380, High $550
     │
     └─► PriceCharting API
         └─ Returns: Average $440, Trend: +5%
     │
     │ 2. Aggregate and normalize data
     ▼
┌─────────────────────────────────────────────────────┐
│         Pricing Aggregation                         │
│                                                     │
│  Raw Data:                                          │
│  ├─ eBay: 15 sales, avg $450                       │
│  ├─ TCGPlayer: Market $445                         │
│  └─ PriceCharting: Average $440                    │
│                                                     │
│  Normalized:                                        │
│  ├─ valueLow: $350                                 │
│  ├─ valueMedian: $450                              │
│  ├─ valueHigh: $600                                │
│  ├─ compsCount: 15                                 │
│  ├─ sources: ["ebay", "tcgplayer"]                 │
│  └─ confidence: 0.85                               │
└────┬────────────────────────────────────────────────┘
     │
     │ 3. Send to Bedrock for AI valuation summary
     ▼
┌─────────────────────────────────────────────────────┐
│         Amazon Bedrock (Claude)                     │
│                                                     │
│  Prompt:                                            │
│  "Analyze this Charizard Base Set card.            │
│   Recent sales: $420-$480                          │
│   Market data: $445 median                         │
│   Condition: Near Mint                             │
│   Provide valuation summary and trend."            │
│                                                     │
│  Response:                                          │
│  {                                                  │
│    fairValue: 450,                                 │
│    trend: "stable",                                │
│    confidence: 0.85,                               │
│    rationale: "Based on 15 recent sales,           │
│      this card shows stable pricing around         │
│      $450 for Near Mint condition. The Base        │
│      Set Charizard remains highly sought after."   │
│  }                                                  │
└────┬────────────────────────────────────────────────┘
     │
     │ 4. Return PricingResult
     ▼
┌─────────────────────────────────────────────────────┐
│         Output: PricingResult                       │
│  {                                                  │
│    valueLow: 350,                                  │
│    valueMedian: 450,                               │
│    valueHigh: 600,                                 │
│    compsCount: 15,                                 │
│    sources: ["ebay", "tcgplayer"],                 │
│    confidence: 0.85,                               │
│    valuationSummary: {                             │
│      fairValue: 450,                               │
│      trend: "stable",                              │
│      rationale: "..."                              │
│    }                                                │
│  }                                                  │
└─────────────────────────────────────────────────────┘
```

#### Code Location

`services/backend/src/agents/pricing-agent.ts`

---

### Branch 2: AuthenticityAgent Lambda

#### What It Does

Analyzes card authenticity using visual features and AI judgment.

#### AWS Services Connected

1. **S3** - Reads image for perceptual hashing
2. **Bedrock** - Claude AI for authenticity judgment
3. **CloudWatch** - Logs

#### Detailed Flow

```
┌─────────────────────────────────────────────────────┐
│         authenticity_agent Lambda                   │
│                                                     │
│  Input:                                             │
│  {                                                  │
│    userId: "user123",                               │
│    cardId: "abc-123",                               │
│    features: { ocr, labels, holoVariance... },     │
│    cardMeta: {                                      │
│      name: "Charizard",                             │
│      set: "Base Set",                               │
│      rarity: "Holo Rare",                           │
│      frontS3Key: "uploads/user123/uuid-file.jpg"   │
│    }                                                │
│  }                                                  │
└────┬────────────────────────────────────────────────┘
     │
     │ 1. Compute perceptual hash (pHash)
     ▼
┌─────────────────────────────────────────────────────┐
│         Perceptual Hash Computation                 │
│                                                     │
│  Read image from S3                                 │
│  ├─ Resize to 32x32                                │
│  ├─ Convert to grayscale                           │
│  ├─ Apply DCT (Discrete Cosine Transform)          │
│  └─ Generate 64-bit hash                           │
│                                                     │
│  Result: "a1b2c3d4e5f6g7h8"                        │
└────┬────────────────────────────────────────────────┘
     │
     │ 2. Compare with reference hashes
     ▼
┌─────────────────────────────────────────────────────┐
│         Reference Hash Comparison                   │
│                                                     │
│  Known authentic Charizard Base Set hashes:         │
│  ├─ "a1b2c3d4e5f6g7h8" (Hamming distance: 2)       │
│  ├─ "a1b2c3d4e5f6g7h9" (Hamming distance: 3)       │
│  └─ "a1b2c3d4e5f6g7ha" (Hamming distance: 4)       │
│                                                     │
│  Best match: 2 bits different (97% similar)         │
│  visualHashConfidence: 0.97                        │
└────┬────────────────────────────────────────────────┘
     │
     │ 3. Compute authenticity signals
     ▼
┌─────────────────────────────────────────────────────┐
│         Authenticity Signals                        │
│                                                     │
│  visualHashConfidence: 0.97                        │
│  textMatchConfidence: 0.95 (OCR matches known)     │
│  holoPatternConfidence: 0.88 (variance in range)   │
│  borderConsistency: 0.95 (borders look good)       │
│  fontValidation: 0.92 (font matches authentic)     │
└────┬────────────────────────────────────────────────┘
     │
     │ 4. Send to Bedrock for AI judgment
     ▼
┌─────────────────────────────────────────────────────┐
│         Amazon Bedrock (Claude)                     │
│                                                     │
│  Prompt:                                            │
│  "Analyze authenticity of this Charizard card.     │
│   Visual hash: 97% match with authentic            │
│   Text: Matches known authentic cards              │
│   Holo pattern: Within expected range              │
│   Borders: Consistent and correct ratio            │
│   Font: Matches authentic samples                  │
│   Provide authenticity score and rationale."       │
│                                                     │
│  Response:                                          │
│  {                                                  │
│    authenticityScore: 0.92,                        │
│    fakeDetected: false,                            │
│    verifiedByAI: true,                             │
│    confidence: 0.88,                               │
│    rationale: "Strong indicators of authenticity.  │
│      Visual hash closely matches known authentic   │
│      cards. Holographic pattern and text are       │
│      consistent with genuine Base Set cards."      │
│  }                                                  │
└────┬────────────────────────────────────────────────┘
     │
     │ 5. Return AuthenticityResult
     ▼
┌─────────────────────────────────────────────────────┐
│         Output: AuthenticityResult                  │
│  {                                                  │
│    authenticityScore: 0.92,                        │
│    fakeDetected: false,                            │
│    verifiedByAI: true,                             │
│    confidence: 0.88,                               │
│    signals: {                                       │
│      visualHashConfidence: 0.97,                   │
│      textMatchConfidence: 0.95,                    │
│      holoPatternConfidence: 0.88,                  │
│      borderConsistency: 0.95,                      │
│      fontValidation: 0.92                          │
│    },                                               │
│    rationale: "..."                                │
│  }                                                  │
└─────────────────────────────────────────────────────┘
```

#### Code Location

`services/backend/src/agents/authenticity_agent.ts`

---

## Step 3: Aggregator Lambda (2-3 seconds)

### What It Does

Merges results from both agents, updates DynamoDB, and emits completion event.

### AWS Services Connected

1. **DynamoDB** - Updates card record
2. **EventBridge** - Emits completion event
3. **CloudWatch** - Logs and metrics

### Detailed Flow

```
┌─────────────────────────────────────────────────────┐
│         aggregator Lambda                           │
│                                                     │
│  Input:                                             │
│  {                                                  │
│    userId: "user123",                               │
│    cardId: "abc-123",                               │
│    pricingResult: { ... },                         │
│    authenticityResult: { ... }                     │
│  }                                                  │
└────┬────────────────────────────────────────────────┘
     │
     │ 1. Merge results
     ▼
┌─────────────────────────────────────────────────────┐
│         Merge Results                               │
│                                                     │
│  Card Update:                                       │
│  {                                                  │
│    valueLow: 350,                                  │
│    valueMedian: 450,                               │
│    valueHigh: 600,                                 │
│    compsCount: 15,                                 │
│    sources: ["ebay", "tcgplayer"],                 │
│    authenticityScore: 0.92,                        │
│    authenticitySignals: {                          │
│      visualHashConfidence: 0.97,                   │
│      textMatchConfidence: 0.95,                    │
│      holoPatternConfidence: 0.88,                  │
│      borderConsistency: 0.95,                      │
│      fontValidation: 0.92                          │
│    },                                               │
│    updatedAt: "2024-01-15T10:35:00Z"              │
│  }                                                  │
└────┬────────────────────────────────────────────────┘
     │
     │ 2. Update DynamoDB
     ▼
┌─────────────────────────────────────────────────────┐
│              DynamoDB UpdateItem                    │
│                                                     │
│  Table: collectiq-hackathon-cards                   │
│  Key: {                                             │
│    PK: "USER#user123",                             │
│    SK: "CARD#abc-123"                              │
│  }                                                  │
│  UpdateExpression: "SET                             │
│    valueLow = :vl,                                 │
│    valueMedian = :vm,                              │
│    valueHigh = :vh,                                │
│    authenticityScore = :as,                        │
│    authenticitySignals = :sig,                     │
│    updatedAt = :now"                               │
└────┬────────────────────────────────────────────────┘
     │
     │ 3. Emit EventBridge event
     ▼
┌─────────────────────────────────────────────────────┐
│         EventBridge PutEvents                       │
│                                                     │
│  Event:                                             │
│  {                                                  │
│    Source: "collectiq.backend",                    │
│    DetailType: "CardValuationCompleted",           │
│    Detail: {                                        │
│      cardId: "abc-123",                            │
│      userId: "user123",                            │
│      name: "Charizard",                            │
│      valueMedian: 450,                             │
│      authenticityScore: 0.92,                      │
│      fakeDetected: false,                          │
│      timestamp: "2024-01-15T10:35:00Z"            │
│    }                                                │
│  }                                                  │
│                                                     │
│  (Can be consumed by other services for            │
│   notifications, analytics, etc.)                  │
└─────────────────────────────────────────────────────┘
     │
     │ 4. Return updated card
     ▼
┌─────────────────────────────────────────────────────┐
│         Output: Updated Card                        │
│  {                                                  │
│    card: {                                          │
│      cardId: "abc-123",                            │
│      userId: "user123",                            │
│      name: "Charizard",                            │
│      set: "Base Set",                              │
│      valueLow: 350,                                │
│      valueMedian: 450,                             │
│      valueHigh: 600,                               │
│      authenticityScore: 0.92,                      │
│      updatedAt: "2024-01-15T10:35:00Z"            │
│    }                                                │
│  }                                                  │
└─────────────────────────────────────────────────────┘
```

#### Code Location

`services/backend/src/orchestration/aggregator.ts`

---

## Error Handling: ErrorHandler Lambda

### When It's Called

If any step fails (Rekognition, Pricing, Authenticity, or Aggregator), the ErrorHandler Lambda is invoked.

### What It Does

1. **Persists Partial Results** - Saves any data that was successfully computed
2. **Logs Error Details** - Records error for debugging
3. **Sends to DLQ** - Puts error message in Dead Letter Queue for manual review

### Flow

```
┌─────────────────────────────────────────────────────┐
│         error_handler Lambda                        │
│                                                     │
│  Input:                                             │
│  {                                                  │
│    userId: "user123",                               │
│    cardId: "abc-123",                               │
│    error: {                                         │
│      Error: "PricingAgent.Timeout",                │
│      Cause: "eBay API timeout after 30s"           │
│    },                                               │
│    partialResults: {                                │
│      features: { ... },  // Rekognition succeeded  │
│      authenticityResult: { ... }  // This succeeded│
│    }                                                │
│  }                                                  │
└────┬────────────────────────────────────────────────┘
     │
     │ 1. Save partial results to DynamoDB
     ▼
┌─────────────────────────────────────────────────────┐
│         DynamoDB UpdateItem (Partial)               │
│                                                     │
│  Update card with whatever succeeded:               │
│  ├─ authenticityScore: 0.92 (succeeded)            │
│  ├─ authenticitySignals: { ... } (succeeded)       │
│  └─ valueLow/valueMedian: null (failed)            │
└────┬────────────────────────────────────────────────┘
     │
     │ 2. Send error to Dead Letter Queue
     ▼
┌─────────────────────────────────────────────────────┐
│         SQS Dead Letter Queue                       │
│                                                     │
│  Message:                                           │
│  {                                                  │
│    userId: "user123",                              │
│    cardId: "abc-123",                              │
│    error: "PricingAgent.Timeout",                  │
│    cause: "eBay API timeout",                      │
│    timestamp: "2024-01-15T10:35:00Z",             │
│    partialResults: ["authenticity"]                │
│  }                                                  │
│                                                     │
│  (DevOps can review and manually retry)            │
└─────────────────────────────────────────────────────┘
```

#### Code Location

`services/backend/src/orchestration/error-handler.ts`

---

## Complete Timeline

```
Time    Step                        AWS Services Used
─────────────────────────────────────────────────────────────────
0s      Revalue triggered           EventBridge or API Gateway
        ↓
0-10s   RekognitionExtract          S3, Rekognition, CloudWatch
        ├─ Read image from S3
        ├─ OCR text extraction
        ├─ Label detection
        ├─ Holographic analysis
        └─ Quality metrics
        ↓
10-25s  ParallelAgents
        ├─ PricingAgent             External APIs, Bedrock, Secrets Manager
        │  ├─ Fetch eBay prices
        │  ├─ Fetch TCGPlayer prices
        │  ├─ Fetch PriceCharting
        │  └─ Bedrock valuation
        │
        └─ AuthenticityAgent        S3, Bedrock, CloudWatch
           ├─ Compute perceptual hash
           ├─ Compare with references
           ├─ Analyze signals
           └─ Bedrock judgment
        ↓
25-28s  Aggregator                  DynamoDB, EventBridge, CloudWatch
        ├─ Merge results
        ├─ Update DynamoDB
        └─ Emit completion event
        ↓
28s     Done! Card updated
```

---

## What the User Sees

### During Processing (Frontend Polling)

The frontend polls `GET /cards/{id}` every 3 seconds:

```
Poll 1 (3s):  { authenticityScore: null, valueMedian: null }
Poll 2 (6s):  { authenticityScore: null, valueMedian: null }
Poll 3 (9s):  { authenticityScore: null, valueMedian: null }
Poll 4 (12s): { authenticityScore: null, valueMedian: null }
Poll 5 (15s): { authenticityScore: null, valueMedian: null }
Poll 6 (18s): { authenticityScore: null, valueMedian: null }
Poll 7 (21s): { authenticityScore: null, valueMedian: null }
Poll 8 (24s): { authenticityScore: null, valueMedian: null }
Poll 9 (27s): { authenticityScore: 0.92, valueMedian: 450 } ✓ Done!
```

### After Completion

Card detail page shows:

- ✅ Authenticity Score: 92%
- ✅ Value Range: $350 - $600
- ✅ Median Value: $450
- ✅ Comparable Sales: 15
- ✅ AI Rationale: "Strong indicators of authenticity..."

---

## Summary

When revalue is triggered:

1. **RekognitionExtract** (5-10s) - Analyzes image with Rekognition
2. **PricingAgent** (8-15s, parallel) - Fetches prices + Bedrock valuation
3. **AuthenticityAgent** (8-15s, parallel) - Computes hash + Bedrock judgment
4. **Aggregator** (2-3s) - Merges results, updates DynamoDB, emits event
5. **Total**: 15-25 seconds

**AWS Services Used:**

- S3 (read images)
- Rekognition (visual analysis)
- Bedrock (AI reasoning)
- DynamoDB (store results)
- EventBridge (event coordination)
- Secrets Manager (API keys)
- CloudWatch (logs/metrics)
- SQS (error handling)

**Result:** Card is updated with pricing and authenticity data, ready to display to user!

---

## Related Documentation

- [API Flow Documentation](./API_FLOW.md)
- [Backend Auto-Trigger Deployment](./BACKEND_AUTO_TRIGGER_DEPLOYMENT.md)
- [Step Functions Workflow](../infra/terraform/envs/hackathon/docs/STEP_FUNCTIONS_WORKFLOW.md)

---

**Last Updated:** 2024-01-15  
**Maintained By:** CollectIQ Engineering Team
