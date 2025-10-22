# Aggregator Lambda: Complete Technical Documentation

## Executive Summary

The Aggregator Lambda is the final orchestration step in CollectIQ's multi-agent card valuation pipeline. It serves as the convergence point where results from parallel AI agents (Pricing and Authenticity) are merged, enriched with OCR metadata, persisted to DynamoDB, and broadcast to downstream systems via EventBridge.

**Key Responsibilities:**

- Merge pricing and authenticity results into a unified card record
- Enrich card metadata with AI-verified OCR data
- Persist aggregated results to DynamoDB with atomic updates
- Emit EventBridge events for downstream consumers
- Handle race conditions for new card creation
- Provide observability through structured logging and tracing

**Position in Pipeline:**

```
Step Functions Workflow
  ↓
Rekognition Extract → OCR Reasoning Agent
  ↓                          ↓
  ├─→ Pricing Agent ────────┤
  └─→ Authenticity Agent ───┤
                             ↓
                      ★ AGGREGATOR ★
                             ↓
                    ┌────────┴────────┐
                    ↓                 ↓
              DynamoDB          EventBridge
                    ↓                 ↓
              Frontend      Analytics/Alerts
```

---

## Architecture Overview

### System Context

The Aggregator operates as a Lambda function invoked by AWS Step Functions after parallel agent execution completes. It receives structured results from two independent agents and combines them into a single, coherent card record.

### Input Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Step Functions Context                        │
│                                                                   │
│  • userId: string (Cognito sub)                                  │
│  • cardId: string (UUID)                                         │
│  • requestId: string (trace ID)                                  │
│  • ocrMetadata: OCR reasoning results                            │
│  • agentResults: [PricingAgentResult, AuthenticityAgentResult]   │
│  • skipCardFetch: boolean (new vs revalue)                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Aggregator Lambda                           │
│                                                                   │
│  Phase 1: Extract Agent Results                                  │
│  ├─ Pricing: valueLow, valueMedian, valueHigh, comps, sources   │
│  └─ Authenticity: score, signals, rationale, fakeDetected       │
│                                                                   │
│  Phase 2: Merge OCR Metadata (if AI-verified)                   │
│  ├─ Update card.name from OCR                                    │
│  ├─ Update card.set from OCR                                     │
│  ├─ Update card.rarity from OCR                                  │
│  └─ Update card.number from OCR                                  │
│                                                                   │
│  Phase 3: Persist to DynamoDB                                    │
│  ├─ New cards: upsertCardResults() (avoid GSI race)             │
│  └─ Existing cards: updateCard() (with ownership check)         │
│                                                                   │
│  Phase 4: Emit EventBridge Event                                 │
│  └─ CardValuationCompleted event with full context              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Output                                   │
│                                                                   │
│  • card: Complete Card object with all fields                    │
│  • requestId: string (for tracing)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Analysis

### 1. Input Structure

#### AggregatorInput Interface

```typescript
interface AggregatorInput {
  userId: string; // Cognito user ID (sub claim)
  cardId: string; // UUID for the card
  requestId: string; // Request trace ID

  // OCR metadata from OCR Reasoning Agent
  ocrMetadata?: {
    name: { value: string | null; confidence: number; rationale: string };
    rarity: { value: string | null; confidence: number; rationale: string };
    set:
      | { value: string | null; confidence: number; rationale: string }
      | {
          value: string | null;
          candidates: Array<{ value: string; confidence: number }>;
          rationale: string;
        };
    setSymbol: { value: string | null; confidence: number; rationale: string };
    collectorNumber: { value: string | null; confidence: number; rationale: string };
    copyrightRun: { value: string | null; confidence: number; rationale: string };
    illustrator: { value: string | null; confidence: number; rationale: string };
    overallConfidence: number;
    reasoningTrail: string;
    verifiedByAI?: boolean; // Critical flag - only update card if true
  };

  // Results from parallel agent execution
  agentResults: [
    {
      pricingResult: PricingResult;
      valuationSummary: ValuationSummary;
      requestId: string;
    },
    {
      authenticityResult: AuthenticityResult;
      requestId: string;
    },
  ];

  // Flag to control update strategy
  skipCardFetch?: boolean; // true for new cards, false for revalue
}
```

#### Why This Structure?

**Parallel Agent Results:**

- Step Functions executes Pricing and Authenticity agents in parallel
- Results arrive as a 2-element array (order guaranteed by Step Functions)
- Each agent includes its own requestId for independent tracing

**OCR Metadata Optional:**

- OCR Reasoning Agent may fail (network, Bedrock outage, etc.)
- Aggregator must handle missing OCR data gracefully
- `verifiedByAI` flag determines if OCR data is trustworthy

**skipCardFetch Flag:**

- New cards: Use upsert to avoid GSI eventual consistency race
- Revalue: Use normal update with ownership verification
- Critical for correctness and performance

### 2. Agent Result Extraction

#### Pricing Agent Result

```typescript
interface PricingResult {
  valueLow: number; // Minimum comparable price
  valueMedian: number; // Median price (most reliable)
  valueHigh: number; // Maximum comparable price
  compsCount: number; // Number of comparables found
  windowDays: number; // Time window for comparables (e.g., 14 days)
  sources: string[]; // Data sources (e.g., ["ebay", "tcgplayer"])
  confidence: number; // 0-1 confidence in pricing data
  volatility: number; // Price volatility metric
  message?: string; // Optional message (e.g., "No pricing data available")
}

interface ValuationSummary {
  summary: string; // Human-readable summary
  fairValue: number; // AI-determined fair market value
  trend: 'rising' | 'falling' | 'stable';
  recommendation: string; // Buy/sell/hold recommendation
  confidence: number; // 0-1 confidence in valuation
}
```

**Extraction Logic:**

```typescript
const [pricingAgentResult, authenticityAgentResult] = agentResults;
const { pricingResult, valuationSummary } = pricingAgentResult;
```

**Why Separate Result and Summary?**

- **PricingResult:** Raw data for storage and display
- **ValuationSummary:** AI-generated insights for user guidance
- Separation allows independent updates and caching strategies

#### Authenticity Agent Result

```typescript
interface AuthenticityResult {
  authenticityScore: number; // 0-1 overall authenticity score
  fakeDetected: boolean; // true if score <= 0.5
  rationale: string; // Human-readable explanation
  signals: AuthenticitySignals;
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

**Extraction Logic:**

```typescript
const { authenticityResult } = authenticityAgentResult;
```

**Why Include Individual Signals?**

- Transparency: Users can see which factors influenced the score
- Debugging: Identify which signals are underperforming
- Tuning: Adjust signal weights based on real-world feedback
- Trust: Explainable AI builds user confidence

---

### 3. Data Merging Strategy

#### Card Update Object Construction

```typescript
const cardUpdate: Partial<Card> = {
  // Pricing data (always included)
  valueLow: pricingResult.valueLow,
  valueMedian: pricingResult.valueMedian,
  valueHigh: pricingResult.valueHigh,
  compsCount: pricingResult.compsCount,
  sources: pricingResult.sources,
  valuationSummary: valuationSummary, // AI-generated valuation summary

  // Authenticity data (always included)
  authenticityScore: authenticityResult.authenticityScore,
  authenticitySignals: {
    visualHashConfidence: authenticityResult.signals.visualHashConfidence,
    textMatchConfidence: authenticityResult.signals.textMatchConfidence,
    holoPatternConfidence: authenticityResult.signals.holoPatternConfidence,
    borderConsistency: authenticityResult.signals.borderConsistency,
    fontValidation: authenticityResult.signals.fontValidation,
  },
};
```

#### Conditional OCR Metadata Merge

**Critical Decision Point:** Only update card fields if `verifiedByAI === true`

```typescript
if (ocrMetadata && ocrMetadata.verifiedByAI) {
  // Extract set value (handle both single value and candidates)
  const setInfo = ocrMetadata.set;
  const setValue =
    setInfo.value ||
    ('candidates' in setInfo && setInfo.candidates.length > 0 ? setInfo.candidates[0].value : null);

  // Update basic card fields
  if (ocrMetadata.name.value) {
    cardUpdate.name = ocrMetadata.name.value;
  }
  if (setValue) {
    cardUpdate.set = setValue;
  }
  if (ocrMetadata.rarity.value) {
    cardUpdate.rarity = ocrMetadata.rarity.value;
  }
  if (ocrMetadata.collectorNumber.value) {
    cardUpdate.number = ocrMetadata.collectorNumber.value;
  }
}
```

**Why This Conditional Logic?**

**Scenario 1: OCR Reasoning Agent Succeeds**

- `verifiedByAI = true`
- High-confidence AI-extracted metadata
- Safe to update card fields
- Improves data quality over time

**Scenario 2: OCR Reasoning Agent Fails**

- `verifiedByAI = false` or `undefined`
- Fallback OCR data (low confidence)
- Do NOT update card fields
- Prevents data corruption

**Scenario 3: OCR Reasoning Agent Not Invoked**

- `ocrMetadata = undefined`
- Legacy workflow or error
- Do NOT update card fields
- Maintains backward compatibility

#### OCR Metadata Storage

**Always store OCR metadata** (regardless of `verifiedByAI` flag) for debugging and future reprocessing:

```typescript
if (ocrMetadata) {
  const setInfo = ocrMetadata.set;
  const setValueForStorage =
    setInfo.value ||
    ('candidates' in setInfo && setInfo.candidates.length > 0 ? setInfo.candidates[0].value : null);

  cardUpdate.ocrMetadata = {
    name: ocrMetadata.name.value,
    nameConfidence: ocrMetadata.name.confidence,
    rarity: ocrMetadata.rarity.value,
    rarityConfidence: ocrMetadata.rarity.confidence,
    set: setValueForStorage,
    setConfidence:
      'confidence' in setInfo
        ? setInfo.confidence
        : 'candidates' in setInfo && setInfo.candidates.length > 0
          ? setInfo.candidates[0].confidence
          : 0.0,
    collectorNumber: ocrMetadata.collectorNumber.value,
    collectorNumberConfidence: ocrMetadata.collectorNumber.confidence,
    illustrator: ocrMetadata.illustrator.value,
    illustratorConfidence: ocrMetadata.illustrator.confidence,
    extractedAt: new Date().toISOString(),
    reasoningTrail: ocrMetadata.reasoningTrail,
    verifiedByAI: ocrMetadata.verifiedByAI,
  };
}
```

**Why Store Unverified OCR Data?**

- **Debugging:** Understand why AI verification failed
- **Reprocessing:** Retry verification later without re-running OCR
- **Analytics:** Track OCR confidence trends over time
- **Audit Trail:** Complete history of card metadata evolution

#### Pricing Message Handling

```typescript
if (pricingResult.message) {
  cardUpdate.pricingMessage = pricingResult.message;
}
```

**Example Messages:**

- "No pricing data available for this card"
- "Limited comparables found (< 3)"
- "Pricing data may be stale (> 30 days)"

**Why Include Messages?**

- User transparency: Explain why pricing might be unreliable
- Frontend display: Show warnings or disclaimers
- Support debugging: Identify data quality issues

---

### 4. DynamoDB Persistence

#### Two Update Strategies

The Aggregator uses different update strategies based on the `skipCardFetch` flag:

**Strategy 1: Upsert (New Cards)**

```typescript
if (skipCardFetch) {
  return await upsertCardResults(userId, cardId, cardUpdate, requestId);
}
```

**Strategy 2: Update with Ownership Check (Existing Cards)**

```typescript
else {
  return await updateCard(userId, cardId, cardUpdate, requestId);
}
```

#### Why Two Strategies?

**Problem: GSI Eventual Consistency**

When a new card is created:

1. Card written to DynamoDB with `PK: USER#{userId}`, `SK: CARD#{cardId}`
2. GSI (CardIdIndex) updated asynchronously
3. Aggregator tries to fetch card by `cardId` using GSI
4. **Race condition:** GSI might not be ready yet
5. Fetch fails, update fails, pipeline fails

**Solution: Conditional Logic**

- **New cards (`skipCardFetch=true`):** Use upsert, bypass GSI
- **Revalue (`skipCardFetch=false`):** Use normal update with ownership check

#### Upsert Implementation

```typescript
async function upsertCardResults(
  userId: string,
  cardId: string,
  data: Partial<Card>,
  _requestId?: string
): Promise<Card> {
  const client = getDynamoDBClient();
  const tableName = process.env.DDB_TABLE || '';

  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  // Always update updatedAt
  updateExpressions.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  // Ensure cardId attribute exists for CardIdIndex GSI
  updateExpressions.push('#cardId = :cardId');
  expressionAttributeNames['#cardId'] = 'cardId';
  expressionAttributeValues[':cardId'] = cardId;

  // Ensure userId attribute exists for GSI1
  updateExpressions.push('#userId = :userId');
  expressionAttributeNames['#userId'] = 'userId';
  expressionAttributeValues[':userId'] = userId;

  // Add fields to update
  const updateableFields = [
    'authenticityScore',
    'authenticitySignals',
    'valueLow',
    'valueMedian',
    'valueHigh',
    'compsCount',
    'sources',
    'pricingMessage',
    'valuationSummary',
    'ocrMetadata',
    'name',
    'set',
    'rarity',
    'number',
  ];

  for (const field of updateableFields) {
    if (data[field as keyof Card] !== undefined) {
      updateExpressions.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = data[field as keyof Card];
    }
  }

  const result = await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: `CARD#${cardId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  if (!result.Attributes) {
    throw new Error(`Failed to upsert card ${cardId}`);
  }

  return result.Attributes as Card;
}
```

**Key Features:**

1. **Direct PK+SK Access:** Bypasses GSI entirely
2. **Idempotent:** Can be called multiple times safely
3. **No Conditional Expression:** Creates or updates without checking existence
4. **GSI Attributes:** Explicitly sets `cardId` and `userId` for GSI consistency
5. **Dynamic Update Expression:** Only updates provided fields

**Pros:**
✅ Avoids GSI race condition
✅ Faster (no fetch before update)
✅ Idempotent (safe for retries)
✅ Simpler error handling

**Cons:**
❌ No ownership verification
❌ Could overwrite existing card (if cardId collision)
❌ No validation of existing data

**When to Use:**

- New card creation (first-time valuation)
- Known to be user's card (created in same workflow)
- Performance-critical path

#### Update with Ownership Check

```typescript
export async function updateCard(
  userId: string,
  cardId: string,
  data: Partial<Card>,
  requestId?: string
): Promise<Card> {
  // Step 1: Verify ownership
  await getCard(userId, cardId, requestId);

  // Step 2: Build update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  updateExpressions.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  const updateableFields = [
    'name',
    'set',
    'number',
    'rarity',
    'conditionEstimate',
    'backS3Key',
    'idConfidence',
    'authenticityScore',
    'authenticitySignals',
    'valueLow',
    'valueMedian',
    'valueHigh',
    'compsCount',
    'sources',
    'pricingMessage',
    'valuationSummary',
  ];

  for (const field of updateableFields) {
    if (data[field as keyof Card] !== undefined) {
      updateExpressions.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = data[field as keyof Card];
    }
  }

  // Step 3: Conditional update
  const result = await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: generateUserPK(userId),
        SK: generateCardSK(cardId),
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(PK) AND attribute_not_exists(deletedAt)',
      ReturnValues: 'ALL_NEW',
    })
  );

  return itemToCard(result.Attributes as CardItem);
}
```

**Key Features:**

1. **Ownership Verification:** Calls `getCard()` first to verify user owns card
2. **Conditional Update:** Fails if card doesn't exist or is soft-deleted
3. **Atomic Operation:** Ownership check + update in single transaction
4. **Error Handling:** Throws `NotFoundError` or `ForbiddenError` on failure

**Pros:**
✅ Security: Prevents unauthorized updates
✅ Validation: Ensures card exists and is not deleted
✅ Audit trail: Logs ownership verification
✅ Correct semantics: Update implies existence

**Cons:**
❌ Two DynamoDB operations (fetch + update)
❌ Higher latency (~50ms extra)
❌ More complex error handling
❌ Potential race condition with GSI

**When to Use:**

- Revalue operation (user-initiated)
- Manual card updates (edit metadata)
- Any operation where ownership must be verified
- Security-critical paths

#### Comparison Table

| Feature                    | Upsert               | Update with Ownership Check      |
| -------------------------- | -------------------- | -------------------------------- |
| **DynamoDB Operations**    | 1 (UpdateCommand)    | 2 (QueryCommand + UpdateCommand) |
| **Latency**                | ~25ms                | ~75ms                            |
| **Ownership Verification** | ❌ No                | ✅ Yes                           |
| **GSI Dependency**         | ❌ No                | ✅ Yes (for getCard)             |
| **Race Condition Risk**    | ❌ None              | ⚠️ GSI eventual consistency      |
| **Idempotency**            | ✅ Perfect           | ✅ Good                          |
| **Security**               | ⚠️ Assumes ownership | ✅ Verified                      |
| **Use Case**               | New card creation    | Revalue, manual edits            |

---

### 5. EventBridge Event Emission

After persisting to DynamoDB, the Aggregator emits a `CardValuationCompleted` event to EventBridge for downstream consumers.

#### Event Structure

```typescript
const eventDetail = {
  // Card identification
  cardId: card.cardId,
  userId: card.userId,
  name: card.name,
  set: card.set,

  // Pricing data
  valueLow: card.valueLow,
  valueMedian: card.valueMedian,
  valueHigh: card.valueHigh,

  // Authenticity data
  authenticityScore: card.authenticityScore,
  fakeDetected: metadata.authenticityResult.fakeDetected,

  // Metadata
  pricingConfidence: metadata.pricingResult.confidence,
  pricingSources: metadata.pricingResult.sources,
  valuationTrend: metadata.valuationSummary.trend,
  valuationFairValue: metadata.valuationSummary.fairValue,

  // OCR metadata (if available)
  ocrMetadata: card.ocrMetadata
    ? {
        name: card.ocrMetadata.name,
        nameConfidence: card.ocrMetadata.nameConfidence,
        rarity: card.ocrMetadata.rarity,
        rarityConfidence: card.ocrMetadata.rarityConfidence,
        set: card.ocrMetadata.set,
        setConfidence: card.ocrMetadata.setConfidence,
        collectorNumber: card.ocrMetadata.collectorNumber,
        illustrator: card.ocrMetadata.illustrator,
        extractedAt: card.ocrMetadata.extractedAt,
        verifiedByAI: card.ocrMetadata.verifiedByAI,
      }
    : undefined,

  // Tracing
  requestId: metadata.requestId,
  timestamp: new Date().toISOString(),
};
```

#### EventBridge Configuration

```typescript
const params: PutEventsCommandInput = {
  Entries: [
    {
      Source: 'collectiq.backend',
      DetailType: 'CardValuationCompleted',
      Detail: JSON.stringify(eventDetail),
      EventBusName: eventBusName,
    },
  ],
};
```

#### Why EventBridge?

**Decoupling:**

- Aggregator doesn't need to know about downstream consumers
- New consumers can be added without modifying Aggregator
- Consumers can be in different AWS accounts or regions

**Reliability:**

- EventBridge guarantees at-least-once delivery
- Built-in retry logic with exponential backoff
- Dead-letter queue for failed events

**Scalability:**

- EventBridge handles fan-out to multiple consumers
- No performance impact on Aggregator
- Consumers can scale independently

**Use Cases:**

- Analytics pipeline (track pricing trends)
- Alert system (notify on fake detection)
- Email notifications (card valuation complete)
- Webhook integrations (third-party services)
- Data warehouse sync (Redshift, Snowflake)

#### Error Handling

```typescript
if (response.FailedEntryCount && response.FailedEntryCount > 0) {
  logger.error('Failed to emit EventBridge event', new Error('EventBridge put failed'), {
    failedEntryCount: response.FailedEntryCount,
    entries: response.Entries,
    requestId: metadata.requestId,
  });
} else {
  logger.info('EventBridge event emitted successfully', {
    eventId: response.Entries?.[0]?.EventId,
    requestId: metadata.requestId,
  });
}
```

**Critical Design Decision:** Event emission failures do NOT fail the entire aggregation.

**Rationale:**

- DynamoDB persistence is the source of truth
- Event emission is best-effort notification
- Failing the entire workflow for event emission would be excessive
- Consumers should be designed for eventual consistency anyway

**Mitigation:**

- Log errors for monitoring and alerting
- CloudWatch alarms on event emission failures
- Consumers can poll DynamoDB as fallback
- Retry logic in EventBridge handles transient failures

---

## Data Structures

### Complete Card Schema

```typescript
interface Card {
  // Identity
  cardId: string; // UUID
  userId: string; // Cognito sub

  // Basic metadata
  name?: string; // Card name (e.g., "Charizard")
  set?: string; // Set name (e.g., "Base Set")
  number?: string; // Collector number (e.g., "4/102")
  rarity?: string; // Rarity (e.g., "Holo Rare")
  conditionEstimate?: string; // Condition (e.g., "Near Mint")

  // S3 references
  frontS3Key: string; // Required front image
  backS3Key?: string; // Optional back image

  // Identification
  idConfidence?: number; // 0-1 confidence in card identification

  // Authenticity (from Authenticity Agent)
  authenticityScore?: number; // 0-1 overall authenticity score
  authenticitySignals?: {
    visualHashConfidence: number;
    textMatchConfidence: number;
    holoPatternConfidence: number;
    borderConsistency: number;
    fontValidation: number;
  };

  // Pricing (from Pricing Agent)
  valueLow?: number; // Minimum comparable price
  valueMedian?: number; // Median price
  valueHigh?: number; // Maximum comparable price
  compsCount?: number; // Number of comparables
  sources?: string[]; // Data sources
  pricingMessage?: string; // Optional message
  valuationSummary?: ValuationSummary; // AI-generated valuation summary

  // OCR metadata (from OCR Reasoning Agent)
  ocrMetadata?: {
    name: string | null;
    nameConfidence: number;
    rarity: string | null;
    rarityConfidence: number;
    set: string | null;
    setConfidence: number;
    collectorNumber: string | null;
    collectorNumberConfidence: number;
    illustrator: string | null;
    illustratorConfidence: number;
    extractedAt: string; // ISO 8601 timestamp
    reasoningTrail: string; // AI reasoning process
    verifiedByAI: boolean; // Critical flag
  };

  // Timestamps
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}
```

### DynamoDB Item Structure

```typescript
interface CardItem {
  // Primary key
  PK: string; // "USER#{userId}"
  SK: string; // "CARD#{cardId}"

  // Entity type
  entityType: 'CARD';

  // GSI attributes
  cardId: string; // GSI: CardIdIndex (hash key)
  userId: string; // GSI1 (hash key)
  createdAt: string; // GSI1 (range key)

  // All Card fields (flattened)
  // ... (same as Card interface)

  // Soft delete
  deletedAt?: string; // ISO 8601 timestamp
}
```

**Key Design Decisions:**

1. **Single-Table Design:** All entities in one table with composite keys
2. **User Isolation:** PK includes userId for data isolation
3. **GSI for Queries:** CardIdIndex for lookup by cardId, GSI1 for user's cards
4. **Soft Delete:** `deletedAt` field for recovery and audit trail
5. **Denormalization:** All data in one item (no joins needed)

---

## Error Handling

### Error Categories

#### 1. Agent Result Errors

**Scenario:** Pricing or Authenticity agent failed

**Detection:**

```typescript
if (!pricingResult || !authenticityResult) {
  throw new Error('Missing agent results');
}
```

**Mitigation:**

- Step Functions has fallback states for agent failures
- Aggregator receives fallback results (e.g., `authenticityScore: 0.5`)
- Aggregator logs warning but continues processing

#### 2. OCR Metadata Errors

**Scenario:** OCR Reasoning Agent failed or returned low-confidence data

**Detection:**

```typescript
if (!ocrMetadata || !ocrMetadata.verifiedByAI) {
  logger.warn('OCR metadata not verified by AI', { cardId });
}
```

**Mitigation:**

- Do NOT update card fields with unverified data
- Store OCR metadata for debugging
- Continue with pricing and authenticity data

#### 3. DynamoDB Errors

**Scenario:** DynamoDB operation fails

**Common Errors:**

- `ConditionalCheckFailedException`: Card doesn't exist or is deleted
- `ProvisionedThroughputExceededException`: Rate limit exceeded
- `ServiceUnavailable`: DynamoDB outage

**Handling:**

```typescript
try {
  const updatedCard = await updateCard(userId, cardId, cardUpdate, requestId);
} catch (error) {
  if (error.name === 'ConditionalCheckFailedException') {
    throw new NotFoundError(`Card ${cardId} not found`);
  }
  throw new InternalServerError('Failed to update card');
}
```

**Mitigation:**

- Step Functions retry logic (3 attempts with exponential backoff)
- CloudWatch alarms on error rate
- Manual intervention for persistent failures

#### 4. EventBridge Errors

**Scenario:** Event emission fails

**Handling:**

```typescript
try {
  await emitCardUpdateEvent(updatedCard, metadata);
} catch (error) {
  // Log error but don't fail aggregation
  logger.error('Failed to emit EventBridge event', error, { cardId });
}
```

**Mitigation:**

- Best-effort delivery (don't fail aggregation)
- CloudWatch alarms on emission failures
- Consumers can poll DynamoDB as fallback

### Retry Strategy

**Step Functions Configuration:**

```json
{
  "Retry": [
    {
      "ErrorEquals": [
        "Lambda.ServiceException",
        "Lambda.AWSLambdaException",
        "Lambda.SdkClientException",
        "Lambda.TooManyRequestsException"
      ],
      "IntervalSeconds": 2,
      "MaxAttempts": 3,
      "BackoffRate": 2.0
    }
  ]
}
```

**Retry Schedule:**

- Attempt 1: Immediate
- Attempt 2: +2 seconds
- Attempt 3: +4 seconds
- Attempt 4: +8 seconds (final)

**Total Max Latency:** ~14 seconds (with retries)

---

## Performance Characteristics

### Latency Breakdown

**Typical Execution Time:** 100-200ms

| Phase                            | Duration   | Notes               |
| -------------------------------- | ---------- | ------------------- |
| Agent result extraction          | 1-2ms      | Pure computation    |
| OCR metadata merge               | 1-2ms      | Conditional logic   |
| DynamoDB update (upsert)         | 25-50ms    | Single operation    |
| DynamoDB update (with ownership) | 75-100ms   | Two operations      |
| EventBridge emission             | 20-30ms    | Async, non-blocking |
| Logging and tracing              | 5-10ms     | Structured logging  |
| **Total (upsert)**               | **~100ms** | New card path       |
| **Total (update)**               | **~150ms** | Revalue path        |

**With Retries (DynamoDB throttling):**

- First retry: +2s
- Second retry: +4s
- Third retry: +8s
- Maximum: ~14s

### Throughput

**Lambda Configuration:**

- Memory: 512MB
- Timeout: 30 seconds
- Reserved concurrency: 100

**Theoretical Max Throughput:**

- 100 concurrent executions
- ~150ms per execution
- **~666 cards/second**

**Practical Throughput:**

- DynamoDB write capacity: 1000 WCU
- Each card update: ~2 WCU (item size < 4KB)
- **~500 cards/second**

**Bottleneck:** DynamoDB write capacity (not Lambda)

### Cost Analysis

**Per Card Aggregation:**

| Component          | Cost            | Notes                                 |
| ------------------ | --------------- | ------------------------------------- |
| Lambda execution   | $0.0000002      | 512MB, 150ms                          |
| DynamoDB write     | $0.00000125     | 1 write (upsert) or 2 writes (update) |
| DynamoDB read      | $0.00000025     | 1 read (update with ownership)        |
| EventBridge event  | $0.000001       | 1 event                               |
| **Total (upsert)** | **~$0.0000025** | New card                              |
| **Total (update)** | **~$0.0000035** | Revalue                               |

**Monthly Cost (10,000 cards):**

- New cards: $0.025
- Revalue: $0.035
- **Total: ~$0.03-0.06/month**

**Negligible cost** - dominated by Bedrock invocations ($0.003-0.015 per card)

---

## Observability

### Structured Logging

**Log Levels:**

- `DEBUG`: Detailed field-level operations
- `INFO`: Major milestones and results
- `WARN`: Missing or unverified data
- `ERROR`: Failures requiring attention

**Key Log Events:**

```typescript
// Invocation
logger.info('Aggregator task invoked', {
  userId,
  cardId,
  skipCardFetch,
  hasOcrMetadata,
  requestId,
});

// Agent results
logger.info('Agent results received', {
  pricingCompsCount,
  pricingConfidence,
  authenticityScore,
  fakeDetected,
});

// OCR metadata
logger.info('Card metadata updated from OCR', {
  cardId,
  name,
  set,
  rarity,
  number,
});

// DynamoDB update
logger.info('Card updated successfully', {
  userId,
  cardId,
  valueLow,
  valueMedian,
  valueHigh,
  authenticityScore,
});

// EventBridge
logger.info('EventBridge event emitted successfully', {
  eventId,
  requestId,
});

// Completion
logger.info('Aggregator task completed successfully', {
  userId,
  cardId,
  requestId,
});
```

### X-Ray Tracing

**Traced Operations:**

```typescript
tracing.startSubsegment('aggregator_handler', { userId, cardId, requestId });

await tracing.trace(
  'dynamodb_update_card',
  () => updateCard(userId, cardId, cardUpdate, requestId),
  { userId, cardId, requestId }
);

await tracing.trace(
  'eventbridge_emit_card_update',
  () => emitCardUpdateEvent(updatedCard, metadata),
  { userId, cardId, requestId }
);

tracing.endSubsegment('aggregator_handler', { success: true, cardId, userId });
```

**Trace Insights:**

- End-to-end latency breakdown
- DynamoDB operation timing
- EventBridge emission timing
- Error correlation across services

### CloudWatch Metrics

**Custom Metrics:**

```typescript
await metrics.recordAuthenticityScore(authenticityResult.authenticityScore, cardId);
await metrics.recordStepFunctionExecution('success', Date.now() - startTime);
```

**Key Metrics:**

- `AggregatorInvocations` (count)
- `AggregatorLatency` (milliseconds)
- `AggregatorErrors` (count)
- `DynamoDBUpdateLatency` (milliseconds)
- `EventBridgeEmissionFailures` (count)
- `AuthenticityScoreDistribution` (histogram)

### Alerting

**Critical Alerts:**

- Aggregator error rate > 5%
- DynamoDB update failures > 10/minute
- EventBridge emission failures > 20%
- Average latency > 500ms

**Warning Alerts:**

- OCR metadata verification rate < 80%
- Pricing data unavailable rate > 10%
- Authenticity score < 0.3 (potential fake)

---

## Pros and Cons Analysis

### Overall System Pros

✅ **Separation of Concerns**

- Aggregator focuses solely on merging and persistence
- Agents handle domain-specific logic independently
- Clean boundaries enable independent testing and deployment

✅ **Parallel Agent Execution**

- Pricing and Authenticity agents run simultaneously
- Reduces total pipeline latency by ~50%
- Step Functions orchestrates parallelism automatically

✅ **Graceful Degradation**

- Continues processing even if OCR Reasoning Agent fails
- Handles missing pricing data with messages
- Fallback authenticity scores when AI unavailable

✅ **Data Consistency**

- Atomic DynamoDB updates prevent partial writes
- Conditional expressions prevent race conditions
- Idempotent operations safe for retries

✅ **Observability**

- Comprehensive structured logging
- X-Ray tracing for performance analysis
- CloudWatch metrics for monitoring

✅ **Scalability**

- Serverless architecture scales automatically
- No state management required
- Horizontal scaling to 100+ concurrent executions

✅ **Event-Driven Architecture**

- EventBridge decouples downstream consumers
- Easy to add new integrations
- Reliable event delivery with retries

✅ **Security**

- User data isolation via PK structure
- Ownership verification for updates
- IAM-based access control

### Overall System Cons

❌ **Complexity**

- Multiple update strategies (upsert vs update)
- Conditional OCR metadata merge logic
- Complex error handling across multiple services

❌ **GSI Eventual Consistency**

- Race condition for new cards
- Requires `skipCardFetch` workaround
- Potential for stale reads

❌ **Tight Coupling to Step Functions**

- Input structure dictated by Step Functions workflow
- Difficult to invoke independently for testing
- Changes to workflow require Aggregator updates

❌ **No Transactional Guarantees Across Services**

- DynamoDB update succeeds but EventBridge fails
- Consumers may miss events
- Requires eventual consistency design

❌ **Limited Rollback Capability**

- Once DynamoDB updated, no automatic rollback
- Manual intervention required for data corruption
- No versioning of card records

❌ **Single Point of Failure**

- If Aggregator fails, entire pipeline fails
- No partial success (all-or-nothing)
- Retry logic helps but doesn't eliminate risk

---

## Design Decisions and Rationale

### 1. Why Merge in Aggregator Instead of Frontend?

**Alternative:** Frontend fetches pricing and authenticity separately, merges client-side

**Chosen Approach:** Aggregator merges server-side

**Rationale:**

✅ **Single Source of Truth**

- DynamoDB contains complete, merged card record
- Frontend always gets consistent data
- No risk of client-side merge bugs

✅ **Performance**

- One API call instead of multiple
- Reduced network latency
- Smaller payload size

✅ **Simplicity**

- Frontend doesn't need merge logic
- Easier to maintain and test
- Consistent across all clients (web, mobile, API)

❌ **Cons:**

- Aggregator becomes more complex
- Harder to update individual components
- Requires full pipeline execution for any update

### 2. Why Two Update Strategies (Upsert vs Update)?

**Alternative:** Always use update with ownership check

**Chosen Approach:** Conditional logic based on `skipCardFetch`

**Rationale:**

✅ **Avoids GSI Race Condition**

- New cards: Upsert bypasses GSI
- Existing cards: Update verifies ownership
- Best of both worlds

✅ **Performance**

- Upsert is faster (1 operation vs 2)
- Critical for new card creation path
- Revalue can afford extra latency

❌ **Cons:**

- More complex code
- Two code paths to maintain
- Potential for bugs if flag set incorrectly

### 3. Why Conditional OCR Metadata Merge?

**Alternative:** Always update card fields with OCR data

**Chosen Approach:** Only update if `verifiedByAI === true`

**Rationale:**

✅ **Data Quality**

- Prevents low-confidence data from corrupting records
- AI verification ensures accuracy
- Fallback OCR data stored but not used

✅ **User Trust**

- Users see accurate card information
- Reduces support burden from incorrect data
- Builds confidence in system

❌ **Cons:**

- More complex merge logic
- OCR data wasted if not verified
- Requires AI service availability

### 4. Why Store Unverified OCR Metadata?

**Alternative:** Discard OCR data if not verified

**Chosen Approach:** Store all OCR metadata with `verifiedByAI` flag

**Rationale:**

✅ **Debugging**

- Understand why AI verification failed
- Identify patterns in low-confidence extractions
- Improve OCR Reasoning Agent over time

✅ **Reprocessing**

- Retry verification later without re-running OCR
- Batch reprocessing of failed cards
- Historical analysis of confidence trends

✅ **Audit Trail**

- Complete history of card metadata evolution
- Compliance and traceability
- Support debugging user issues

❌ **Cons:**

- Increased storage cost (minimal)
- Larger DynamoDB items
- More complex data model

### 5. Why Best-Effort EventBridge Emission?

**Alternative:** Fail aggregation if event emission fails

**Chosen Approach:** Log error but continue

**Rationale:**

✅ **Reliability**

- DynamoDB is source of truth
- Event emission is notification, not critical
- Consumers should be designed for eventual consistency

✅ **User Experience**

- User sees card valuation complete
- No confusing errors from event failures
- Faster response time

❌ **Cons:**

- Consumers may miss events
- Requires fallback polling mechanism
- Harder to debug event-driven flows

### 6. Why Single-Table DynamoDB Design?

**Alternative:** Separate tables for cards, pricing, authenticity

**Chosen Approach:** All data in one table, one item per card

**Rationale:**

✅ **Performance**

- Single read/write operation
- No joins required
- Lower latency

✅ **Consistency**

- Atomic updates across all fields
- No risk of partial updates
- Simpler transaction model

✅ **Cost**

- Fewer read/write operations
- Lower DynamoDB costs
- Simpler capacity planning

❌ **Cons:**

- Larger item size
- Less flexible schema
- Harder to query individual components

---

## Integration with CollectIQ Pipeline

### Upstream Dependencies

**1. Rekognition Extract Lambda**

- Provides `FeatureEnvelope` with OCR, borders, holo variance, fonts
- Must complete before Aggregator runs
- Failure blocks entire pipeline

**2. OCR Reasoning Agent**

- Enriches card metadata with AI-verified information
- Optional (pipeline continues if fails)
- Provides `ocrMetadata` with confidence scores

**3. Pricing Agent**

- Provides `PricingResult` and `ValuationSummary`
- Runs in parallel with Authenticity Agent
- Failure triggers fallback (zero values)

**4. Authenticity Agent**

- Provides `AuthenticityResult` with score and signals
- Runs in parallel with Pricing Agent
- Failure triggers fallback (neutral score)

### Downstream Consumers

**1. Frontend (Next.js)**

- Fetches complete card record from DynamoDB
- Displays pricing, authenticity, and metadata
- Polls for updates or uses WebSocket

**2. EventBridge Consumers**

- Analytics pipeline (track trends)
- Alert system (fake detection)
- Email notifications (valuation complete)
- Webhook integrations (third-party services)

**3. API Gateway**

- Exposes card data via REST API
- Used by mobile apps and third-party integrations
- Authenticated via Cognito JWT

### Step Functions Workflow

```json
{
  "Aggregator": {
    "Type": "Task",
    "Resource": "arn:aws:states:::lambda:invoke",
    "Parameters": {
      "FunctionName": "${aggregator_lambda_arn}",
      "Payload": {
        "userId.$": "$.userId",
        "cardId.$": "$.cardId",
        "requestId.$": "$.requestId",
        "ocrMetadata.$": "$.ocrMetadata.Payload.cardMetadata",
        "agentResults": [
          {
            "pricingResult.$": "$.parallelResults[0].pricingResult.Payload.pricingResult",
            "valuationSummary.$": "$.parallelResults[0].pricingResult.Payload.valuationSummary",
            "requestId.$": "$.parallelResults[0].pricingResult.Payload.requestId"
          },
          {
            "authenticityResult.$": "$.parallelResults[1].authenticityResult.Payload.authenticityResult",
            "requestId.$": "$.parallelResults[1].authenticityResult.Payload.requestId"
          }
        ],
        "skipCardFetch": true
      }
    },
    "ResultPath": "$.aggregatorResult",
    "Retry": [
      {
        "ErrorEquals": [
          "Lambda.ServiceException",
          "Lambda.AWSLambdaException",
          "Lambda.SdkClientException",
          "Lambda.TooManyRequestsException"
        ],
        "IntervalSeconds": 2,
        "MaxAttempts": 3,
        "BackoffRate": 2.0
      }
    ],
    "Catch": [
      {
        "ErrorEquals": ["States.ALL"],
        "ResultPath": "$.error",
        "Next": "ErrorHandler"
      }
    ],
    "End": true
  }
}
```

**Key Points:**

- Aggregator is final step before completion
- Receives merged results from parallel agents
- Retry logic handles transient failures
- Error handler catches catastrophic failures

---

## Testing Strategy

### Unit Tests

**Coverage:**

- Agent result extraction
- OCR metadata merge logic
- Card update object construction
- Error handling for missing data

**Example:**

```typescript
describe('Aggregator - Agent Result Extraction', () => {
  it('should extract pricing and authenticity results', () => {
    const input: AggregatorInput = {
      userId: 'test-user',
      cardId: 'test-card',
      requestId: 'test-request',
      agentResults: [
        {
          pricingResult: { valueLow: 10, valueMedian: 15, valueHigh: 20, ... },
          valuationSummary: { summary: 'Fair value', fairValue: 15, ... },
          requestId: 'pricing-request',
        },
        {
          authenticityResult: { authenticityScore: 0.85, fakeDetected: false, ... },
          requestId: 'authenticity-request',
        },
      ],
    };

    const [pricingResult, authenticityResult] = extractAgentResults(input);

    expect(pricingResult.valueLow).toBe(10);
    expect(authenticityResult.authenticityScore).toBe(0.85);
  });
});
```

### Integration Tests

**Coverage:**

- End-to-end Lambda execution
- DynamoDB update operations
- EventBridge event emission
- Error handling and retries

**Example:**

```typescript
describe('Aggregator Integration', () => {
  it('should persist card with pricing and authenticity data', async () => {
    const input: AggregatorInput = {
      userId: 'test-user',
      cardId: 'test-card',
      requestId: 'test-request',
      agentResults: [mockPricingResult, mockAuthenticityResult],
      skipCardFetch: true,
    };

    const result = await handler(input);

    expect(result.card.valueLow).toBe(10);
    expect(result.card.authenticityScore).toBe(0.85);

    // Verify DynamoDB persistence
    const card = await getCard('test-user', 'test-card');
    expect(card.valueLow).toBe(10);
  });
});
```

### E2E Tests

**Coverage:**

- Full Step Functions workflow
- Real DynamoDB and EventBridge
- Real agent invocations
- Error scenarios and retries

**Example:**

```typescript
describe('Full Pipeline E2E', () => {
  it('should complete card valuation workflow', async () => {
    // Upload card image
    await uploadToS3('test-card.jpg');

    // Trigger Step Functions
    const execution = await startExecution({ cardId: 'test-card' });

    // Wait for completion
    await waitForExecution(execution.executionArn);

    // Verify result
    const card = await getCardFromDynamoDB('test-card');
    expect(card.valueLow).toBeGreaterThan(0);
    expect(card.authenticityScore).toBeGreaterThan(0);
  });
});
```

---

## Troubleshooting Guide

### Issue: Aggregator Fails with "Card Not Found"

**Symptoms:**

- Error: `NotFoundError: Card {cardId} not found`
- Occurs during revalue operation
- Card exists in DynamoDB

**Possible Causes:**

1. GSI eventual consistency delay
2. Card soft-deleted (`deletedAt` set)
3. Ownership mismatch (wrong userId)

**Diagnosis:**

```bash
# Check if card exists
aws dynamodb get-item \
  --table-name collectiq-cards-hackathon \
  --key '{"PK":{"S":"USER#{userId}"},"SK":{"S":"CARD#{cardId}"}}'

# Check GSI status
aws dynamodb describe-table \
  --table-name collectiq-cards-hackathon \
  --query 'Table.GlobalSecondaryIndexes[?IndexName==`CardIdIndex`].IndexStatus'
```

**Resolution:**

- Wait for GSI to catch up (usually < 1 second)
- Verify card not soft-deleted
- Check userId matches Cognito sub

### Issue: OCR Metadata Not Updating Card Fields

**Symptoms:**

- OCR metadata stored but card.name, card.set, etc. not updated
- `verifiedByAI` flag is false

**Possible Causes:**

1. OCR Reasoning Agent failed
2. AI confidence too low
3. Bedrock service unavailable

**Diagnosis:**

```bash
# Check OCR metadata
aws logs filter-pattern "OCR metadata prepared for persistence" \
  --log-group-name /aws/lambda/aggregator

# Check verifiedByAI flag
aws logs filter-pattern "verifiedByAI" \
  --log-group-name /aws/lambda/aggregator
```

**Resolution:**

- Check OCR Reasoning Agent logs for failures
- Verify Bedrock service health
- Retry card valuation if transient failure

### Issue: EventBridge Events Not Received

**Symptoms:**

- Card updated in DynamoDB
- Downstream consumers not triggered
- No events in EventBridge

**Possible Causes:**

1. Event emission failed
2. EventBridge rule misconfigured
3. Consumer Lambda not subscribed

**Diagnosis:**

```bash
# Check event emission logs
aws logs filter-pattern "EventBridge event emitted" \
  --log-group-name /aws/lambda/aggregator

# Check EventBridge metrics
aws cloudwatch get-metric-statistics \
  --metric-name Invocations \
  --namespace AWS/Events \
  --dimensions Name=RuleName,Value=CardValuationRule
```

**Resolution:**

- Check Aggregator logs for emission errors
- Verify EventBridge rule exists and is enabled
- Check consumer Lambda permissions

### Issue: High Aggregator Latency

**Symptoms:**

- Aggregator execution > 500ms
- Step Functions workflow slow
- User complaints about slow valuation

**Possible Causes:**

1. DynamoDB throttling
2. EventBridge rate limiting
3. Large card items (> 4KB)

**Diagnosis:**

```bash
# Check X-Ray traces
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --filter-expression 'service("aggregator")'

# Check DynamoDB metrics
aws cloudwatch get-metric-statistics \
  --metric-name UserErrors \
  --namespace AWS/DynamoDB \
  --dimensions Name=TableName,Value=collectiq-cards-hackathon
```

**Resolution:**

- Increase DynamoDB provisioned capacity
- Optimize card item size (remove unnecessary fields)
- Add caching layer for frequently accessed cards

---

## Future Improvements

### 1. Versioned Card Records

**Goal:** Track card data evolution over time

**Approach:**

- Store historical versions in separate DynamoDB items
- Use `SK: CARD#{cardId}#VERSION#{timestamp}` pattern
- Query history using begins_with condition

**Benefits:**

- Audit trail for all changes
- Rollback capability
- Trend analysis (pricing over time)
- Compliance and traceability

**Implementation:**

```typescript
async function createCardVersion(card: Card): Promise<void> {
  const versionItem = {
    PK: `USER#${card.userId}`,
    SK: `CARD#${card.cardId}#VERSION#${new Date().toISOString()}`,
    ...card,
  };

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: versionItem,
    })
  );
}
```

### 2. Optimistic Locking

**Goal:** Prevent concurrent update conflicts

**Approach:**

- Add `version` field to card items
- Increment version on each update
- Use conditional expression to check version

**Benefits:**

- Prevents lost updates
- Detects concurrent modifications
- Safer for multi-user scenarios

**Implementation:**

```typescript
const result = await client.send(
  new UpdateCommand({
    TableName: tableName,
    Key: { PK, SK },
    UpdateExpression: 'SET #version = #version + :inc, ...',
    ConditionExpression: '#version = :expectedVersion',
    ExpressionAttributeNames: { '#version': 'version' },
    ExpressionAttributeValues: {
      ':expectedVersion': currentVersion,
      ':inc': 1,
    },
  })
);
```

### 3. Batch Aggregation

**Goal:** Process multiple cards in single invocation

**Approach:**

- Accept array of agent results
- Batch DynamoDB writes (up to 25 items)
- Parallel EventBridge emissions

**Benefits:**

- Higher throughput
- Lower cost per card
- Better resource utilization

**Implementation:**

```typescript
interface BatchAggregatorInput {
  cards: Array<{
    userId: string;
    cardId: string;
    agentResults: [PricingAgentResult, AuthenticityAgentResult];
  }>;
}

async function batchUpdateCards(cards: Card[]): Promise<void> {
  const batches = chunk(cards, 25);

  for (const batch of batches) {
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch.map((card) => ({
            PutRequest: { Item: cardToItem(card) },
          })),
        },
      })
    );
  }
}
```

### 4. Caching Layer

**Goal:** Reduce DynamoDB read load

**Approach:**

- Add ElastiCache (Redis) for frequently accessed cards
- Cache-aside pattern with TTL
- Invalidate on updates

**Benefits:**

- Lower latency for reads
- Reduced DynamoDB costs
- Better scalability

**Implementation:**

```typescript
async function getCachedCard(userId: string, cardId: string): Promise<Card | null> {
  const cacheKey = `card:${userId}:${cardId}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fallback to DynamoDB
  const card = await getCard(userId, cardId);

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(card));

  return card;
}
```

### 5. Partial Updates

**Goal:** Update individual fields without full merge

**Approach:**

- Accept field-specific update requests
- Only update changed fields
- Preserve existing data

**Benefits:**

- More flexible API
- Reduced payload size
- Faster updates

**Implementation:**

```typescript
interface PartialUpdateInput {
  userId: string;
  cardId: string;
  updates: {
    pricing?: Partial<PricingResult>;
    authenticity?: Partial<AuthenticityResult>;
    metadata?: Partial<CardMetadata>;
  };
}

async function partialUpdateCard(input: PartialUpdateInput): Promise<Card> {
  const updateExpression = buildDynamicUpdateExpression(input.updates);

  return await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK, SK },
      UpdateExpression: updateExpression,
      ReturnValues: 'ALL_NEW',
    })
  );
}
```

### 6. Dead Letter Queue (DLQ)

**Goal:** Capture and retry failed aggregations

**Approach:**

- Configure Lambda DLQ (SQS)
- Capture failed invocations
- Retry with exponential backoff

**Benefits:**

- No lost data
- Automatic retry mechanism
- Better error visibility

**Implementation:**

```typescript
// Lambda configuration
{
  "DeadLetterConfig": {
    "TargetArn": "arn:aws:sqs:us-east-1:123456789012:aggregator-dlq"
  }
}

// DLQ processor
async function processDLQMessage(message: SQSMessage): Promise<void> {
  const input = JSON.parse(message.Body);

  try {
    await handler(input);
    await sqs.deleteMessage({ QueueUrl, ReceiptHandle: message.ReceiptHandle });
  } catch (error) {
    // Retry later or send to manual review queue
    logger.error('DLQ processing failed', error);
  }
}
```

### 7. GraphQL API

**Goal:** Flexible querying of card data

**Approach:**

- Add AppSync GraphQL API
- Resolvers query DynamoDB
- Subscriptions for real-time updates

**Benefits:**

- Flexible client queries
- Real-time updates via WebSocket
- Better developer experience

**Implementation:**

```graphql
type Card {
  cardId: ID!
  userId: ID!
  name: String
  set: String
  pricing: PricingData
  authenticity: AuthenticityData
  ocrMetadata: OCRMetadata
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type Query {
  getCard(cardId: ID!): Card
  listCards(limit: Int, cursor: String): CardConnection
}

type Subscription {
  onCardUpdated(userId: ID!): Card @aws_subscribe(mutations: ["updateCard"])
}
```

---

## Appendix A: Example Scenarios

### Scenario 1: New Card Creation (Happy Path)

**Input:**

```json
{
  "userId": "user-123",
  "cardId": "card-456",
  "requestId": "req-789",
  "ocrMetadata": {
    "name": { "value": "Charizard", "confidence": 0.95, "rationale": "..." },
    "rarity": { "value": "Holo Rare", "confidence": 0.92, "rationale": "..." },
    "set": { "value": "Base Set", "confidence": 0.88, "rationale": "..." },
    "collectorNumber": { "value": "4/102", "confidence": 0.9, "rationale": "..." },
    "verifiedByAI": true
  },
  "agentResults": [
    {
      "pricingResult": {
        "valueLow": 150.0,
        "valueMedian": 200.0,
        "valueHigh": 250.0,
        "compsCount": 15,
        "sources": ["ebay", "tcgplayer"],
        "confidence": 0.85
      },
      "valuationSummary": {
        "summary": "Strong market demand",
        "fairValue": 200.0,
        "trend": "rising",
        "recommendation": "Hold for appreciation",
        "confidence": 0.82
      }
    },
    {
      "authenticityResult": {
        "authenticityScore": 0.91,
        "fakeDetected": false,
        "rationale": "Excellent authenticity indicators...",
        "signals": {
          "visualHashConfidence": 0.89,
          "textMatchConfidence": 0.94,
          "holoPatternConfidence": 0.88,
          "borderConsistency": 0.92,
          "fontValidation": 0.87
        },
        "verifiedByAI": true
      }
    }
  ],
  "skipCardFetch": true
}
```

**Processing:**

1. Extract agent results ✓
2. Merge OCR metadata (verifiedByAI=true) ✓
3. Construct card update object ✓
4. Upsert to DynamoDB (skipCardFetch=true) ✓
5. Emit EventBridge event ✓

**Output:**

```json
{
  "card": {
    "cardId": "card-456",
    "userId": "user-123",
    "name": "Charizard",
    "set": "Base Set",
    "rarity": "Holo Rare",
    "number": "4/102",
    "valueLow": 150.00,
    "valueMedian": 200.00,
    "valueHigh": 250.00,
    "compsCount": 15,
    "sources": ["ebay", "tcgplayer"],
    "valuationSummary": {
      "summary": "Strong market demand",
      "fairValue": 200.00,
      "trend": "rising",
      "recommendation": "Hold for appreciation",
      "confidence": 0.82
    },
    "authenticityScore": 0.91,
    "authenticitySignals": { ... },
    "ocrMetadata": { ... },
    "createdAt": "2025-10-22T10:30:00Z",
    "updatedAt": "2025-10-22T10:30:00Z"
  },
  "requestId": "req-789"
}
```

**Result:** ✅ Success - Card created with full data

---

### Scenario 2: OCR Reasoning Agent Failed

**Input:**

```json
{
  "userId": "user-123",
  "cardId": "card-456",
  "requestId": "req-789",
  "ocrMetadata": {
    "name": { "value": null, "confidence": 0.0, "rationale": "OCR reasoning agent failed" },
    "verifiedByAI": false
  },
  "agentResults": [ ... ],
  "skipCardFetch": true
}
```

**Processing:**

1. Extract agent results ✓
2. Check OCR metadata: `verifiedByAI=false` → Skip card field updates
3. Store OCR metadata for debugging ✓
4. Construct card update (pricing + authenticity only) ✓
5. Upsert to DynamoDB ✓
6. Emit EventBridge event ✓

**Output:**

```json
{
  "card": {
    "cardId": "card-456",
    "userId": "user-123",
    "name": null,  // Not updated from OCR
    "set": null,   // Not updated from OCR
    "valueLow": 150.00,
    "valueMedian": 200.00,
    "valuationSummary": {
      "summary": "Strong market demand",
      "fairValue": 200.00,
      "trend": "rising",
      "recommendation": "Hold for appreciation",
      "confidence": 0.82
    },
    "authenticityScore": 0.91,
    "ocrMetadata": {
      "name": null,
      "nameConfidence": 0.0,
      "verifiedByAI": false  // Flag indicates unverified
    },
    ...
  },
  "requestId": "req-789"
}
```

**Result:** ⚠️ Partial Success - Pricing and authenticity saved, OCR data missing

---

### Scenario 3: Revalue Existing Card

**Input:**

```json
{
  "userId": "user-123",
  "cardId": "card-456",
  "requestId": "req-999",
  "ocrMetadata": null,  // Not re-running OCR
  "agentResults": [
    {
      "pricingResult": {
        "valueLow": 180.00,  // Price increased
        "valueMedian": 230.00,
        "valueHigh": 280.00,
        ...
      }
    },
    {
      "authenticityResult": { ... }
    }
  ],
  "skipCardFetch": false  // Revalue operation
}
```

**Processing:**

1. Extract agent results ✓
2. No OCR metadata → Skip metadata merge
3. Construct card update (pricing + authenticity) ✓
4. Update with ownership check (skipCardFetch=false) ✓
   - Fetch card to verify ownership
   - Update pricing and authenticity fields
   - Preserve existing name, set, rarity
5. Emit EventBridge event ✓

**Output:**

```json
{
  "card": {
    "cardId": "card-456",
    "userId": "user-123",
    "name": "Charizard", // Preserved from original
    "set": "Base Set", // Preserved from original
    "valueLow": 180.0, // Updated
    "valueMedian": 230.0, // Updated
    "valuationSummary": {
      "summary": "Price trending upward",
      "fairValue": 230.0,
      "trend": "rising",
      "recommendation": "Strong hold",
      "confidence": 0.85
    },
    "authenticityScore": 0.91,
    "createdAt": "2025-10-22T10:30:00Z",
    "updatedAt": "2025-10-22T11:45:00Z" // New timestamp
  },
  "requestId": "req-999"
}
```

**Result:** ✅ Success - Card revalued with new pricing

---

### Scenario 4: DynamoDB Throttling with Retry

**Input:** (Same as Scenario 1)

**Processing:**

1. Extract agent results ✓
2. Merge OCR metadata ✓
3. Construct card update ✓
4. Attempt DynamoDB upsert → **ProvisionedThroughputExceededException**
5. Step Functions retry #1 (wait 2s) → **ProvisionedThroughputExceededException**
6. Step Functions retry #2 (wait 4s) → **Success** ✓
7. Emit EventBridge event ✓

**Timeline:**

- T+0ms: First attempt fails
- T+2000ms: Retry #1 fails
- T+6000ms: Retry #2 succeeds
- T+6050ms: EventBridge event emitted

**Result:** ✅ Success (after retries) - Total latency: ~6 seconds

---

## Appendix B: Configuration Reference

### Environment Variables

```bash
# DynamoDB
DDB_TABLE=collectiq-cards-hackathon

# EventBridge
EVENT_BUS_NAME=collectiq-events

# AWS Configuration
AWS_REGION=us-east-1

# Logging
LOG_LEVEL=INFO

# GSI Configuration
CARD_ID_INDEX_NAME=CardIdIndex
```

### IAM Permissions

**Lambda Execution Role:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/collectiq-cards-hackathon",
        "arn:aws:dynamodb:*:*:table/collectiq-cards-hackathon/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["events:PutEvents"],
      "Resource": "arn:aws:events:*:*:event-bus/collectiq-events"
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
FunctionName: aggregator
Runtime: nodejs20.x
Handler: dist/orchestration/aggregator.handler
MemorySize: 512
Timeout: 30
ReservedConcurrentExecutions: 100
Environment:
  Variables:
    NODE_OPTIONS: '--enable-source-maps'
    DDB_TABLE: collectiq-cards-hackathon
    EVENT_BUS_NAME: collectiq-events
Tracing: Active
```

---

## Appendix C: Glossary

**Aggregator:** Lambda function that merges agent results and persists to DynamoDB

**Agent Results:** Output from Pricing and Authenticity agents (parallel execution)

**Card Update:** Partial Card object with fields to update in DynamoDB

**EventBridge:** AWS service for event-driven architecture and pub/sub messaging

**GSI (Global Secondary Index):** DynamoDB index for querying by non-primary key attributes

**OCR Metadata:** AI-verified card information extracted from image text

**Pricing Result:** Market valuation data from Pricing Agent

**Authenticity Result:** Authenticity assessment from Authenticity Agent

**Skip Card Fetch:** Flag to control update strategy (upsert vs update with ownership check)

**Step Functions:** AWS service for orchestrating Lambda functions in workflows

**Upsert:** Database operation that inserts or updates (create if not exists, update if exists)

**Valuation Summary:** AI-generated insights and recommendations from Pricing Agent

**Verified by AI:** Flag indicating OCR data has been validated by Bedrock

---

## Appendix D: References

### AWS Documentation

- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- [Amazon DynamoDB Developer Guide](https://docs.aws.amazon.com/dynamodb/)
- [Amazon EventBridge User Guide](https://docs.aws.amazon.com/eventbridge/)
- [AWS Step Functions Developer Guide](https://docs.aws.amazon.com/step-functions/)
- [AWS X-Ray Developer Guide](https://docs.aws.amazon.com/xray/)

### Related CollectIQ Documentation

- `PRICING_AGENT_DOCUMENTATION.md` - Pricing Agent details
- `AUTHENTICITY_AGENT_DOCUMENTATION.md` - Authenticity Agent details
- `OCR_REASONING_AGENT_DOCUMENTATION.md` - OCR Reasoning Agent details
- `REKOGNITION_EXTRACT_DOCUMENTATION.md` - Feature extraction details
- `docs/Backend/Step Functions Workflow.md` - Workflow orchestration
- `docs/Backend/DynamoDB Schema.md` - Database design

### Design Patterns

- **Aggregator Pattern:** Combine results from multiple sources
- **Saga Pattern:** Distributed transaction management
- **Event Sourcing:** Track state changes as events
- **CQRS:** Separate read and write models

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
