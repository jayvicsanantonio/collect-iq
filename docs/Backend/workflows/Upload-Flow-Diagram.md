# Upload Flow Visual Diagram

## Complete Upload Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STEP 1: GET PERMISSION                          │
│                                                                         │
│  ┌──────────┐                                                          │
│  │ Frontend │                                                          │
│  │  (React) │                                                          │
│  └────┬─────┘                                                          │
│       │                                                                │
│       │ POST /upload/presign                                           │
│       │ {                                                              │
│       │   "filename": "charizard.jpg",                                 │
│       │   "contentType": "image/jpeg",                                 │
│       │   "sizeBytes": 2048576                                         │
│       │ }                                                              │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────────────────────────────────────────────────┐              │
│  │         API Gateway (JWT Authorizer)                │              │
│  │  ✓ Validates JWT token                             │              │
│  │  ✓ Extracts user ID from token                     │              │
│  └────┬────────────────────────────────────────────────┘              │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────────────────────────────────────────────────┐              │
│  │         upload_presign Lambda                       │              │
│  │                                                     │              │
│  │  1. Authenticate user (getUserId from JWT)         │              │
│  │  2. Validate file size (< 12 MB)                   │              │
│  │  3. Validate MIME type (jpg/png/heic)              │              │
│  │  4. Generate unique S3 key:                        │              │
│  │     uploads/{userId}/{uuid}-{filename}             │              │
│  │  5. Create PutObjectCommand                        │              │
│  │  6. Generate presigned URL (60s expiry)            │              │
│  │                                                     │              │
│  │  ┌──────────────────────────────────────┐          │              │
│  │  │  S3Client.getSignedUrl()             │          │              │
│  │  │  - Creates temporary permission      │          │              │
│  │  │  - Scoped to specific S3 key         │          │              │
│  │  │  - Expires in 60 seconds             │          │              │
│  │  └──────────────────────────────────────┘          │              │
│  └────┬────────────────────────────────────────────────┘              │
│       │                                                                │
│       │ Returns:                                                       │
│       │ {                                                              │
│       │   "uploadUrl": "https://s3.../uploads/user123/uuid-file.jpg?X-Amz-...",
│       │   "key": "uploads/user123/uuid-charizard.jpg",                │
│       │   "expiresIn": 60                                             │
│       │ }                                                              │
│       │                                                                │
│       ▼                                                                │
│  ┌──────────┐                                                          │
│  │ Frontend │ ← Receives presigned URL                                │
│  └──────────┘                                                          │
└─────────────────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────────────────┐
│                         STEP 2: UPLOAD FILE                             │
│                                                                         │
│  ┌──────────┐                                                          │
│  │ Frontend │                                                          │
│  └────┬─────┘                                                          │
│       │                                                                │
│       │ PUT {presignedUrl}                                             │
│       │ Headers:                                                       │
│       │   Content-Type: image/jpeg                                     │
│       │   Content-Length: 2048576                                      │
│       │ Body: <binary file data>                                       │
│       │                                                                │
│       │ ⚡ DIRECT CONNECTION (No Lambda!)                              │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────────────────────────────────────────────────┐              │
│  │                    Amazon S3                        │              │
│  │                                                     │              │
│  │  ✓ Validates presigned URL signature               │              │
│  │  ✓ Checks URL hasn't expired (< 60s)               │              │
│  │  ✓ Stores file at specified key                    │              │
│  │  ✓ Applies encryption (SSE-S3)                     │              │
│  │  ✓ Sets metadata (uploaded-by, filename)           │              │
│  │                                                     │              │
│  │  File stored at:                                   │              │
│  │  s3://collectiq-uploads/uploads/user123/uuid-charizard.jpg
│  │                                                     │              │
│  └─────────────────────────────────────────────────────┘              │
│                                                                         │
│  Benefits:                                                             │
│  ✅ No Lambda payload limits (can upload large files)                 │
│  ✅ No Lambda timeout (can take as long as needed)                    │
│  ✅ No Lambda cost (direct to S3)                                     │
│  ✅ Better performance (fewer hops)                                   │
│  ✅ Progress tracking (XMLHttpRequest.upload.progress)                │
└─────────────────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────────────────┐
│                      STEP 3: CREATE RECORD                              │
│                                                                         │
│  ┌──────────┐                                                          │
│  │ Frontend │                                                          │
│  └────┬─────┘                                                          │
│       │                                                                │
│       │ POST /cards                                                    │
│       │ {                                                              │
│       │   "frontS3Key": "uploads/user123/uuid-charizard.jpg"          │
│       │ }                                                              │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────────────────────────────────────────────────┐              │
│  │         API Gateway (JWT Authorizer)                │              │
│  │  ✓ Validates JWT token                             │              │
│  │  ✓ Extracts user ID from token                     │              │
│  └────┬────────────────────────────────────────────────┘              │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────────────────────────────────────────────────┐              │
│  │         cards_create Lambda                         │              │
│  │                                                     │              │
│  │  1. Authenticate user (getUserId from JWT)         │              │
│  │  2. Validate S3 key belongs to user                │              │
│  │     (must start with uploads/{userId}/)            │              │
│  │  3. Create card record in DynamoDB                 │              │
│  │  4. Emit "CardCreated" event to EventBridge        │              │
│  │                                                     │              │
│  │  ┌──────────────────────────────────────┐          │              │
│  │  │  DynamoDB.PutItem()                  │          │              │
│  │  │  {                                   │          │              │
│  │  │    PK: "USER#user123",               │          │              │
│  │  │    SK: "CARD#uuid",                  │          │              │
│  │  │    cardId: "uuid",                   │          │              │
│  │  │    userId: "user123",                │          │              │
│  │  │    frontS3Key: "uploads/...",        │          │              │
│  │  │    createdAt: "2024-01-15T10:30:00Z" │          │              │
│  │  │  }                                   │          │              │
│  │  └──────────────────────────────────────┘          │              │
│  │                                                     │              │
│  │  ┌──────────────────────────────────────┐          │              │
│  │  │  EventBridge.PutEvents()             │          │              │
│  │  │  {                                   │          │              │
│  │  │    Source: "collectiq.cards",        │          │              │
│  │  │    DetailType: "CardCreated",        │          │              │
│  │  │    Detail: {                         │          │              │
│  │  │      cardId: "uuid",                 │          │              │
│  │  │      userId: "user123",              │          │              │
│  │  │      frontS3Key: "uploads/..."       │          │              │
│  │  │    }                                 │          │              │
│  │  │  }                                   │          │              │
│  │  └──────────────────────────────────────┘          │              │
│  └────┬────────────────────────────────────────────────┘              │
│       │                                                                │
│       │ Returns:                                                       │
│       │ {                                                              │
│       │   "cardId": "123e4567-e89b-12d3-a456-426614174000",           │
│       │   "userId": "user123",                                        │
│       │   "frontS3Key": "uploads/user123/uuid-charizard.jpg",         │
│       │   "createdAt": "2024-01-15T10:30:00Z"                         │
│       │ }                                                              │
│       │                                                                │
│       ▼                                                                │
│  ┌──────────┐                                                          │
│  │ Frontend │ ← Receives card object                                  │
│  └────┬─────┘                                                          │
│       │                                                                │
│       │ Redirects to: /cards/{cardId}                                 │
│       │                                                                │
└───────┴─────────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────────────────┐
│                    AUTOMATIC AI ANALYSIS TRIGGERED                      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────┐              │
│  │              EventBridge Rule                       │              │
│  │  Listens for: "CardCreated" events                 │              │
│  │  Triggers: Step Functions workflow                 │              │
│  └────┬────────────────────────────────────────────────┘              │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────────────────────────────────────────────────┐              │
│  │         Step Functions Workflow                     │              │
│  │                                                     │              │
│  │  1. rekognition_extract Lambda                     │              │
│  │     ├─ Reads image from S3                         │              │
│  │     ├─ Extracts OCR text                           │              │
│  │     ├─ Analyzes holographic patterns               │              │
│  │     └─ Returns FeatureEnvelope                     │              │
│  │                                                     │              │
│  │  2. Parallel Execution:                            │              │
│  │     ├─ pricing_agent Lambda                        │              │
│  │     │  ├─ Fetches eBay prices                      │              │
│  │     │  ├─ Fetches TCGPlayer prices                 │              │
│  │     │  ├─ Bedrock valuation summary                │              │
│  │     │  └─ Returns PricingResult                    │              │
│  │     │                                               │              │
│  │     └─ authenticity_agent Lambda                   │              │
│  │        ├─ Computes perceptual hash                 │              │
│  │        ├─ Compares with reference hashes           │              │
│  │        ├─ Bedrock authenticity judgment            │              │
│  │        └─ Returns AuthenticityResult               │              │
│  │                                                     │              │
│  │  3. aggregator Lambda                              │              │
│  │     ├─ Merges pricing + authenticity results       │              │
│  │     ├─ Updates card in DynamoDB                    │              │
│  │     └─ Emits "CardValuationCompleted" event        │              │
│  │                                                     │              │
│  └─────────────────────────────────────────────────────┘              │
│                                                                         │
│  Total time: 15-25 seconds                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Security Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SECURITY LAYERS                                 │
└─────────────────────────────────────────────────────────────────────────┘

Layer 1: Authentication
┌──────────────────────────────────────────────────────────────┐
│  JWT Token (from Cognito)                                    │
│  - Validates user is logged in                               │
│  - Extracts user ID (sub claim)                              │
│  - Checked by API Gateway before Lambda invocation           │
└──────────────────────────────────────────────────────────────┘
                            ↓
Layer 2: Request Validation
┌──────────────────────────────────────────────────────────────┐
│  upload_presign Lambda                                        │
│  - File size < 12 MB                                         │
│  - MIME type in [image/jpeg, image/png, image/heic]         │
│  - Filename sanitization                                     │
└──────────────────────────────────────────────────────────────┘
                            ↓
Layer 3: Temporary Permission
┌──────────────────────────────────────────────────────────────┐
│  Presigned URL                                               │
│  - Expires in 60 seconds                                     │
│  - Scoped to specific S3 key                                 │
│  - Cannot be reused or shared                                │
│  - Signed with AWS credentials                               │
└──────────────────────────────────────────────────────────────┘
                            ↓
Layer 4: User-Scoped Storage
┌──────────────────────────────────────────────────────────────┐
│  S3 Key Pattern                                              │
│  uploads/{userId}/{uuid}-{filename}                          │
│  - Each user has their own directory                         │
│  - UUID prevents filename collisions                         │
│  - Cannot access other users' files                          │
└──────────────────────────────────────────────────────────────┘
                            ↓
Layer 5: S3 Bucket Policy
┌──────────────────────────────────────────────────────────────┐
│  Private Bucket                                              │
│  - No public access                                          │
│  - Only presigned URLs work                                  │
│  - Encryption at rest (SSE-S3)                               │
│  - Access logging enabled                                    │
└──────────────────────────────────────────────────────────────┘
                            ↓
Layer 6: Ownership Verification
┌──────────────────────────────────────────────────────────────┐
│  cards_create Lambda                                         │
│  - Verifies S3 key starts with uploads/{userId}/            │
│  - Prevents users from claiming other users' files          │
│  - Stores userId with card record                            │
└──────────────────────────────────────────────────────────────┘
```

## Cost Comparison

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    UPLOAD VIA LAMBDA (❌ Bad)                           │
└─────────────────────────────────────────────────────────────────────────┘

Frontend → API Gateway → Lambda → S3

Costs per 10,000 uploads (12 MB files):
├─ API Gateway: 10,000 requests × $0.0000035 = $0.04
├─ Lambda requests: 10,000 × $0.0000002 = $0.002
├─ Lambda compute: 10,000 × 5s × 1GB × $0.0000166667 = $833.34
├─ S3 PUT: 10,000 × $0.000005 = $0.05
└─ Total: $833.43/month

Problems:
❌ 6 MB payload limit (can't upload 12 MB files!)
❌ 30 second timeout
❌ High Lambda costs
❌ Poor performance

┌─────────────────────────────────────────────────────────────────────────┐
│                  DIRECT UPLOAD (✅ Good - Current)                      │
└─────────────────────────────────────────────────────────────────────────┘

Frontend → Lambda (presign) → Frontend → S3 → Lambda (create)

Costs per 10,000 uploads (12 MB files):
├─ API Gateway: 20,000 requests × $0.0000035 = $0.07
├─ Lambda requests: 20,000 × $0.0000002 = $0.004
├─ Lambda compute: 20,000 × 0.15s × 512MB × $0.0000166667 = $25.00
├─ S3 PUT: 10,000 × $0.000005 = $0.05
└─ Total: $25.12/month

Benefits:
✅ No size limits (S3 supports up to 5 TB)
✅ No timeout issues
✅ 97% cheaper ($808.31 savings!)
✅ Better performance
```

## Performance Comparison

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    UPLOAD VIA LAMBDA (❌ Bad)                           │
└─────────────────────────────────────────────────────────────────────────┘

Total: 5,450ms

├─ API Gateway: 50ms
├─ Lambda cold start: 1,000ms
├─ Lambda execution: 200ms
├─ Upload to S3: 4,000ms (12 MB @ 3 Mbps)
└─ Response: 200ms

┌─────────────────────────────────────────────────────────────────────────┐
│                  DIRECT UPLOAD (✅ Good - Current)                      │
└─────────────────────────────────────────────────────────────────────────┘

Total: 4,350ms (20% faster!)

Step 1: Get presigned URL (150ms)
├─ API Gateway: 50ms
└─ Lambda: 100ms

Step 2: Direct S3 upload (4,000ms)
└─ Upload: 4,000ms (12 MB @ 3 Mbps)

Step 3: Create card (200ms)
├─ API Gateway: 50ms
└─ Lambda: 150ms

Savings: 1,100ms (20% faster)
```

---

**Last Updated:** 2024-01-15  
**Maintained By:** CollectIQ Engineering Team
