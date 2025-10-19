# CollectIQ Frontend-Backend Architecture

## Complete System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER JOURNEY                                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. Authentication → 2. Upload → 3. Processing → 4. Results → 5. Vault Management


┌─────────────────────────────────────────────────────────────────────────────┐
│                         1. AUTHENTICATION FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

User visits app
    │
    ├─ Unauthenticated?
    │   └─→ Redirect to Cognito Hosted UI
    │       └─→ User signs in/signs up
    │           └─→ OAuth callback to /auth/callback
    │               └─→ Exchange code for JWT tokens
    │                   └─→ Store in HTTP-only cookies
    │                       └─→ Redirect to intended destination
    │
    └─ Authenticated?
        └─→ Access protected routes


┌─────────────────────────────────────────────────────────────────────────────┐
│                           2. UPLOAD FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

User selects/captures image
    │
    ├─→ Validate file (type, size)
    │   │
    │   ├─ Invalid? → Show error message
    │   │
    │   └─ Valid? → Continue
    │
    ├─→ POST /upload/presign
    │   │   Request: { filename, contentType, sizeBytes }
    │   │   Response: { uploadUrl, key, expiresIn }
    │   │
    │   └─→ PUT to S3 (direct upload)
    │       │   - Track progress with XMLHttpRequest
    │       │   - Show progress bar
    │       │
    │       └─→ POST /cards (create card record)
    │           │   Headers: { Idempotency-Key: uuid }
    │           │   Request: { frontS3Key }
    │           │   Response: Card object (analysis fields undefined)
    │           │
    │           └─→ Redirect to /cards/{cardId}


┌─────────────────────────────────────────────────────────────────────────────┐
│                        3. PROCESSING FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Card created (POST /cards)
    │
    ├─→ Step Functions workflow triggered (backend)
    │   │
    │   ├─→ Rekognition Extract (feature extraction)
    │   │
    │   ├─→ Parallel Agents:
    │   │   ├─→ Pricing Agent (multi-source valuation)
    │   │   └─→ Authenticity Agent (fake detection)
    │   │
    │   └─→ Aggregator (update card record)
    │
    └─→ Frontend polls GET /cards/{id} every 5 seconds
        │
        ├─ authenticityScore undefined OR valueLow undefined?
        │   └─→ Show processing screen
        │       └─→ Continue polling
        │
        └─ authenticityScore defined AND valueLow defined?
            └─→ Analysis complete!
                └─→ Display results


┌─────────────────────────────────────────────────────────────────────────────┐
│                          4. RESULTS DISPLAY                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Card Detail Page (/cards/{id})
    │
    ├─→ GET /cards/{id}
    │   │   Response: Complete Card object
    │   │
    │   └─→ Display:
    │       │
    │       ├─→ Card Image (from frontS3Key)
    │       │
    │       ├─→ Authenticity Section
    │       │   ├─ authenticityScore (0-1)
    │       │   └─ authenticitySignals breakdown:
    │       │       ├─ visualHashConfidence
    │       │       ├─ textMatchConfidence
    │       │       ├─ holoPatternConfidence
    │       │       ├─ borderConsistency
    │       │       └─ fontValidation
    │       │
    │       ├─→ Valuation Section
    │       │   ├─ valueLow, valueMedian, valueHigh
    │       │   ├─ compsCount
    │       │   ├─ sources[] (eBay, TCGPlayer, PriceCharting)
    │       │   └─ updatedAt timestamp
    │       │
    │       └─→ Actions
    │           ├─ Re-evaluate (POST /cards/{id}/revalue)
    │           ├─ Delete (DELETE /cards/{id})
    │           └─ Share (copy link)


┌─────────────────────────────────────────────────────────────────────────────┐
│                       5. VAULT MANAGEMENT                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Vault Page (/vault)
    │
    ├─→ GET /cards?limit=20
    │   │   Response: { items: Card[], nextCursor?: string }
    │   │
    │   └─→ Display:
    │       │
    │       ├─→ Portfolio Summary (calculated client-side)
    │       │   ├─ Total Value = sum(card.valueMedian)
    │       │   ├─ Total Cards = items.length
    │       │   └─ Sparkline (mock data for now)
    │       │
    │       ├─→ Filters (applied client-side)
    │       │   ├─ By set
    │       │   ├─ By rarity
    │       │   └─ By authenticityScore
    │       │
    │       ├─→ Sorting (applied client-side)
    │       │   ├─ By valueMedian
    │       │   ├─ By createdAt
    │       │   └─ By rarity
    │       │
    │       ├─→ Card Grid
    │       │   └─ Quick Actions:
    │       │       ├─ Refresh (POST /cards/{id}/revalue)
    │       │       └─ Delete (DELETE /cards/{id})
    │       │
    │       └─→ Load More (if nextCursor exists)
    │           └─→ GET /cards?cursor={nextCursor}&limit=20


┌─────────────────────────────────────────────────────────────────────────────┐
│                        REVALUATION FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────┘

User clicks "Refresh Valuation"
    │
    ├─→ POST /cards/{id}/revalue
    │   │   Headers: { Idempotency-Key: uuid }
    │   │   Request: { forceRefresh: true }
    │   │   Response: { executionArn, status: 'RUNNING', message }
    │   │
    │   └─→ Show toast: "Revaluation started"
    │
    └─→ Poll GET /cards/{id} every 5 seconds
        │
        ├─ updatedAt unchanged?
        │   └─→ Continue polling
        │
        └─ updatedAt changed?
            └─→ Revaluation complete!
                └─→ Update display
                    └─→ Show toast: "Valuation updated"


┌─────────────────────────────────────────────────────────────────────────────┐
│                          DELETE FLOW                                         │
└─────────────────────────────────────────────────────────────────────────────┘

User clicks "Delete"
    │
    ├─→ Show confirmation dialog
    │
    └─→ User confirms
        │
        ├─→ Optimistic update (remove from UI immediately)
        │
        ├─→ DELETE /cards/{id}
        │   │   Response: 204 No Content
        │   │
        │   ├─ Success?
        │   │   └─→ Show toast: "Card deleted"
        │   │
        │   └─ Error?
        │       └─→ Rollback (restore to UI)
        │           └─→ Show error toast


┌─────────────────────────────────────────────────────────────────────────────┐
│                       ERROR HANDLING FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

API Error Occurs
    │
    ├─→ Parse ProblemDetails response
    │   │   { type, title, status, detail, instance, requestId }
    │   │
    │   └─→ Map to user-friendly message:
    │       │
    │       ├─ 400 Bad Request → "Invalid request. Please check your input."
    │       ├─ 401 Unauthorized → Redirect to Cognito Hosted UI
    │       ├─ 403 Forbidden → "You don't have access to this resource."
    │       ├─ 404 Not Found → "Card not found."
    │       ├─ 409 Conflict → "This request was already processed."
    │       ├─ 413 Payload Too Large → "Image too large. Maximum size is 12MB."
    │       ├─ 415 Unsupported Media → "Unsupported file type. Use JPG, PNG, or HEIC."
    │       ├─ 429 Too Many Requests → "Too many requests. Please try again in {seconds}s."
    │       └─ 5xx Server Error → "Something went wrong. Please try again."
    │
    └─→ Display error toast with retry option (if applicable)


┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND ARCHITECTURE                                      │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend Request
    │
    ├─→ API Gateway (HTTP API)
    │   │
    │   ├─→ JWT Authorizer (validates Cognito token)
    │   │
    │   └─→ Lambda Handler
    │       │
    │       ├─→ Extract userId from JWT claims
    │       ├─→ Validate request with Zod schemas
    │       ├─→ Check idempotency (if POST)
    │       │
    │       └─→ Business Logic:
    │           │
    │           ├─ /upload/presign
    │           │   └─→ Generate presigned S3 URL
    │           │
    │           ├─ POST /cards
    │           │   ├─→ Create card record in DynamoDB
    │           │   └─→ Trigger Step Functions workflow
    │           │
    │           ├─ GET /cards
    │           │   └─→ Query DynamoDB with pagination
    │           │
    │           ├─ GET /cards/{id}
    │           │   └─→ Get card from DynamoDB
    │           │       └─→ Verify ownership
    │           │
    │           ├─ DELETE /cards/{id}
    │           │   └─→ Soft delete in DynamoDB
    │           │       └─→ Verify ownership
    │           │
    │           └─ POST /cards/{id}/revalue
    │               ├─→ Get card from DynamoDB
    │               ├─→ Verify ownership
    │               └─→ Trigger Step Functions workflow


┌─────────────────────────────────────────────────────────────────────────────┐
│                   STEP FUNCTIONS WORKFLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Workflow Triggered (POST /cards or POST /cards/{id}/revalue)
    │
    ├─→ 1. Rekognition Extract
    │   │   - Download image from S3
    │   │   - Extract features:
    │   │       ├─ OCR (text detection)
    │   │       ├─ Border metrics
    │   │       ├─ Holographic variance
    │   │       ├─ Font metrics
    │   │       ├─ Image quality
    │   │       └─ Image metadata
    │   │
    │   └─→ Output: FeatureEnvelope
    │
    ├─→ 2. Parallel Agents
    │   │
    │   ├─→ Pricing Agent
    │   │   ├─ Fetch comps from:
    │   │   │   ├─ eBay (completed listings)
    │   │   │   ├─ TCGPlayer (market prices)
    │   │   │   └─ PriceCharting (historical data)
    │   │   │
    │   │   ├─ Normalize and fuse data
    │   │   │
    │   │   ├─ Invoke Bedrock for valuation summary
    │   │   │
    │   │   └─→ Output: PricingResult + ValuationSummary
    │   │
    │   └─→ Authenticity Agent
    │       ├─ Compute authenticity signals:
    │       │   ├─ Visual hash confidence
    │       │   ├─ Text match confidence
    │       │   ├─ Holo pattern confidence
    │       │   ├─ Border consistency
    │       │   └─ Font validation
    │       │
    │       ├─ Invoke Bedrock for authenticity judgment
    │       │
    │       └─→ Output: AuthenticityResult
    │
    └─→ 3. Aggregator
        ├─ Update card record in DynamoDB:
        │   ├─ authenticityScore
        │   ├─ authenticitySignals
        │   ├─ valueLow, valueMedian, valueHigh
        │   ├─ compsCount
        │   ├─ sources
        │   └─ updatedAt
        │
        └─→ Emit EventBridge event (card updated)


┌─────────────────────────────────────────────────────────────────────────────┐
│                      DATA STORAGE                                            │
└─────────────────────────────────────────────────────────────────────────────┘

DynamoDB (Single-Table Design)
    │
    ├─→ Card Records
    │   │   PK: USER#{userId}
    │   │   SK: CARD#{cardId}
    │   │   Attributes: All Card fields
    │   │
    │   └─→ GSI: CardIdIndex
    │       │   PK: cardId
    │       │   SK: userId
    │       │   (For ownership verification)
    │
    ├─→ Pricing Cache
    │   │   PK: USER#{userId}
    │   │   SK: PRICE#{timestamp}
    │   │   TTL: 24 hours
    │   │
    │   └─→ Cached pricing results
    │
    └─→ Idempotency Tokens
        │   PK: USER#{userId}
        │   SK: IDEMPOTENCY#{key}
        │   TTL: 10 minutes
        │
        └─→ Prevent duplicate operations

S3 (Image Storage)
    │
    └─→ uploads/{userId}/{uuid}-{filename}
        │   - Encrypted with KMS
        │   - User-scoped access
        │   - Metadata: uploaded-by, original-filename


┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND TECH STACK                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Framework: Next.js 14 (App Router)
UI Library: React 18
Styling: Tailwind CSS v4 + shadcn/ui
Type Safety: TypeScript (non-strict mode)
Data Fetching: SWR + native fetch
Validation: Zod (shared with backend)
Authentication: Cognito Hosted UI (OAuth 2.0 + PKCE)
Charts: Recharts (lazy-loaded)
Testing: Vitest + React Testing Library + Playwright


┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND TECH STACK                                        │
└─────────────────────────────────────────────────────────────────────────────┘

Compute: AWS Lambda (Node.js 20)
API: API Gateway (HTTP API) + JWT Authorizer
Orchestration: Step Functions + EventBridge
Database: DynamoDB (single-table design)
Storage: S3 (encrypted with KMS)
AI/ML: Amazon Bedrock (Claude 4.0 Sonnet) + Rekognition
Authentication: Amazon Cognito (Hosted UI)
Monitoring: CloudWatch + X-Ray
IaC: Terraform


┌─────────────────────────────────────────────────────────────────────────────┐
│                    KEY INTEGRATION POINTS                                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. Shared Types (@collectiq/shared)
   - Zod schemas used by both frontend and backend
   - Ensures type consistency across the stack
   - Single source of truth for data structures

2. Idempotency
   - Frontend generates UUID for Idempotency-Key header
   - Backend stores in DynamoDB with 10-minute TTL
   - Prevents duplicate operations (double-click, network retry)

3. Polling
   - Frontend polls GET /cards/{id} for async operations
   - 5-second interval, 5-minute timeout
   - Checks for defined fields or updated timestamp

4. Error Handling
   - Backend returns RFC 7807 ProblemDetails
   - Frontend parses and displays user-friendly messages
   - Consistent error experience across all endpoints

5. Authentication
   - Cognito Hosted UI handles all auth flows
   - JWT tokens stored in HTTP-only cookies
   - Frontend includes cookies automatically
   - Backend validates JWT on every request


┌─────────────────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE CONSIDERATIONS                                │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend:
- Code splitting (route-based + lazy loading)
- Image optimization (Next.js Image component)
- SWR caching (stale-while-revalidate)
- Virtualization (for large card lists)
- Optimistic updates (immediate UI feedback)

Backend:
- Lambda cold start optimization (bundling with esbuild)
- DynamoDB single-table design (efficient queries)
- Pricing cache (24-hour TTL)
- Parallel agent execution (Step Functions)
- Circuit breakers (for external APIs)


┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECURITY CONSIDERATIONS                                   │
└─────────────────────────────────────────────────────────────────────────────┘

Frontend:
- JWT in HTTP-only cookies (not localStorage)
- Strict CSP (no inline scripts)
- Client-side validation (mirrors backend)
- No PII in logs or analytics

Backend:
- JWT validation on every request
- User-scoped data access (userId from JWT)
- Idempotency checks (prevent replay attacks)
- S3 encryption (KMS)
- Secrets in AWS Secrets Manager
- IAM least-privilege policies
```
