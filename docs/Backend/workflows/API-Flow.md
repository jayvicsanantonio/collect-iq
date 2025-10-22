# CollectIQ API Flow Documentation

## Overview

This document describes the complete API flow for CollectIQ, including Lambda function interactions, Step Functions orchestration, and frontend integration.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Lambda Functions](#lambda-functions)
3. [API Endpoints](#api-endpoints)
4. [User Flows](#user-flows)
5. [Step Functions Workflow](#step-functions-workflow)
6. [Auto-Trigger Configuration](#auto-trigger-configuration)

---

## Architecture Overview

CollectIQ uses a serverless architecture with:

- **API Gateway** - HTTP API with JWT authentication
- **Lambda Functions** - Serverless compute for API handlers and AI agents
- **Step Functions** - Orchestrates multi-agent AI workflow
- **DynamoDB** - Single-table design for card data
- **S3** - Secure image storage with presigned URLs
- **EventBridge** - Event-driven architecture for extensibility

### Data Flow

```
Frontend → API Gateway → Lambda Handler → DynamoDB/S3
                              ↓
                    Step Functions (orchestration)
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
            Rekognition          Bedrock Agents
                    ↓                   ↓
                    └─────────┬─────────┘
                              ↓
                        Aggregator Lambda
                              ↓
                    DynamoDB + EventBridge
```

---

## Lambda Functions

### API Handler Functions (Triggered by API Gateway)

#### 1. `upload_presign`

- **Endpoint:** `POST /upload/presign`
- **Purpose:** Generate presigned S3 URLs for secure image uploads
- **Authentication:** Required (JWT)
- **When Called:** User initiates card image upload
- **Returns:** Presigned URL (60s expiration) and S3 key

**Request:**

```json
{
  "filename": "charizard.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 2048576
}
```

**Response:**

```json
{
  "uploadUrl": "https://s3.amazonaws.com/...",
  "key": "uploads/user123/uuid-charizard.jpg",
  "expiresIn": 60
}
```

#### 2. `cards_create`

- **Endpoint:** `POST /cards`
- **Purpose:** Create new card record in DynamoDB
- **Authentication:** Required (JWT)
- **When Called:** After successful S3 upload
- **Returns:** Card object with initial metadata

**Request:**

```json
{
  "frontS3Key": "uploads/user123/uuid-charizard.jpg",
  "backS3Key": "uploads/user123/uuid-charizard-back.jpg",
  "name": "Charizard",
  "set": "Base Set",
  "number": "4",
  "rarity": "Holo Rare",
  "conditionEstimate": "Near Mint"
}
```

**Response:**

```json
{
  "cardId": "123e4567-e89b-12d3-a456-426614174000",
  "userId": "user123",
  "frontS3Key": "uploads/user123/uuid-charizard.jpg",
  "name": "Charizard",
  "set": "Base Set",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### 3. `cards_list`

- **Endpoint:** `GET /cards`
- **Purpose:** List user's cards with pagination
- **Authentication:** Required (JWT)
- **When Called:** User views vault/collection
- **Returns:** Array of cards with pagination cursor

**Query Parameters:**

- `limit` (optional): Number of cards per page (1-100, default 20)
- `cursor` (optional): Pagination cursor from previous response

**Response:**

```json
{
  "items": [
    {
      "cardId": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Charizard",
      "valueMedian": 450.0,
      "authenticityScore": 0.92
    }
  ],
  "nextCursor": "eyJjYXJkSWQiOiIxMjMifQ=="
}
```

#### 4. `cards_get`

- **Endpoint:** `GET /cards/{id}`
- **Purpose:** Retrieve specific card details
- **Authentication:** Required (JWT)
- **When Called:** User views card detail page
- **Returns:** Complete card object

**Response:**

```json
{
  "cardId": "123e4567-e89b-12d3-a456-426614174000",
  "userId": "user123",
  "frontS3Key": "uploads/user123/uuid-charizard.jpg",
  "name": "Charizard",
  "set": "Base Set",
  "number": "4",
  "rarity": "Holo Rare",
  "authenticityScore": 0.92,
  "valueLow": 350.0,
  "valueMedian": 450.0,
  "valueHigh": 600.0,
  "compsCount": 15,
  "sources": ["ebay", "tcgplayer"],
  "authenticitySignals": {
    "visualHashConfidence": 0.95,
    "textMatchConfidence": 0.9,
    "holoPatternConfidence": 0.88
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

#### 5. `cards_delete`

- **Endpoint:** `DELETE /cards/{id}`
- **Purpose:** Delete card from vault
- **Authentication:** Required (JWT)
- **When Called:** User removes card
- **Returns:** 204 No Content

#### 6. `cards_revalue`

- **Endpoint:** `POST /cards/{id}/revalue`
- **Purpose:** Trigger Step Functions workflow for AI analysis
- **Authentication:** Required (JWT)
- **When Called:**
  - User clicks "Retry Analysis" on card detail page
  - User clicks "Refresh" on vault page
  - **Automatically after card creation (optional)**
- **Returns:** Step Functions execution ARN

**Request:**

```json
{
  "forceRefresh": true
}
```

**Response:**

```json
{
  "executionArn": "arn:aws:states:us-east-1:123456789012:execution:...",
  "status": "RUNNING",
  "message": "Card revaluation started successfully"
}
```

**Idempotency:** If a workflow is already running for the card, returns existing execution ARN instead of starting a new one.

#### 7. `healthz`

- **Endpoint:** `GET /healthz`
- **Purpose:** Health check for monitoring
- **Authentication:** Not required
- **Returns:** Service status

---

### Orchestration Functions (Triggered by Step Functions)

#### 8. `rekognition_extract`

- **Triggered By:** Step Functions (first step)
- **Purpose:** Extract visual features using Amazon Rekognition
- **Processes:** OCR text, holographic patterns, blur score, quality metrics
- **Input:** userId, cardId, s3Keys (front/back)
- **Output:** FeatureEnvelope with extracted data

#### 9. `pricing_agent`

- **Triggered By:** Step Functions (parallel branch)
- **Purpose:** Fetch market pricing from multiple sources
- **APIs Used:** eBay, TCGPlayer, PriceCharting
- **AI Model:** Bedrock (Claude) for valuation summary
- **Output:** PricingResult with confidence scores

#### 10. `authenticity_agent`

- **Triggered By:** Step Functions (parallel branch)
- **Purpose:** Verify card authenticity
- **Techniques:** Perceptual hashing, holographic analysis, text matching
- **AI Model:** Bedrock (Claude) for authenticity judgment
- **Output:** AuthenticityResult with fake detection flag

#### 11. `aggregator`

- **Triggered By:** Step Functions (final step)
- **Purpose:** Merge results and persist to DynamoDB
- **Actions:**
  - Updates card record with pricing and authenticity data
  - Emits EventBridge event for downstream consumers
- **Output:** Updated card object

#### 12. `error_handler`

- **Triggered By:** Step Functions (on error)
- **Purpose:** Handle workflow failures gracefully
- **Actions:**
  - Persists partial results if available
  - Sends error details to Dead Letter Queue (SQS)
  - Logs error for debugging
- **Output:** Error handling result

---

## API Endpoints

### Summary Table

| Endpoint              | Method | Auth | Purpose             | Triggers Lambda                  |
| --------------------- | ------ | ---- | ------------------- | -------------------------------- |
| `/upload/presign`     | POST   | ✓    | Get S3 upload URL   | `upload_presign`                 |
| `/cards`              | POST   | ✓    | Create card record  | `cards_create`                   |
| `/cards`              | GET    | ✓    | List user's cards   | `cards_list`                     |
| `/cards/{id}`         | GET    | ✓    | Get card details    | `cards_get`                      |
| `/cards/{id}`         | DELETE | ✓    | Delete card         | `cards_delete`                   |
| `/cards/{id}/revalue` | POST   | ✓    | Trigger AI analysis | `cards_revalue` → Step Functions |
| `/healthz`            | GET    | ✗    | Health check        | `healthz`                        |

---

## User Flows

### Flow 1: Manual Upload with Manual Analysis (Current)

```
1. User uploads image
   ↓
2. Frontend: POST /upload/presign
   ↓
3. Frontend: PUT to S3 (presigned URL)
   ↓
4. Frontend: POST /cards (create record)
   ↓
5. Frontend: Redirect to /cards/{id}
   ↓
6. User clicks "Analyze Card" button
   ↓
7. Frontend: POST /cards/{id}/revalue
   ↓
8. Step Functions workflow starts
   ↓
9. Frontend: Polls GET /cards/{id} every 3s
   ↓
10. Card detail page shows results
```

**Pros:**

- User has control over when to trigger expensive AI analysis
- Can review/edit metadata before analysis
- Avoids unnecessary API costs for test uploads

**Cons:**

- Extra click required
- Not fully automated experience

---

### Flow 2: Automatic Analysis After Upload (IMPLEMENTED - Backend EventBridge)

```
1. User uploads image
   ↓
2. Frontend: POST /upload/presign
   ↓
3. Frontend: PUT to S3 (presigned URL)
   ↓
4. Frontend: POST /cards (create record)
   ↓
5. Backend: cards_create Lambda emits "CardCreated" event to EventBridge
   ↓
6. EventBridge: Rule triggers Step Functions automatically
   ↓
7. Step Functions workflow starts
   ↓
8. Frontend: Redirect to /cards/{id}
   ↓
9. Frontend: Polls GET /cards/{id} every 3s
   ↓
10. Card detail page shows processing → results
```

**Pros:**

- ✅ Seamless user experience
- ✅ No extra clicks required
- ✅ Immediate feedback on card analysis
- ✅ Backend-driven (decoupled architecture)
- ✅ Event-driven (easy to extend with notifications, analytics)
- ✅ Production-ready

**Cons:**

- Triggers AI analysis for every upload (cost consideration)
- Cannot review metadata before analysis (by design)

---

### Flow 3: Refresh Valuation (Existing Card)

```
1. User views card in vault
   ↓
2. User clicks "Refresh" button
   ↓
3. Frontend: POST /cards/{id}/revalue
   ↓
4. Step Functions workflow starts
   ↓
5. Frontend: Shows "Refreshing..." toast
   ↓
6. Frontend: Polls GET /cards/{id} every 3s
   ↓
7. Updated pricing/authenticity displayed
```

**Use Cases:**

- Get latest market prices
- Re-check authenticity with updated reference data
- Retry failed analysis

---

## Step Functions Workflow

### Workflow Diagram

```
START
  ↓
RekognitionExtract (Lambda)
  ↓
ParallelAgents
  ├─→ PricingAgent (Lambda)
  │     ├─ Fetch eBay prices
  │     ├─ Fetch TCGPlayer prices
  │     ├─ Fetch PriceCharting prices
  │     └─ Bedrock valuation summary
  │
  └─→ AuthenticityAgent (Lambda)
        ├─ Compute perceptual hash
        ├─ Compare with reference hashes
        ├─ Analyze holographic patterns
        └─ Bedrock authenticity judgment
  ↓
Aggregator (Lambda)
  ├─ Merge results
  ├─ Update DynamoDB
  └─ Emit EventBridge event
  ↓
END

(On Error: ErrorHandler Lambda)
```

### State Machine Definition

Located at: `infra/terraform/envs/hackathon/state-machine-definition.json`

**Key Features:**

- **Parallel Execution:** Pricing and authenticity agents run simultaneously
- **Retry Logic:** Automatic retries with exponential backoff
- **Error Handling:** Fallback values if agents fail
- **Idempotency:** Prevents duplicate executions for same card

### Execution Time

- **Rekognition Extract:** ~5-10 seconds
- **Pricing Agent:** ~8-15 seconds (parallel)
- **Authenticity Agent:** ~8-15 seconds (parallel)
- **Aggregator:** ~2-3 seconds
- **Total:** ~15-25 seconds (due to parallel execution)

---

## Auto-Trigger Configuration

### ✅ Implemented: Backend Auto-Trigger (EventBridge)

**This is the production implementation used in CollectIQ.**

The backend automatically triggers AI analysis via EventBridge when cards are created.

### ❌ Not Implemented: Frontend Auto-Trigger

This approach is NOT recommended and NOT implemented.

**File:** `apps/web/app/(protected)/upload/page.tsx`

**Change:**

```typescript
// Step 4: Create card record with S3 key
const card = await api.createCard({
  frontS3Key: presignResponse.key,
});

// Step 5: Automatically trigger AI analysis
await api.revalueCard(card.cardId, { forceRefresh: false });

// Step 6: Redirect to card detail/processing screen
router.push(`/cards/${card.cardId}`);
```

**Pros:**

- Simple implementation
- Frontend controls the flow
- Easy to add conditional logic (e.g., skip for certain users)

**Cons:**

- Requires two API calls from frontend
- Slight delay between card creation and analysis start

---

### Option 2: Backend Auto-Trigger (EventBridge)

Use EventBridge to automatically trigger revaluation when a card is created.

**Implementation:**

1. **Modify `cards_create` Lambda** to emit EventBridge event:

```typescript
// After creating card in DynamoDB
await eventBridgeClient.send(
  new PutEventsCommand({
    Entries: [
      {
        Source: 'collectiq.cards',
        DetailType: 'CardCreated',
        Detail: JSON.stringify({
          cardId: card.cardId,
          userId: card.userId,
          frontS3Key: card.frontS3Key,
          timestamp: new Date().toISOString(),
        }),
        EventBusName: process.env.EVENT_BUS_NAME,
      },
    ],
  })
);
```

2. **Add EventBridge Rule** in `infra/terraform/envs/hackathon/main.tf`:

```hcl
event_rules = {
  card_created_auto_revalue = {
    description = "Auto-trigger revaluation when card is created"
    event_pattern = jsonencode({
      source      = ["collectiq.cards"]
      detail-type = ["CardCreated"]
    })
    target_arn           = module.step_functions.state_machine_arn
    target_type          = "stepfunctions"
    input_transformer = {
      input_paths = {
        cardId = "$.detail.cardId"
        userId = "$.detail.userId"
        frontS3Key = "$.detail.frontS3Key"
      }
      input_template = <<EOF
{
  "userId": <userId>,
  "cardId": <cardId>,
  "s3Keys": {
    "front": <frontS3Key>
  },
  "requestId": "$$.Execution.Name"
}
EOF
    }
  }
}
```

**Pros:**

- Fully automated backend flow
- Decoupled architecture
- No frontend changes needed
- Can add additional event consumers easily

**Cons:**

- More complex infrastructure
- Harder to debug
- Eventual consistency (slight delay)

---

### Option 3: Lambda Direct Invocation

Have `cards_create` Lambda directly invoke Step Functions.

**Implementation:**

Modify `services/backend/src/handlers/cards_create.ts`:

```typescript
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

// After creating card
if (process.env.AUTO_TRIGGER_REVALUE === 'true') {
  const sfnClient = new SFNClient({ region: process.env.AWS_REGION });

  await sfnClient.send(
    new StartExecutionCommand({
      stateMachineArn: process.env.STEP_FUNCTIONS_ARN,
      name: `${card.cardId}-${Date.now()}`,
      input: JSON.stringify({
        userId: card.userId,
        cardId: card.cardId,
        s3Keys: {
          front: card.frontS3Key,
          ...(card.backS3Key && { back: card.backS3Key }),
        },
        requestId: event.requestContext.requestId,
      }),
    })
  );
}
```

**Pros:**

- Immediate execution
- Simple implementation
- Synchronous flow

**Cons:**

- Tight coupling between Lambdas
- Increases `cards_create` execution time
- Harder to disable/configure

---

## Recommendation

**Use Option 1 (Frontend Auto-Trigger)** for:

- Quick implementation
- Easy testing and debugging
- Flexibility to add UI controls (e.g., "Skip analysis" checkbox)

**Use Option 2 (EventBridge)** for:

- Production-grade architecture
- Multiple event consumers (notifications, analytics, etc.)
- Fully decoupled services

**Avoid Option 3** unless you need guaranteed synchronous execution.

---

## Configuration Examples

### Enable Auto-Trigger in Frontend

```typescript
// apps/web/lib/config.ts
export const FEATURES = {
  AUTO_TRIGGER_REVALUE: true, // Set to false to disable
  REVALUE_FORCE_REFRESH: false, // Use cached data if available
};

// apps/web/app/(protected)/upload/page.tsx
if (FEATURES.AUTO_TRIGGER_REVALUE) {
  await api.revalueCard(card.cardId, {
    forceRefresh: FEATURES.REVALUE_FORCE_REFRESH,
  });
}
```

### Enable Auto-Trigger via Environment Variable

```bash
# apps/web/.env.local
NEXT_PUBLIC_AUTO_TRIGGER_REVALUE=true
NEXT_PUBLIC_REVALUE_FORCE_REFRESH=false
```

---

## Monitoring and Debugging

### CloudWatch Logs

Each Lambda function logs to CloudWatch:

- `/aws/lambda/collectiq-hackathon-cards-create`
- `/aws/lambda/collectiq-hackathon-cards-revalue`
- `/aws/lambda/collectiq-hackathon-rekognition-extract`
- `/aws/lambda/collectiq-hackathon-pricing-agent`
- `/aws/lambda/collectiq-hackathon-authenticity-agent`
- `/aws/lambda/collectiq-hackathon-aggregator`

### Step Functions Execution History

View execution details in AWS Console:

1. Navigate to Step Functions
2. Select `collectiq-hackathon-card-valuation` state machine
3. View execution history with input/output for each step

### X-Ray Tracing

Distributed tracing enabled for:

- API Gateway requests
- Lambda invocations
- Step Functions executions
- AWS SDK calls (DynamoDB, S3, Rekognition, Bedrock)

---

## Error Handling

### Common Errors

| Error                        | Cause                         | Resolution                                    |
| ---------------------------- | ----------------------------- | --------------------------------------------- |
| `404 Not Found`              | Card doesn't exist            | Verify cardId is correct                      |
| `403 Forbidden`              | User doesn't own card         | Check JWT claims                              |
| `409 Conflict`               | Workflow already running      | Wait for completion or use existing execution |
| `413 Payload Too Large`      | Image > 12MB                  | Compress image before upload                  |
| `415 Unsupported Media Type` | Invalid image format          | Use JPG, PNG, or HEIC                         |
| `500 Internal Server Error`  | Lambda/Step Functions failure | Check CloudWatch logs                         |

### Retry Strategy

- **API Gateway:** No automatic retry (client handles)
- **Lambda:** 3 retries with exponential backoff
- **Step Functions:** 3 retries per task with 2x backoff
- **EventBridge:** 3 retries over 24 hours

---

## Security Considerations

### Authentication

- All API endpoints (except `/healthz`) require valid Cognito JWT
- JWT validated by API Gateway authorizer
- User ID extracted from `sub` claim

### Authorization

- User-scoped data isolation via DynamoDB partition key (`USER#{sub}`)
- S3 presigned URLs scoped to user's upload path
- Card ownership verified before any operation

### Data Protection

- S3 encryption at rest (SSE-S3)
- DynamoDB encryption at rest (AWS managed keys)
- TLS 1.2+ for all API communication
- Presigned URLs expire in 60 seconds

---

## Performance Optimization

### Caching Strategy

- Frontend: SWR for client-side caching
- Backend: DynamoDB for pricing cache (14-day TTL)
- CDN: CloudFront for static assets (future)

### Parallel Execution

- Pricing and authenticity agents run simultaneously
- Reduces total workflow time by ~50%

### Polling Optimization

- Frontend polls every 3 seconds during processing
- Stops polling when card is complete
- Uses exponential backoff on errors

---

## Cost Optimization

### Lambda

- Right-sized memory allocation (512MB-1024MB)
- VPC endpoints to avoid NAT Gateway costs
- Provisioned concurrency disabled (on-demand only)

### Step Functions

- Standard workflow (not Express) for auditability
- Minimal logging (ERROR level only)
- No execution data logging

### AI Services

- Rekognition: Pay per image analyzed
- Bedrock: Pay per token (input + output)
- Pricing APIs: Cached for 14 days to reduce calls

---

## Future Enhancements

### Planned Features

1. **Batch Upload:** Upload multiple cards at once
2. **Background Sync:** Periodic revaluation for all cards
3. **Webhooks:** Notify users when analysis completes
4. **Price Alerts:** EventBridge rule for price changes
5. **Export:** Download vault as CSV/PDF

### Architecture Improvements

1. **GraphQL API:** Replace REST with AppSync
2. **Real-time Updates:** WebSocket for live progress
3. **CDN Integration:** CloudFront for image delivery
4. **Multi-region:** Deploy to multiple AWS regions

---

## Related Documentation

- [Project Specification](../docs/Project%20Specification.md)
- [Backend Architecture](../docs/Backend/Architecture.md)
- [Frontend Architecture](../docs/Frontend/Architecture.md)
- [Infrastructure Guide](../infra/terraform/README.md)

---

## Support

For questions or issues:

1. Check CloudWatch logs for error details
2. Review Step Functions execution history
3. Consult this documentation
4. Contact DevOps team

---

**Last Updated:** 2024-01-15  
**Version:** 1.0.0  
**Maintained By:** CollectIQ Engineering Team
