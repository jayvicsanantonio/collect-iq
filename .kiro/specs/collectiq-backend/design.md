# Design Document

## Overview

The CollectIQ backend is a serverless, event-driven system built on AWS that provides authenticated APIs for Pokémon TCG card management, real-time pricing, and AI-powered authenticity detection. The architecture follows a multi-agent orchestration pattern where specialized Lambda functions coordinate through AWS Step Functions and EventBridge to deliver scalable, intelligent card valuation and verification services.

The backend is part of a pnpm workspace monorepo, located in `services/backend/` with source code organized into `handlers/`, `agents/`, `orchestration/`, `adapters/`, `store/`, `auth/`, and `utils/` directories. It leverages shared packages from `packages/shared/` (types and schemas), `packages/config/` (build configuration), and `packages/telemetry/` (logging utilities).

The system is designed with security-first principles, using Amazon Cognito for authentication, DynamoDB for user-scoped data storage, and AWS Bedrock + Rekognition for AI capabilities. All components are provisioned via Terraform and follow serverless best practices for cost optimization and automatic scaling.

## Architecture

### High-Level Architecture Diagram

```
┌─────────────┐
│   Client    │
│  (Next.js)  │
└──────┬──────┘
       │ HTTPS + JWT
       ▼
┌─────────────────────────────────────────────────────┐
│           Amazon API Gateway (HTTP API)             │
│              + JWT Authorizer (Cognito)             │
└──────┬──────────────────────────────────────────────┘
       │
       ├─────► Lambda: upload_presign
       ├─────► Lambda: cards_create
       ├─────► Lambda: cards_list
       ├─────► Lambda: cards_get
       ├─────► Lambda: cards_delete
       └─────► Lambda: cards_revalue (triggers Step Functions)
                      │
                      ▼
       ┌──────────────────────────────────────┐
       │      AWS Step Functions Workflow     │
       │                                      │
       │  ┌────────────────────────────────┐ │
       │  │  Task 1: RekognitionExtract    │ │
       │  │  (Lambda → Rekognition)        │ │
       │  └────────────┬───────────────────┘ │
       │               │ FeatureEnvelope     │
       │               ▼                     │
       │  ┌────────────────────────────────┐ │
       │  │    Parallel Execution          │ │
       │  │  ┌──────────┐  ┌─────────────┐ │ │
       │  │  │ Pricing  │  │Authenticity │ │ │
       │  │  │  Agent   │  │   Agent     │ │ │
       │  │  │(Bedrock) │  │  (Bedrock)  │ │ │
       │  │  └──────────┘  └─────────────┘ │ │
       │  └────────────┬───────────────────┘ │
       │               │                     │
       │               ▼                     │
       │  ┌────────────────────────────────┐ │
       │  │  Task 3: Aggregator            │ │
       │  │  (Merge + Persist)             │ │
       │  └────────────────────────────────┘ │
       └──────────────┬───────────────────────┘
                      │
                      ├─────► DynamoDB (persist results)
                      └─────► EventBridge (emit events)

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   S3 Bucket  │    │   DynamoDB   │    │   Secrets    │
│   (uploads)  │    │ (single-table)│    │   Manager    │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Component Responsibilities

**API Gateway + JWT Authorizer**

- Terminates HTTPS requests from clients
- Validates Cognito JWT tokens before routing to Lambda
- Returns 401 for invalid/expired tokens
- Routes to appropriate Lambda handlers based on path/method

**Lambda Handlers (API Layer)**

- Thin handlers that validate input with Zod schemas
- Extract user identity from JWT claims (sub)
- Delegate to domain logic and adapters
- Return RFC 7807 problem+json on errors
- Emit structured logs with requestId and userId

**Step Functions Orchestrator**

- Coordinates multi-step AI workflows
- Manages task retries and error handling
- Enables parallel execution of independent agents
- Persists workflow state for observability
- Routes failures to Dead Letter Queue

**Pricing Adapters**

- Implement PriceSource interface for each marketplace
- Handle rate limiting with exponential backoff
- Normalize pricing data (conditions, currency, outliers)
- Cache results in-memory and DynamoDB
- Implement circuit breaker for failing sources

**Authenticity Pipeline**

- Extracts visual features via Rekognition
- Computes perceptual hashes and holographic metrics
- Validates text/font consistency
- Passes signals to Bedrock for AI judgment
- Returns explainable authenticity scores

**DynamoDB Store**

- Single-table design with user-scoped partitions
- GSI for efficient vault queries
- Conditional writes for idempotency
- TTL for cache and temporary data
- Encrypted at rest with KMS

## Project Structure

The backend service follows this directory organization within the monorepo:

```
services/backend/
├── src/
│   ├── handlers/          # API Gateway Lambda handlers
│   │   ├── upload_presign.ts
│   │   ├── cards_create.ts
│   │   ├── cards_list.ts
│   │   ├── cards_get.ts
│   │   ├── cards_delete.ts
│   │   └── cards_revalue.ts
│   ├── agents/            # AI agent Lambda functions
│   │   ├── pricing_agent.ts
│   │   └── authenticity_agent.ts
│   ├── orchestration/     # Step Functions task handlers
│   │   ├── rekognition_extract.ts
│   │   ├── aggregator.ts
│   │   └── error_handler.ts
│   ├── adapters/          # External service integrations
│   │   ├── rekognition_adapter.ts
│   │   ├── bedrock_service.ts
│   │   ├── pricing_service.ts
│   │   ├── ebay_adapter.ts
│   │   ├── tcgplayer_adapter.ts
│   │   └── pricecharting_adapter.ts
│   ├── store/             # DynamoDB data access layer
│   │   ├── dynamodb_client.ts
│   │   ├── card_service.ts
│   │   └── pricing_cache.ts
│   ├── auth/              # Authentication and authorization
│   │   ├── jwt_claims.ts
│   │   └── ownership.ts
│   ├── utils/             # Shared utilities
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   ├── validation.ts
│   │   ├── phash.ts
│   │   ├── idempotency.ts
│   │   └── secrets.ts
│   └── tests/             # Test files
├── esbuild.mjs            # Lambda bundling configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

**Shared Packages:**

- `packages/shared/`: TypeScript types and Zod schemas shared between frontend and backend (Card, PricingResult, AuthContext, etc.)
- `packages/config/`: Shared build, lint, and test configuration
- `packages/telemetry/`: Logging and metrics utilities that can be bundled into Lambda functions

## Components and Interfaces

### 1. Authentication Module

**Purpose:** Validate JWT tokens and extract user identity

**Interface:**

```typescript
interface AuthContext {
  sub: string; // Cognito user ID
  email: string;
  groups?: string[];
  iat: number;
  exp: number;
}

interface AuthService {
  validateToken(token: string): Promise<AuthContext>;
  extractClaims(event: APIGatewayProxyEventV2): AuthContext;
  enforceOwnership(userId: string, resourceOwnerId: string): void;
}
```

**Implementation Notes:**

- JWT validation happens at API Gateway level
- Lambda handlers re-parse claims from `event.requestContext.authorizer.jwt.claims`
- Ownership checks throw 403 ProblemDetails if userId mismatch
- No token storage in Lambda; stateless validation only

### 2. Upload Presign Handler

**Purpose:** Generate secure, time-limited S3 upload URLs

**Interface:**

```typescript
interface PresignRequest {
  filename: string;
  contentType: string; // must be in ALLOWED_UPLOAD_MIME
  sizeBytes: number; // must be <= MAX_UPLOAD_MB
}

interface PresignResponse {
  uploadUrl: string;
  key: string; // uploads/{sub}/{uuid}
  expiresIn: number; // seconds (60)
}
```

**Implementation Notes:**

- Uses AWS SDK S3 `getSignedUrl` with PutObject operation
- Key format: `uploads/{sub}/{uuid}-{sanitizedFilename}`
- Enforces MIME type and size constraints
- Sets server-side encryption headers (KMS)
- Returns 400 if validation fails

### 3. Cards CRUD Handlers

**Purpose:** Manage card metadata in user vaults

**Interface:**

```typescript
interface Card {
  cardId: string;
  userId: string; // Cognito sub
  name?: string;
  set?: string;
  number?: string;
  rarity?: string;
  conditionEstimate?: string;
  frontS3Key: string;
  backS3Key?: string;
  idConfidence?: number;
  authenticityScore?: number;
  authenticitySignals?: AuthenticitySignals;
  valueLow?: number;
  valueMedian?: number;
  valueHigh?: number;
  compsCount?: number;
  sources?: string[];
  createdAt: string;
  updatedAt: string;
}

interface CardService {
  create(userId: string, data: Partial<Card>): Promise<Card>;
  list(
    userId: string,
    limit?: number,
    cursor?: string,
  ): Promise<{ items: Card[]; nextCursor?: string }>;
  get(userId: string, cardId: string): Promise<Card>;
  update(userId: string, cardId: string, data: Partial<Card>): Promise<Card>;
  delete(userId: string, cardId: string): Promise<void>;
}
```

**Implementation Notes:**

- All operations enforce userId ownership
- DynamoDB keys: PK=`USER#{sub}`, SK=`CARD#{cardId}`
- List uses GSI1 (userId#createdAt) for chronological ordering
- Update uses conditional expressions to prevent race conditions
- Delete is soft (sets deletedAt) or hard based on configuration

### 4. Revalue Orchestration Handler

**Purpose:** Trigger Step Functions workflow for card revaluation

**Interface:**

```typescript
interface RevalueRequest {
  cardId: string;
  forceRefresh?: boolean; // bypass cache
}

interface RevalueResponse {
  executionArn: string;
  status: 'RUNNING';
  message: string;
}
```

**Implementation Notes:**

- Returns 202 Accepted immediately
- Starts Step Functions execution with input: `{ userId, cardId, s3Keys, requestId }`
- Client polls GET /cards/{id} for updated results
- Idempotency: checks for in-flight executions before starting new one

### 5. Pricing Adapters

**Purpose:** Fetch and normalize pricing data from multiple sources

**Interface:**

```typescript
interface PriceQuery {
  cardName: string;
  set?: string;
  number?: string;
  condition?: string;
  windowDays?: number; // default 14
}

interface RawComp {
  source: string;
  price: number;
  currency: string;
  condition: string;
  soldDate: string;
  listingUrl?: string;
}

interface PriceSource {
  name: string;
  fetchComps(query: PriceQuery): Promise<RawComp[]>;
  isAvailable(): Promise<boolean>; // circuit breaker check
}

interface PricingService {
  fetchAllComps(query: PriceQuery): Promise<RawComp[]>;
  normalize(comps: RawComp[]): NormalizedComp[];
  fuse(comps: NormalizedComp[]): PricingResult;
}

interface PricingResult {
  valueLow: number;
  valueMedian: number;
  valueHigh: number;
  compsCount: number;
  windowDays: number;
  sources: string[];
  confidence: number; // 0-1 based on sample size and variance
  volatility: number; // coefficient of variation
}
```

**Implementation Notes:**

- Implements adapters for eBay, TCGPlayer, PriceCharting
- Each adapter handles API-specific authentication and pagination
- Normalization: converts conditions to standard scale (Poor, Good, Excellent, Near Mint, Mint)
- Outlier removal: uses IQR method to filter extreme prices
- Fusion: computes percentiles (10th, 50th, 90th) across all sources
- Caching: stores PricingResult in DynamoDB with SK=`PRICE#{iso8601}`, TTL=300s
- Circuit breaker: tracks failure rate per source, opens after 5 consecutive failures

### 6. Rekognition Feature Extraction

**Purpose:** Extract visual and textual features from card images

**Interface:**

```typescript
interface FeatureEnvelope {
  ocr: OCRBlock[];
  borders: BorderMetrics;
  holoVariance: number;
  fontMetrics: FontMetrics;
  quality: ImageQuality;
  imageMeta: ImageMetadata;
}

interface OCRBlock {
  text: string;
  confidence: number;
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
  blurScore: number; // 0-1, higher = sharper
  glareDetected: boolean;
  brightness: number;
}

interface RekognitionAdapter {
  extractFeatures(s3Key: string): Promise<FeatureEnvelope>;
  detectText(s3Key: string): Promise<OCRBlock[]>;
  analyzeImage(s3Key: string): Promise<ImageQuality>;
}
```

**Implementation Notes:**

- Uses Rekognition DetectText for OCR
- Uses Rekognition DetectLabels for holographic detection
- Custom Lambda logic computes border ratios and font metrics
- Holographic variance computed via pixel analysis (requires image download)
- Results cached in-memory for workflow duration

### 7. Authenticity Agent

**Purpose:** Detect fake cards using visual fingerprinting and AI reasoning

**Interface:**

```typescript
interface AuthenticitySignals {
  visualHashConfidence: number; // 0-1
  textMatchConfidence: number; // 0-1
  holoPatternConfidence: number; // 0-1
  borderConsistency: number; // 0-1
  fontValidation: number; // 0-1
}

interface AuthenticityResult {
  authenticityScore: number; // 0-1
  fakeDetected: boolean; // true if score < 0.85
  rationale: string; // human-readable explanation
  signals: AuthenticitySignals;
  verifiedByAI: boolean;
}

interface AuthenticityAgent {
  analyze(features: FeatureEnvelope, cardMeta: Partial<Card>): Promise<AuthenticityResult>;
  computeVisualHash(s3Key: string): Promise<string>;
  compareWithReference(hash: string, cardName: string): Promise<number>;
}
```

**Implementation Notes:**

- Visual hash: uses perceptual hashing (pHash) algorithm
- Reference hashes stored in private S3 bucket (authentic-samples/)
- Bedrock prompt includes FeatureEnvelope and computed signals
- Bedrock returns structured JSON with score and rationale
- Signals persisted to DynamoDB for transparency and future learning
- Feedback loop: users can flag incorrect results, stored in FEEDBACK#{timestamp} items

### 8. Bedrock Integration

**Purpose:** Provide AI reasoning for valuation and authenticity

**Interface:**

```typescript
interface BedrockService {
  invokeValuation(context: ValuationContext): Promise<ValuationSummary>;
  invokeAuthenticity(context: AuthenticityContext): Promise<AuthenticityResult>;
}

interface ValuationContext {
  cardName: string;
  set: string;
  condition: string;
  pricingResult: PricingResult;
  historicalTrend?: string;
}

interface ValuationSummary {
  summary: string; // 2-3 sentences
  fairValue: number;
  trend: 'rising' | 'falling' | 'stable';
  recommendation: string;
  confidence: number;
}

interface AuthenticityContext {
  features: FeatureEnvelope;
  signals: AuthenticitySignals;
  cardMeta: Partial<Card>;
}
```

**Implementation Notes:**

- Uses Bedrock Converse API with Claude 3 Sonnet
- System prompts stored in code (not externalized)
- Temperature=0.2 for consistency
- Max tokens=2048
- Response parsing with Zod validation
- Retry logic: 3 attempts with exponential backoff
- Fallback: if Bedrock fails, return signals-only result with reduced confidence

### 9. Step Functions Workflow

**Purpose:** Orchestrate multi-agent AI pipeline

**Workflow Definition (ASL):**

```json
{
  "StartAt": "RekognitionExtract",
  "States": {
    "RekognitionExtract": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:function:rekognition-extract",
      "ResultPath": "$.features",
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "IntervalSeconds": 2,
          "MaxAttempts": 3,
          "BackoffRate": 2
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "ResultPath": "$.error",
          "Next": "HandleError"
        }
      ],
      "Next": "ParallelAgents"
    },
    "ParallelAgents": {
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
      "ResultPath": "$.agentResults",
      "Next": "Aggregator"
    },
    "Aggregator": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:function:aggregator",
      "End": true
    },
    "HandleError": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:function:error-handler",
      "End": true
    }
  }
}
```

**Implementation Notes:**

- Input: `{ userId, cardId, s3Keys: { front, back? }, requestId }`
- RekognitionExtract Lambda invokes Rekognition and returns FeatureEnvelope
- Parallel branches execute independently, reducing total latency
- Aggregator merges results, updates DynamoDB, emits EventBridge event
- Error handler persists partial results and sends to DLQ
- Execution history provides full audit trail

## Data Models

### DynamoDB Single-Table Schema

**Table Name:** `{stage}-CollectIQ`

**Primary Key:**

- PK (Partition Key): `USER#{sub}`
- SK (Sort Key): `CARD#{cardId}` | `PRICE#{iso8601}` | `FEEDBACK#{timestamp}`

**Attributes:**

```typescript
interface DynamoDBItem {
  // Keys
  PK: string;
  SK: string;

  // Common
  entityType: 'CARD' | 'PRICE' | 'FEEDBACK';

  // Card attributes
  cardId?: string;
  userId?: string;
  name?: string;
  set?: string;
  number?: string;
  rarity?: string;
  conditionEstimate?: string;
  frontS3Key?: string;
  backS3Key?: string;
  idConfidence?: number;
  authenticityScore?: number;
  authenticitySignals?: AuthenticitySignals;
  valueLow?: number;
  valueMedian?: number;
  valueHigh?: number;
  compsCount?: number;
  windowDays?: number;
  sources?: string[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;

  // Price snapshot attributes
  pricingResult?: PricingResult;

  // Feedback attributes
  feedbackType?: 'authenticity' | 'pricing' | 'identification';
  userComment?: string;

  // TTL
  ttl?: number; // Unix timestamp for auto-deletion
}
```

**Global Secondary Indexes:**

**GSI1: UserCreatedIndex**

- PK: `userId`
- SK: `createdAt`
- Purpose: List user's cards chronologically
- Projection: ALL

**GSI2: SetRarityIndex**

- PK: `set#rarity`
- SK: `valueMedian`
- Purpose: Analytics and market trends
- Projection: KEYS_ONLY

**Access Patterns:**

1. Get card by ID: Query PK=`USER#{sub}` AND SK=`CARD#{cardId}`
2. List user's cards: Query GSI1 where userId=`{sub}`, sort by createdAt DESC
3. Get recent pricing: Query PK=`USER#{sub}` AND SK begins_with `PRICE#`, limit 10
4. Get feedback: Query PK=`USER#{sub}` AND SK begins_with `FEEDBACK#`
5. Market analytics: Query GSI2 where PK=`{set}#{rarity}`

### S3 Bucket Structure

**Bucket Name:** `{stage}-collectiq-uploads-{accountId}`

**Key Structure:**

```
uploads/{sub}/{uuid}-{filename}
authentic-samples/{cardName}/{hash}.json
```

**Lifecycle Policies:**

- uploads/: Transition to Glacier after 90 days, delete after 365 days
- authentic-samples/: Never expire

**Encryption:**

- SSE-KMS with customer-managed key
- Bucket policy enforces encryption on all PutObject operations

## Error Handling

### RFC 7807 Problem Details

All API errors return JSON with the following structure:

```typescript
interface ProblemDetails {
  type: string; // URI reference (e.g., /errors/unauthorized)
  title: string; // Short, human-readable summary
  status: number; // HTTP status code
  detail: string; // Specific explanation
  instance: string; // Request ID for tracing
  [key: string]: any; // Extension members
}
```

**Example:**

```json
{
  "type": "/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "You do not have permission to access card abc-123",
  "instance": "/api/cards/abc-123",
  "requestId": "req-xyz-789",
  "userId": "user-456"
}
```

### Error Categories

**Client Errors (4xx):**

- 400 Bad Request: Invalid input (Zod validation failure)
- 401 Unauthorized: Missing or invalid JWT
- 403 Forbidden: Valid JWT but insufficient permissions
- 404 Not Found: Resource does not exist
- 409 Conflict: Idempotency key mismatch or concurrent update
- 413 Payload Too Large: Upload exceeds size limit
- 429 Too Many Requests: Rate limit exceeded

**Server Errors (5xx):**

- 500 Internal Server Error: Unhandled exception
- 502 Bad Gateway: Downstream service (Rekognition, Bedrock) failure
- 503 Service Unavailable: Circuit breaker open
- 504 Gateway Timeout: Step Functions execution timeout

### Retry and Backoff Strategy

**Lambda Retries:**

- Automatic: 2 retries with exponential backoff (AWS default)
- Custom: Implement retry logic in adapters for external APIs

**Step Functions Retries:**

- Per-task retry configuration in ASL
- Max 3 attempts, backoff rate 2.0, interval 2 seconds
- Catch-all error handler for persistent failures

**Circuit Breaker:**

- Tracks failure rate per pricing source
- Opens after 5 consecutive failures
- Half-open after 60 seconds
- Closes after 3 successful requests

**Dead Letter Queue:**

- SQS queue for failed Step Functions executions
- Retention: 14 days
- Alarm triggers on queue depth > 10

## Testing Strategy

### Unit Tests

**Scope:** Pure functions, business logic, adapters

**Tools:** Vitest, AWS SDK mocks

**Coverage Target:** 80% for src/handlers, src/adapters, src/utils

**Example Test Cases:**

- Auth: JWT claim extraction, ownership validation
- Pricing: Normalization, outlier removal, fusion logic
- Authenticity: Signal computation, hash comparison
- Validation: Zod schema edge cases

### Integration Tests

**Scope:** Lambda handlers with AWS service mocks

**Tools:** Vitest, LocalStack (S3, DynamoDB), Step Functions Local

**Example Test Cases:**

- Upload presign: Generate URL, verify signature, test expiration
- Cards CRUD: Create, list, get, update, delete with DynamoDB
- Revalue: Start Step Functions, verify execution input
- Pricing: Fetch from mock APIs, cache behavior, circuit breaker

### End-to-End Tests

**Scope:** Full API flows with real AWS services (dev environment)

**Tools:** Playwright, AWS SDK

**Example Test Cases:**

1. Auth → Upload → Identify → Value → Save
   - Sign in with Cognito
   - Request presigned URL
   - Upload image to S3
   - Create card record
   - Trigger revaluation
   - Poll for results
   - Verify DynamoDB state

2. Error Scenarios
   - Invalid JWT → 401
   - Access other user's card → 403
   - Upload oversized file → 413
   - Trigger rate limit → 429

3. Authenticity Flow
   - Upload known fake card image
   - Verify authenticityScore < 0.85
   - Check fakeDetected flag
   - Validate rationale content

### Performance Tests

**Scope:** Latency and throughput under load

**Tools:** Artillery, CloudWatch Insights

**Metrics:**

- P50, P95, P99 latency per endpoint
- Throughput (requests/second)
- Error rate
- Lambda cold start frequency

**Targets:**

- GET /cards: P95 < 200ms
- POST /upload/presign: P95 < 150ms
- POST /cards/{id}/revalue: P95 < 400ms (sync portion)

## Deployment and Operations

### Environment Configuration

**Stages:** dev, staging, prod

**Environment Variables (per Lambda):**

```bash
AWS_REGION=us-east-1
DDB_TABLE={stage}-CollectIQ
BUCKET_UPLOADS={stage}-collectiq-uploads-{accountId}
COGNITO_USER_POOL_ID={poolId}
COGNITO_CLIENT_ID={clientId}
JWKS_URL=https://cognito-idp.{region}.amazonaws.com/{poolId}/.well-known/jwks.json
ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic
MAX_UPLOAD_MB=12
EBAY_APP_ID={{resolve:secretsmanager:ebay-api-key}}
TCGPLAYER_PUBLIC_KEY={{resolve:secretsmanager:tcgplayer-public}}
TCGPLAYER_PRIVATE_KEY={{resolve:secretsmanager:tcgplayer-private}}
PRICECHARTING_KEY={{resolve:secretsmanager:pricecharting-key}}
CACHE_TTL_SECONDS=300
IDEMPOTENCY_TTL_SECONDS=600
STEP_FUNCTIONS_ARN=arn:aws:states:{region}:{account}:stateMachine:{stage}-collectiq-revalue
EVENT_BUS_NAME={stage}-collectiq-events
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_MAX_TOKENS=2048
BEDROCK_TEMPERATURE=0.2
```

### Observability

**CloudWatch Logs:**

- Log group per Lambda: `/aws/lambda/{stage}-{functionName}`
- Retention: 30 days (dev), 90 days (prod)
- Structured JSON format with requestId, userId, operation

**CloudWatch Metrics:**

- Custom metrics: `CollectIQ/{stage}/{metric}`
- Metrics: ApiLatency, AuthFailures, PricingSourceErrors, AuthenticityScores, StepFunctionsExecutions

**X-Ray Tracing:**

- Enabled on all Lambdas and Step Functions
- Service map shows dependencies
- Trace retention: 30 days

**Dashboards:**

- API Performance: Latency, error rate, throughput per endpoint
- AI Agents: Bedrock invocations, Rekognition calls, authenticity score distribution
- Data: DynamoDB read/write capacity, S3 upload volume
- Costs: Lambda invocations, Bedrock tokens, Rekognition images

**Alarms:**

- API error rate > 5% for 5 minutes
- P95 latency > 1000ms for 5 minutes
- DLQ depth > 10 messages
- Pricing source circuit breaker open
- Cognito authentication failures > 100/minute

### Security Considerations

**IAM Roles:**

- Separate role per Lambda with least-privilege permissions
- S3: GetObject (own bucket), PutObject (presigned only)
- DynamoDB: Query, GetItem, PutItem, UpdateItem, DeleteItem (scoped to table)
- Rekognition: DetectText, DetectLabels
- Bedrock: InvokeModel (specific model ARN)
- Secrets Manager: GetSecretValue (specific secret ARNs)
- Step Functions: StartExecution (specific state machine ARN)

**Secrets Management:**

- API keys stored in AWS Secrets Manager
- Rotation enabled for long-lived credentials
- Lambda retrieves secrets at runtime (not baked into environment)

**Network Security:**

- API Gateway: HTTPS only, no HTTP
- Lambda: VPC not required (uses AWS PrivateLink for service access)
- S3: Bucket policy enforces encryption and denies public access
- DynamoDB: VPC endpoint for private access (optional)

**Data Protection:**

- S3: SSE-KMS with customer-managed key
- DynamoDB: Encryption at rest enabled
- CloudWatch Logs: Encrypted with KMS
- No PII in logs (userId is Cognito sub, not email)

## Future Enhancements

1. **GraphQL API:** Replace REST with AppSync for real-time subscriptions
2. **Batch Processing:** Support bulk uploads via S3 event triggers
3. **Advanced Analytics:** Aggregate market trends, portfolio valuation
4. **Mobile Offline:** On-device ML models for instant identification
5. **Blockchain Provenance:** QLDB integration for immutable authenticity certificates
6. **Partner Integrations:** PSA/CGC grading APIs, eBay listing automation
7. **Multi-TCG Support:** Extend to Magic, Yu-Gi-Oh!, One Piece
8. **Social Features:** Share collections, trade recommendations
9. **Marketplace:** Built-in buy/sell with escrow
10. **AR Scanning:** Multi-angle holographic analysis via smartphone sensors
