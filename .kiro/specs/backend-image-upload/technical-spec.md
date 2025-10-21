# Backend Image Upload Specification

## Overview

This specification defines the complete image upload pipeline for CollectIQ, enforcing constraints consistently across presigned URL generation, S3 upload policies, and post-upload ingestion validation. The defense-in-depth approach prevents oversized or unsupported files from consuming resources while providing clear, actionable error messages.

## Upload Constraints

### Size Limits

- **Hard Limit**: 12 MB (configurable via `MAX_UPLOAD_MB`)
- **Byte Calculation**: `MAX_UPLOAD_BYTES = MAX_UPLOAD_MB × 1024 × 1024`
- **Default**: `MAX_UPLOAD_BYTES = 12,582,912 bytes`
- **Minimum**: 1 byte (prevents empty uploads)

### Supported Media Types

Strict allowlist enforced at all validation layers:

```typescript
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic'];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic'];
```

### Rationale

- **12 MB limit**: Accommodates high-resolution card scans (4000×3000 @ 300 DPI) while preventing abuse
- **JPEG/PNG**: Universal browser support, lossless/lossy options
- **HEIC**: Native iOS format, superior compression (50% smaller than JPEG at equivalent quality)

---

## Architecture: Defense-in-Depth

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Presign Request Validation (API Gateway + Lambda)  │
│ • Validate requested Content-Type against allowlist          │
│ • Reject oversized requests before S3 interaction            │
│ • Return 400 with problem+json                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: S3 Presigned URL Policy (Bucket Policy)            │
│ • content-length-range: [1, MAX_UPLOAD_BYTES]               │
│ • Condition: Content-Type ∈ allowlist                        │
│ • S3 rejects non-compliant PUTs with 403                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Post-Upload Validation (Ingestion Lambda)          │
│ • Magic number sniffing (don't trust headers)               │
│ • Size verification via S3 object metadata                   │
│ • Delete object + emit metrics on violation                  │
│ • Return 413/415 with problem+json                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Presigned URL Generation

### Endpoint

```
POST /api/v1/upload/presign
Authorization: Bearer <JWT>
Content-Type: application/json
```

### Request Body

```json
{
  "contentType": "image/jpeg",
  "fileName": "charizard-1st-edition.jpg",
  "fileSizeBytes": 8388608
}
```

### Validation Logic

```typescript
// Handler: src/handlers/presign.ts
export async function handler(event: APIGatewayProxyEventV2) {
  const { contentType, fileName, fileSizeBytes } = JSON.parse(event.body);
  const userId = event.requestContext.authorizer.jwt.claims.sub;

  // Validate Content-Type
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    return problemJson(400, {
      type: 'https://collectiq.com/errors/unsupported-media-type',
      title: 'Unsupported Media Type',
      detail: `Content-Type '${contentType}' is not allowed. Supported types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      allowedTypes: ALLOWED_MIME_TYPES,
    });
  }

  // Validate size
  const maxBytes = parseInt(process.env.MAX_UPLOAD_MB || '12') * 1024 * 1024;
  if (fileSizeBytes > maxBytes) {
    return problemJson(400, {
      type: 'https://collectiq.com/errors/file-too-large',
      title: 'File Too Large',
      detail: `File size ${fileSizeBytes} bytes exceeds maximum ${maxBytes} bytes (${maxBytes / 1024 / 1024} MB)`,
      maxMB: maxBytes / 1024 / 1024,
      receivedBytes: fileSizeBytes,
    });
  }

  // Generate presigned URL with policy
  const key = `uploads/${userId}/${uuidv4()}`;
  const presignedPost = await s3Client.createPresignedPost({
    Bucket: process.env.UPLOAD_BUCKET,
    Key: key,
    Conditions: [
      ['content-length-range', 1, maxBytes],
      ['eq', '$Content-Type', contentType],
      ['starts-with', '$key', `uploads/${userId}/`],
    ],
    Fields: {
      'Content-Type': contentType,
      'x-amz-meta-user-id': userId,
      'x-amz-meta-original-filename': fileName,
      'x-amz-meta-upload-source': 'web',
    },
    Expires: parseInt(process.env.PRESIGN_TTL_SECONDS || '300'),
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      url: presignedPost.url,
      fields: presignedPost.fields,
      key,
      maxSizeBytes: maxBytes,
      acceptedTypes: ALLOWED_MIME_TYPES,
      expiresIn: parseInt(process.env.PRESIGN_TTL_SECONDS || '300'),
    }),
  };
}
```

### Success Response (200)

```json
{
  "url": "https://collectiq-uploads.s3.amazonaws.com",
  "fields": {
    "key": "uploads/user-123/abc-def-456",
    "Content-Type": "image/jpeg",
    "x-amz-meta-user-id": "user-123",
    "x-amz-meta-original-filename": "charizard.jpg",
    "x-amz-meta-upload-source": "web",
    "Policy": "eyJleHBpcmF0aW9uIjoi...",
    "X-Amz-Signature": "..."
  },
  "key": "uploads/user-123/abc-def-456",
  "maxSizeBytes": 12582912,
  "acceptedTypes": ["image/jpeg", "image/png", "image/heic"],
  "expiresIn": 300
}
```

### Error Responses

#### 400 - Unsupported Media Type (Presign)

```json
{
  "type": "https://collectiq.com/errors/unsupported-media-type",
  "title": "Unsupported Media Type",
  "status": 400,
  "detail": "Content-Type 'image/gif' is not allowed. Supported types: image/jpeg, image/png, image/heic",
  "allowedTypes": ["image/jpeg", "image/png", "image/heic"]
}
```

#### 400 - File Too Large (Presign)

```json
{
  "type": "https://collectiq.com/errors/file-too-large",
  "title": "File Too Large",
  "status": 400,
  "detail": "File size 15728640 bytes exceeds maximum 12582912 bytes (12 MB)",
  "maxMB": 12,
  "receivedBytes": 15728640
}
```

---

## Layer 2: S3 Bucket Policy

### Policy Enforcement

The presigned POST includes conditions that S3 enforces server-side:

```json
{
  "Conditions": [
    ["content-length-range", 1, 12582912],
    ["eq", "$Content-Type", "image/jpeg"],
    ["starts-with", "$key", "uploads/user-123/"]
  ]
}
```

### S3 Rejection Behavior

If a client attempts to bypass presign validation:

- **Oversized file**: S3 returns `403 Forbidden` with `EntityTooLarge` error
- **Wrong Content-Type**: S3 returns `403 Forbidden` with `AccessDenied` error
- **Invalid key prefix**: S3 returns `403 Forbidden` (prevents cross-user uploads)

### Bucket Configuration

```hcl
# infra/terraform/modules/s3_uploads/main.tf
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"  # or "aws:kms" for KMS
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "delete-unprocessed-uploads"
    status = "Enabled"

    expiration {
      days = 1  # Delete uploads not processed within 24h
    }

    filter {
      prefix = "uploads/"
    }
  }
}
```

---

## Layer 3: Post-Upload Validation

### Trigger

S3 event notification → EventBridge → Lambda (ingestion handler)

```typescript
// Handler: src/handlers/ingestion.ts
import { S3Event } from 'aws-lambda';
import { fileTypeFromBuffer } from 'file-type';
import { CloudWatch, S3 } from '@aws-sdk/client-*';

export async function handler(event: S3Event) {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key);
    const size = record.s3.object.size;

    try {
      // Step 1: Size validation
      const maxBytes = parseInt(process.env.MAX_UPLOAD_MB || '12') * 1024 * 1024;
      if (size > maxBytes) {
        await deleteAndReject(bucket, key, {
          statusCode: 413,
          type: 'https://collectiq.com/errors/payload-too-large',
          title: 'Payload Too Large',
          detail: `Uploaded file size ${size} bytes exceeds maximum ${maxBytes} bytes`,
          maxMB: maxBytes / 1024 / 1024,
          receivedBytes: size,
        });
        await emitMetric('ingestion_rejected_too_large', 1);
        continue;
      }

      // Step 2: Magic number validation (don't trust Content-Type header)
      const obj = await s3Client.getObject({ Bucket: bucket, Key: key });
      const buffer = await streamToBuffer(obj.Body);
      const fileType = await fileTypeFromBuffer(buffer);

      if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime)) {
        await deleteAndReject(bucket, key, {
          statusCode: 415,
          type: 'https://collectiq.com/errors/unsupported-media-type',
          title: 'Unsupported Media Type',
          detail: `File magic number indicates type '${fileType?.mime || 'unknown'}', which is not allowed`,
          allowedTypes: ALLOWED_MIME_TYPES,
          detectedType: fileType?.mime || 'unknown',
        });
        await emitMetric('ingestion_rejected_mime_mismatch', 1);
        continue;
      }

      // Step 3: Extract metadata
      const metadata = await extractMetadata(buffer, fileType.mime);

      // Step 4: Store metadata in DynamoDB
      await dynamoClient.putItem({
        TableName: process.env.TABLE_NAME,
        Item: {
          PK: `USER#${metadata.userId}`,
          SK: `UPLOAD#${key}`,
          s3Key: key,
          s3Bucket: bucket,
          originalBytes: size,
          originalMime: fileType.mime,
          width: metadata.width,
          height: metadata.height,
          exifOrientation: metadata.exifOrientation,
          uploadedAt: new Date().toISOString(),
          status: 'pending_processing',
        },
      });

      // Step 5: Trigger Step Functions workflow
      await sfnClient.startExecution({
        stateMachineArn: process.env.INGESTION_STATE_MACHINE_ARN,
        input: JSON.stringify({ s3Key: key, s3Bucket: bucket }),
      });

      await emitMetric('upload_success', 1);
    } catch (error) {
      console.error('Ingestion error:', error);
      await emitMetric('ingestion_error', 1);
    }
  }
}

async function deleteAndReject(bucket: string, key: string, problem: any) {
  // Delete the invalid object
  await s3Client.deleteObject({ Bucket: bucket, Key: key });

  // Store rejection reason in DynamoDB for audit
  await dynamoClient.putItem({
    TableName: process.env.TABLE_NAME,
    Item: {
      PK: `REJECTED#${key}`,
      SK: `TIMESTAMP#${Date.now()}`,
      reason: problem,
      deletedAt: new Date().toISOString(),
    },
  });

  console.warn('Upload rejected and deleted:', { key, problem });
}
```

### Metadata Extraction

```typescript
import sharp from 'sharp';

async function extractMetadata(buffer: Buffer, mimeType: string) {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    exifOrientation: metadata.orientation,
    hasAlpha: metadata.hasAlpha,
    space: metadata.space,
    density: metadata.density,
  };
}
```

---

## HEIC Handling

### Strategy

1. **Accept HEIC as-is** during upload (no blocking conversion)
2. **Queue background transcode** to JPEG for downstream compatibility
3. **Store both versions** with metadata linking original → derivative

### Transcode Workflow

```typescript
// Handler: src/handlers/heic-transcode.ts
import { convertHeicToJpeg } from './utils/image-conversion';

export async function handler(event: { s3Key: string; s3Bucket: string }) {
  const { s3Key, s3Bucket } = event;

  // Download HEIC
  const obj = await s3Client.getObject({ Bucket: s3Bucket, Key: s3Key });
  const heicBuffer = await streamToBuffer(obj.Body);

  // Convert to JPEG (quality 90)
  const jpegBuffer = await convertHeicToJpeg(heicBuffer, { quality: 90 });

  // Upload derivative
  const derivativeKey = s3Key.replace(/\.heic$/i, '.jpg');
  await s3Client.putObject({
    Bucket: s3Bucket,
    Key: derivativeKey,
    Body: jpegBuffer,
    ContentType: 'image/jpeg',
    Metadata: {
      'original-key': s3Key,
      'original-mime': 'image/heic',
      'original-bytes': heicBuffer.length.toString(),
      'derived-mime': 'image/jpeg',
      'derived-bytes': jpegBuffer.length.toString(),
    },
  });

  // Update DynamoDB with derivative info
  await dynamoClient.updateItem({
    TableName: process.env.TABLE_NAME,
    Key: { PK: `UPLOAD#${s3Key}` },
    UpdateExpression: 'SET derivativeKey = :dk, derivativeMime = :dm, derivativeBytes = :db',
    ExpressionAttributeValues: {
      ':dk': derivativeKey,
      ':dm': 'image/jpeg',
      ':db': jpegBuffer.length,
    },
  });

  return { derivativeKey, originalBytes: heicBuffer.length, derivedBytes: jpegBuffer.length };
}
```

---

## Object Metadata & Tags

### S3 Object Metadata (x-amz-meta-\*)

Set during presigned POST:

```json
{
  "x-amz-meta-user-id": "user-123",
  "x-amz-meta-original-filename": "charizard.jpg",
  "x-amz-meta-upload-source": "web",
  "x-amz-meta-compressed-client": "true"
}
```

Updated post-ingestion:

```json
{
  "x-amz-meta-original-bytes": "8388608",
  "x-amz-meta-original-mime": "image/jpeg",
  "x-amz-meta-width": "3000",
  "x-amz-meta-height": "4000",
  "x-amz-meta-exif-orientation": "1"
}
```

### S3 Object Tags

```json
{
  "upload-source": "web",
  "compressed-client": "true",
  "validation-status": "passed",
  "processed": "true"
}
```

---

## Error Model (RFC 7807)

All errors return `application/problem+json` with consistent structure:

### 413 - Payload Too Large

```json
{
  "type": "https://collectiq.com/errors/payload-too-large",
  "title": "Payload Too Large",
  "status": 413,
  "detail": "Uploaded file size 15728640 bytes exceeds maximum 12582912 bytes (12 MB)",
  "maxMB": 12,
  "receivedBytes": 15728640,
  "instance": "/api/v1/upload/presign",
  "requestId": "abc-123-def"
}
```

### 415 - Unsupported Media Type

```json
{
  "type": "https://collectiq.com/errors/unsupported-media-type",
  "title": "Unsupported Media Type",
  "status": 415,
  "detail": "File magic number indicates type 'image/gif', which is not allowed. Supported types: image/jpeg, image/png, image/heic",
  "allowedTypes": ["image/jpeg", "image/png", "image/heic"],
  "detectedType": "image/gif",
  "instance": "/api/v1/upload/ingestion",
  "requestId": "xyz-789-ghi"
}
```

### 400 - Policy Violation

```json
{
  "type": "https://collectiq.com/errors/policy-violation",
  "title": "Policy Violation",
  "status": 400,
  "detail": "Requested Content-Type 'image/webp' does not match allowed types",
  "allowedTypes": ["image/jpeg", "image/png", "image/heic"],
  "requestedType": "image/webp",
  "instance": "/api/v1/upload/presign",
  "requestId": "mno-456-pqr"
}
```

---

## Configuration

### Environment Variables

```bash
# Size constraints
MAX_UPLOAD_MB=12                                    # Default: 12 MB
MAX_UPLOAD_BYTES=12582912                           # Derived: MAX_UPLOAD_MB * 1024 * 1024

# Media type allowlist
ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic # Comma-separated

# Presigned URL settings
PRESIGN_TTL_SECONDS=300                             # Default: 5 minutes

# S3 configuration
UPLOAD_BUCKET=collectiq-uploads-hackathon
UPLOAD_KEY_PREFIX=uploads/

# DynamoDB
TABLE_NAME=collectiq-hackathon

# Step Functions
INGESTION_STATE_MACHINE_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:collectiq-ingestion

# Observability
CLOUDWATCH_NAMESPACE=CollectIQ/Uploads
LOG_LEVEL=INFO
```

### Frontend Configuration Endpoint

```
GET /api/v1/config
Authorization: Bearer <JWT>
```

Response:

```json
{
  "upload": {
    "maxSizeBytes": 12582912,
    "maxSizeMB": 12,
    "allowedMimeTypes": ["image/jpeg", "image/png", "image/heic"],
    "allowedExtensions": [".jpg", ".jpeg", ".png", ".heic"],
    "presignTTL": 300
  },
  "features": {
    "heicSupport": true,
    "clientCompression": true
  }
}
```

---

## Security & Compliance

### Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyUnencryptedObjectUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::collectiq-uploads-hackathon/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    },
    {
      "Sid": "DenyUploadsWithoutMetadata",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::collectiq-uploads-hackathon/uploads/*",
      "Condition": {
        "StringNotLike": {
          "s3:x-amz-meta-user-id": "*"
        }
      }
    }
  ]
}
```

### Encryption

- **At Rest**: SSE-S3 (AES-256) or SSE-KMS for enhanced audit
- **In Transit**: TLS 1.2+ enforced via bucket policy

### Future: Anti-Virus Scanning

```typescript
// Optional: Queue for ClamAV scan
await sqsClient.sendMessage({
  QueueUrl: process.env.AV_SCAN_QUEUE_URL,
  MessageBody: JSON.stringify({ s3Bucket: bucket, s3Key: key }),
});

// Quarantine bucket for infected files
const quarantineBucket = process.env.QUARANTINE_BUCKET;
```

---

## Observability

### CloudWatch Metrics

```typescript
const METRICS = {
  // Presign layer
  presign_denied_too_large: 'Count of presign requests rejected for size',
  presign_denied_bad_type: 'Count of presign requests rejected for type',
  presign_success: 'Count of successful presign generations',

  // Ingestion layer
  ingestion_rejected_mime_mismatch: 'Count of uploads rejected for MIME mismatch',
  ingestion_rejected_too_large: 'Count of uploads rejected for size',
  upload_success: 'Count of successful uploads',
  ingestion_error: 'Count of ingestion errors',

  // HEIC processing
  heic_transcode_success: 'Count of successful HEIC → JPEG transcodes',
  heic_transcode_error: 'Count of failed HEIC transcodes',
};

async function emitMetric(name: string, value: number, dimensions?: Record<string, string>) {
  await cloudwatchClient.putMetricData({
    Namespace: process.env.CLOUDWATCH_NAMESPACE || 'CollectIQ/Uploads',
    MetricData: [
      {
        MetricName: name,
        Value: value,
        Unit: 'Count',
        Timestamp: new Date(),
        Dimensions: Object.entries(dimensions || {}).map(([Name, Value]) => ({ Name, Value })),
      },
    ],
  });
}
```

### Structured Logging

```typescript
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'upload-service' });

logger.info('Presign request received', {
  requestId: event.requestContext.requestId,
  userId: event.requestContext.authorizer.jwt.claims.sub,
  contentType: body.contentType,
  fileSizeBytes: body.fileSizeBytes,
});

logger.warn('Upload rejected', {
  requestId,
  userId,
  s3Key: key,
  reason: 'mime_mismatch',
  expected: ALLOWED_MIME_TYPES,
  detected: fileType.mime,
});
```

### X-Ray Tracing

```typescript
import { captureAWSv3Client } from 'aws-xray-sdk-core';

const s3Client = captureAWSv3Client(new S3Client({}));
const dynamoClient = captureAWSv3Client(new DynamoDBClient({}));
```

---

## Presign Policy Example

### Per-Type Presigned URL

Generate separate presigned URLs for each allowed MIME type:

```typescript
const presignedUrls = await Promise.all(
  ALLOWED_MIME_TYPES.map(async (mimeType) => {
    const presignedPost = await s3Client.createPresignedPost({
      Bucket: process.env.UPLOAD_BUCKET,
      Key: `uploads/${userId}/${uuidv4()}`,
      Conditions: [
        ['content-length-range', 1, maxBytes],
        ['eq', '$Content-Type', mimeType],
      ],
      Fields: { 'Content-Type': mimeType },
      Expires: 300,
    });

    return { mimeType, ...presignedPost };
  }),
);
```

Response:

```json
{
  "presignedUrls": [
    {
      "mimeType": "image/jpeg",
      "url": "https://...",
      "fields": { "Content-Type": "image/jpeg", ... }
    },
    {
      "mimeType": "image/png",
      "url": "https://...",
      "fields": { "Content-Type": "image/png", ... }
    },
    {
      "mimeType": "image/heic",
      "url": "https://...",
      "fields": { "Content-Type": "image/heic", ... }
    }
  ],
  "maxSizeBytes": 12582912,
  "expiresIn": 300
}
```

---

## Acceptance Criteria

### ✅ Size Enforcement

- [ ] A 13 MB PNG **cannot** obtain a presigned URL (400 + problem+json)
- [ ] Attempts to bypass presign with oversized file fail at S3 (403)
- [ ] Oversized files that slip through are deleted by ingestion (413 + metric)

### ✅ MIME Type Enforcement

- [ ] Request for `image/gif` presign returns 400 with allowed types
- [ ] Mislabeled `.jpg` containing PNG magic number:
  - [ ] Uploads successfully (passes presign per-type URL)
  - [ ] Rejected by ingestion via magic number check (415)
  - [ ] Object deleted from S3
  - [ ] `ingestion_rejected_mime_mismatch` metric emitted

### ✅ Error Consistency

- [ ] All errors return RFC 7807 `application/problem+json`
- [ ] Error messages include actionable remediation (limits, allowed types)
- [ ] `requestId` included for support correlation

### ✅ Observability

- [ ] Metrics emitted for each rejection path
- [ ] Structured logs include `requestId`, `userId`, `bytes`, `mime`, `source`
- [ ] X-Ray traces span presign → upload → ingestion

### ✅ Configuration

- [ ] `MAX_UPLOAD_MB` env var changes reflected in presign responses
- [ ] No code changes required to adjust limits
- [ ] Frontend `/config` endpoint returns current backend limits

### ✅ HEIC Support

- [ ] HEIC uploads accepted and stored
- [ ] Background transcode to JPEG queued (non-blocking)
- [ ] Both original and derivative tracked in DynamoDB

---

## Testing Scenarios

### Unit Tests

```typescript
describe('Presign Handler', () => {
  it('rejects 13 MB file', async () => {
    const response = await handler({
      body: JSON.stringify({ contentType: 'image/jpeg', fileSizeBytes: 13 * 1024 * 1024 }),
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).type).toContain('file-too-large');
  });

  it('rejects image/gif', async () => {
    const response = await handler({
      body: JSON.stringify({ contentType: 'image/gif', fileSizeBytes: 1024 }),
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).allowedTypes).toEqual(ALLOWED_MIME_TYPES);
  });
});
```

### Integration Tests

```typescript
describe('Upload Pipeline', () => {
  it('rejects mislabeled PNG as JPEG', async () => {
    // 1. Get presign for JPEG
    const presign = await getPresignedUrl('image/jpeg');

    // 2. Upload PNG file with JPEG Content-Type
    const pngBuffer = fs.readFileSync('test-fixtures/fake.png');
    await uploadToS3(presign, pngBuffer, 'image/jpeg');

    // 3. Wait for ingestion
    await waitForIngestion();

    // 4. Verify object deleted
    await expect(s3Client.headObject({ Key: presign.key })).rejects.toThrow('NotFound');

    // 5. Verify metric
    const metrics = await getMetrics('ingestion_rejected_mime_mismatch');
    expect(metrics.Sum).toBeGreaterThan(0);
  });
});
```

---

## References

- [RFC 7807: Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
- [AWS S3 Presigned POST](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-post-example.html)
- [file-type (magic number detection)](https://github.com/sindresorhus/file-type)
- [sharp (image metadata)](https://sharp.pixelplumbing.com/)
