# Upload Flow Deep Dive

## Overview

CollectIQ uses a **3-step secure upload pattern** that's a best practice for serverless applications. This document explains each step, why it's necessary, and the security/performance benefits.

---

## The 3-Step Upload Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    Step 1: Get Permission                         │
│  Frontend → upload_presign Lambda → Returns presigned URL        │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│                    Step 2: Upload File                            │
│  Frontend → S3 (Direct) → File stored in S3                      │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│                    Step 3: Create Record                          │
│  Frontend → cards_create Lambda → DynamoDB + EventBridge         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Get Permission (`upload_presign` Lambda)

### What It Does

The `upload_presign` Lambda generates a **temporary, secure URL** that allows the frontend to upload directly to S3.

```typescript
// Frontend request
POST /upload/presign
{
  "filename": "charizard.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 2048576
}

// Lambda response
{
  "uploadUrl": "https://s3.amazonaws.com/bucket/uploads/user123/uuid-charizard.jpg?X-Amz-Algorithm=...",
  "key": "uploads/user123/uuid-charizard.jpg",
  "expiresIn": 60
}
```

### Why It's Important

#### 1. **Security & Authentication**

**Problem:** S3 buckets should NOT be publicly writable. Anyone could upload anything!

**Solution:** The Lambda validates the user's JWT token before generating the presigned URL.

```typescript
// upload_presign Lambda
const userId = getUserId(event); // Extract from JWT
// Only authenticated users get presigned URLs
```

**Without this step:**

- ❌ S3 bucket would need to be public (huge security risk)
- ❌ Anyone could upload malware, illegal content, etc.
- ❌ No way to track who uploaded what
- ❌ No cost control (anyone could fill your bucket)

**With this step:**

- ✅ S3 bucket stays private
- ✅ Only authenticated users can upload
- ✅ Uploads are scoped to user ID
- ✅ Cost control through authentication

#### 2. **Validation Before Upload**

The Lambda validates the upload request BEFORE generating the URL:

```typescript
// Validate file size
if (file.size > 12 * 1024 * 1024) {
  throw new PayloadTooLargeError('File too large');
}

// Validate MIME type
if (!['image/jpeg', 'image/png', 'image/heic', 'image/heif'].includes(contentType)) {
  throw new BadRequestError('Invalid file type');
}
```

**Benefits:**

- ✅ Reject invalid files before upload (saves bandwidth)
- ✅ Prevent malicious file types
- ✅ Enforce business rules (size limits, formats)
- ✅ Better user experience (fail fast)

#### 3. **User-Scoped Storage**

The Lambda generates a unique S3 key scoped to the user:

```typescript
const s3Key = `uploads/${userId}/${uuid}-${filename}`;
// Example: uploads/user123/abc-123-charizard.jpg
```

**Benefits:**

- ✅ Data isolation (users can't access each other's files)
- ✅ Easy to find user's files
- ✅ Easy to delete user's data (GDPR compliance)
- ✅ Prevents filename collisions

#### 4. **Temporary Access (60 seconds)**

The presigned URL expires in 60 seconds:

```typescript
const uploadUrl = await getSignedUrl(s3Client, command, {
  expiresIn: 60, // 60 seconds
});
```

**Benefits:**

- ✅ Limits exposure window
- ✅ URL can't be reused or shared
- ✅ Reduces attack surface
- ✅ Automatic cleanup (expired URLs don't work)

### What Happens Inside

```typescript
// services/backend/src/handlers/upload_presign.ts

export async function handler(event) {
  // 1. Authenticate user
  const userId = getUserId(event); // From JWT token

  // 2. Validate request
  const { filename, contentType, sizeBytes } = validateRequest(event.body);

  // 3. Check file size
  if (sizeBytes > MAX_SIZE) {
    throw new PayloadTooLargeError();
  }

  // 4. Check file type
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new BadRequestError();
  }

  // 5. Generate unique S3 key
  const s3Key = `uploads/${userId}/${uuid()}-${sanitize(filename)}`;

  // 6. Create S3 command (doesn't execute it)
  const command = new PutObjectCommand({
    Bucket: 'collectiq-uploads',
    Key: s3Key,
    ContentType: contentType,
    ContentLength: sizeBytes,
    Metadata: {
      'uploaded-by': userId,
      'original-filename': filename,
    },
  });

  // 7. Generate presigned URL (temporary permission)
  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 60, // 60 seconds
  });

  // 8. Return URL to frontend
  return {
    uploadUrl,
    key: s3Key,
    expiresIn: 60,
  };
}
```

---

## Step 2: Upload File (Frontend → S3 Direct)

### What It Does

The frontend uses the presigned URL to upload the file **directly to S3**, bypassing Lambda entirely.

```typescript
// apps/web/app/(protected)/upload/page.tsx

const xhr = new XMLHttpRequest();

// Upload directly to S3 using presigned URL
xhr.open('PUT', presignResponse.uploadUrl);
xhr.setRequestHeader('Content-Type', file.type);
xhr.send(file); // Binary file data
```

### Why Direct Upload?

#### 1. **Lambda Payload Limits**

**Problem:** Lambda has strict payload size limits:

- Synchronous invocation: 6 MB
- Asynchronous invocation: 256 KB

**Solution:** Direct upload bypasses Lambda entirely.

```
❌ Bad: Frontend → Lambda → S3
   - Limited to 6 MB
   - Lambda timeout (30s max for API Gateway)
   - Costs Lambda execution time

✅ Good: Frontend → S3 (Direct)
   - No size limit (S3 supports up to 5 TB)
   - No Lambda timeout
   - No Lambda cost for upload
```

#### 2. **Performance**

**Direct upload is much faster:**

```
Via Lambda:
Frontend → API Gateway → Lambda → S3
  100ms      50ms        200ms    100ms = 450ms + upload time

Direct:
Frontend → S3
  100ms = 100ms + upload time
```

**Benefits:**

- ✅ Lower latency (fewer hops)
- ✅ Better throughput (direct connection)
- ✅ No Lambda cold start delay
- ✅ Better user experience

#### 3. **Cost Efficiency**

**Lambda costs:**

- $0.20 per 1M requests
- $0.0000166667 per GB-second

**Uploading 12 MB file via Lambda:**

```
Lambda execution: ~5 seconds
Memory: 1024 MB
Cost per upload: $0.000083

10,000 uploads/month = $0.83 in Lambda costs
```

**Direct upload:**

```
Lambda cost: $0 (no Lambda involved)
S3 PUT cost: $0.005 per 1,000 requests

10,000 uploads/month = $0.05 in S3 costs
```

**Savings:** 94% cheaper!

#### 4. **Scalability**

**Via Lambda:**

- Limited by Lambda concurrency (1,000 default)
- Each upload holds a Lambda instance
- Can hit throttling limits

**Direct to S3:**

- S3 auto-scales infinitely
- No concurrency limits
- No throttling concerns

### What Happens Inside

```typescript
// Frontend upload code

async function uploadToS3(file: File) {
  // 1. Get presigned URL from Lambda
  const presignResponse = await api.getPresignedUrl({
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });

  // 2. Upload directly to S3 using presigned URL
  const xhr = new XMLHttpRequest();

  // Track progress
  xhr.upload.addEventListener('progress', (event) => {
    const percentComplete = (event.loaded / event.total) * 100;
    setProgress(percentComplete);
  });

  // Handle completion
  xhr.addEventListener('load', () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      console.log('Upload successful!');
    }
  });

  // Start upload
  xhr.open('PUT', presignResponse.uploadUrl);
  xhr.setRequestHeader('Content-Type', file.type);
  xhr.send(file); // Binary data goes directly to S3

  // 3. Return S3 key for next step
  return presignResponse.key;
}
```

---

## Step 3: Create Record (`cards_create` Lambda)

### What It Does

After the file is uploaded to S3, the `cards_create` Lambda creates a database record and triggers AI analysis.

```typescript
// Frontend request
POST /cards
{
  "frontS3Key": "uploads/user123/uuid-charizard.jpg"
}

// Lambda response
{
  "cardId": "123e4567-e89b-12d3-a456-426614174000",
  "userId": "user123",
  "frontS3Key": "uploads/user123/uuid-charizard.jpg",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Why It's Important

#### 1. **Data Persistence**

**Problem:** S3 only stores files. We need to track metadata.

**Solution:** Store card information in DynamoDB.

```typescript
// cards_create Lambda
const card = await createCard(userId, {
  frontS3Key: 'uploads/user123/uuid-charizard.jpg',
  name: 'Charizard',
  set: 'Base Set',
  // ... other metadata
});
```

**What gets stored:**

- Card ID (UUID)
- User ID (from JWT)
- S3 key (where the image is)
- Timestamps (created, updated)
- Metadata (name, set, rarity)
- Analysis results (added later by AI workflow)

#### 2. **Trigger AI Analysis**

**Problem:** File is uploaded, but we need to analyze it.

**Solution:** Emit EventBridge event to trigger Step Functions.

```typescript
// cards_create Lambda
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
        }),
      },
    ],
  })
);
```

**This triggers:**

1. EventBridge rule detects "CardCreated" event
2. Step Functions workflow starts automatically
3. AI analysis begins (Rekognition → Bedrock → Pricing)
4. Results stored back in DynamoDB

#### 3. **Ownership & Security**

**Problem:** Need to ensure users can only access their own cards.

**Solution:** Store user ID with every card.

```typescript
// DynamoDB record
{
  PK: "USER#user123",           // Partition key (user-scoped)
  SK: "CARD#uuid",               // Sort key
  userId: "user123",             // Redundant for queries
  frontS3Key: "uploads/user123/uuid-charizard.jpg",
  // ... other fields
}
```

**Benefits:**

- ✅ Data isolation (users can't see each other's cards)
- ✅ Easy to query user's cards
- ✅ Easy to delete user's data
- ✅ Audit trail (who created what)

#### 4. **Idempotency**

**Problem:** What if the request is sent twice?

**Solution:** Idempotency key prevents duplicate cards.

```typescript
// cards_create Lambda wrapped with idempotency middleware
export const handler = withIdempotency(cardsCreateHandler, {
  operation: 'cards_create',
  required: true,
});
```

**Benefits:**

- ✅ Duplicate requests return same card
- ✅ No duplicate database records
- ✅ No duplicate AI analysis (expensive!)
- ✅ Better user experience

### What Happens Inside

```typescript
// services/backend/src/handlers/cards_create.ts

export async function handler(event) {
  // 1. Authenticate user
  const userId = getUserId(event); // From JWT

  // 2. Validate request
  const { frontS3Key, backS3Key, name, set } = validateRequest(event.body);

  // 3. Verify S3 key belongs to user (security check)
  if (!frontS3Key.startsWith(`uploads/${userId}/`)) {
    throw new UnauthorizedError('Invalid S3 key');
  }

  // 4. Create card in DynamoDB
  const card = await createCard(userId, {
    frontS3Key,
    backS3Key,
    name,
    set,
    // ... other fields
  });

  // 5. Emit EventBridge event (triggers AI analysis)
  if (process.env.AUTO_TRIGGER_REVALUE === 'true') {
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
            }),
          },
        ],
      })
    );
  }

  // 6. Return card to frontend
  return {
    statusCode: 201,
    body: JSON.stringify(card),
  };
}
```

---

## Why Not Simpler Approaches?

### ❌ Approach 1: Upload via Lambda

```
Frontend → Lambda → S3
```

**Problems:**

- ❌ 6 MB payload limit
- ❌ 30 second timeout
- ❌ High Lambda costs
- ❌ Poor performance
- ❌ Scalability issues

### ❌ Approach 2: Public S3 Bucket

```
Frontend → S3 (Public)
```

**Problems:**

- ❌ No authentication
- ❌ Anyone can upload
- ❌ No validation
- ❌ Security nightmare
- ❌ Cost abuse

### ✅ Approach 3: Presigned URL (Current)

```
Frontend → Lambda (presign) → Frontend → S3 (direct) → Lambda (create)
```

**Benefits:**

- ✅ Secure (authenticated)
- ✅ Validated (size, type)
- ✅ Scalable (direct upload)
- ✅ Cost-efficient
- ✅ Best practice

---

## Security Benefits

### 1. **Defense in Depth**

Multiple layers of security:

```
Layer 1: JWT Authentication
  ↓
Layer 2: Request Validation (size, type)
  ↓
Layer 3: Presigned URL (temporary, scoped)
  ↓
Layer 4: S3 Bucket Policy (private)
  ↓
Layer 5: User-scoped paths (uploads/{userId}/)
```

### 2. **Principle of Least Privilege**

Each component has minimal permissions:

```
Frontend:
  - Can only use presigned URLs
  - No direct S3 access
  - No AWS credentials

upload_presign Lambda:
  - Can generate presigned URLs
  - Cannot read/delete from S3
  - Cannot access DynamoDB

cards_create Lambda:
  - Can write to DynamoDB
  - Cannot access S3
  - Cannot generate presigned URLs
```

### 3. **Audit Trail**

Every action is logged:

```
1. Presigned URL request → CloudWatch Logs
   - Who: userId from JWT
   - What: filename, size, type
   - When: timestamp

2. S3 upload → S3 Access Logs
   - Who: presigned URL signature
   - What: object key
   - When: timestamp

3. Card creation → CloudWatch Logs
   - Who: userId from JWT
   - What: cardId, S3 key
   - When: timestamp
```

---

## Performance Benefits

### Latency Comparison

**Via Lambda (❌ Bad):**

```
Total: 5,450ms
├─ API Gateway: 50ms
├─ Lambda cold start: 1,000ms
├─ Lambda execution: 200ms
├─ Upload to S3: 4,000ms (12 MB file)
└─ Response: 200ms
```

**Direct Upload (✅ Good):**

```
Total: 4,350ms
├─ Get presigned URL: 150ms
│  ├─ API Gateway: 50ms
│  └─ Lambda: 100ms
├─ Direct S3 upload: 4,000ms (12 MB file)
└─ Create card: 200ms
   ├─ API Gateway: 50ms
   └─ Lambda: 150ms
```

**Savings:** 1,100ms (20% faster)

### Cost Comparison (10,000 uploads/month)

**Via Lambda:**

```
Lambda requests: 10,000 × $0.0000002 = $2.00
Lambda compute: 10,000 × 5s × 1GB × $0.0000166667 = $833.34
S3 PUT: 10,000 × $0.000005 = $0.05
Total: $835.39/month
```

**Direct Upload:**

```
Lambda requests: 20,000 × $0.0000002 = $4.00
Lambda compute: 20,000 × 0.15s × 512MB × $0.0000166667 = $25.00
S3 PUT: 10,000 × $0.000005 = $0.05
Total: $29.05/month
```

**Savings:** $806.34/month (96% cheaper!)

---

## Summary

### Step 1: `upload_presign` Lambda

**Purpose:** Generate secure, temporary permission to upload

**Why Important:**

- ✅ Authentication (only logged-in users)
- ✅ Validation (size, type, format)
- ✅ Security (temporary, scoped URLs)
- ✅ User isolation (uploads/{userId}/)

### Step 2: Direct S3 Upload

**Purpose:** Upload file efficiently

**Why Direct:**

- ✅ No Lambda payload limits
- ✅ Better performance (fewer hops)
- ✅ Lower cost (no Lambda execution)
- ✅ Better scalability (S3 auto-scales)

### Step 3: `cards_create` Lambda

**Purpose:** Create database record and trigger AI

**Why Important:**

- ✅ Data persistence (DynamoDB)
- ✅ Trigger AI analysis (EventBridge)
- ✅ Ownership tracking (user-scoped)
- ✅ Idempotency (no duplicates)

---

## Real-World Analogy

Think of it like checking into a hotel:

**Step 1: Get Room Key (upload_presign)**

- You show ID at front desk (JWT authentication)
- They verify you have a reservation (validation)
- They give you a room key (presigned URL)
- Key expires after checkout (60 seconds)

**Step 2: Go to Your Room (Direct S3 Upload)**

- You use the key to access your room (direct upload)
- You don't need to go through front desk (no Lambda)
- Faster and more private (better performance)

**Step 3: Register Your Stay (cards_create)**

- Hotel records your check-in (DynamoDB)
- Triggers housekeeping schedule (EventBridge)
- Links room to your account (user-scoped)
- Prevents double-booking (idempotency)

---

## Further Reading

- [AWS S3 Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [Lambda Payload Limits](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)
- [EventBridge Event Patterns](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns.html)

---

**Last Updated:** 2024-01-15  
**Maintained By:** CollectIQ Engineering Team
