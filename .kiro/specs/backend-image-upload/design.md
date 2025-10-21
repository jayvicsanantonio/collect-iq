# Design Document

## Overview

The Backend Image Upload system implements a three-layer defense-in-depth validation architecture for CollectIQ card image uploads. The design ensures that only compliant files (JPEG, PNG, HEIC up to 12 MB) reach storage and processing, while providing clear error feedback at each validation layer.

## Architecture

### High-Level Flow

```
┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌────────────┐     ┌──────────────┐
│  Client  │────▶│ API Gateway │────▶│ Presign  │────▶│     S3     │────▶│  Ingestion   │
│          │     │   + JWT     │     │  Lambda  │     │   Bucket   │     │    Lambda    │
└──────────┘     └─────────────┘     └──────────┘     └──────────┘     └──────────────┘
                        │                   │                │                   │
                        │                   │                │                   │
                        ▼                   ▼                ▼                   ▼
                   Cognito            CloudWatch        Bucket           EventBridge
                   Validate           Metrics           Policy           Trigger
                                                                              │
                                                                              ▼
                                                                        ┌──────────────┐
                                                                        │ DynamoDB +   │
                                                                        │ Step Funcs   │
                                                                        └──────────────┘
```

### Defense Layers

**Layer 1: Presign Validation (API Gateway + Lambda)**

- Validates Content-Type against allowlist
- Validates file size against MAX_UPLOAD_MB
- Returns RFC 7807 errors immediately
- Emits CloudWatch metrics for rejections

**Layer 2: S3 Bucket Policy**

- Enforces content-length-range [1, MAX_UPLOAD_BYTES]
- Enforces exact Content-Type match
- Enforces key prefix (user isolation)
- S3 returns 403 for policy violations

**Layer 3: Post-Upload Validation (Ingestion Lambda)**

- Magic number detection (file-type library)
- Size verification via S3 object metadata
- Deletes non-compliant files
- Stores audit records in DynamoDB

---

## Components and Interfaces

### 1. Presign Handler Lambda

**Purpose:** Generate presigned S3 POST URLs with validation

**Trigger:** API Gateway POST /api/v1/upload/presign

**Input:**

```typescript
interface PresignRequest {
  contentType: 'image/jpeg' | 'image/png' | 'image/heic';
  fileName: string;
  fileSizeBytes: number;
}
```

**Output (Success):**

```typescript
interface PresignResponse {
  url: string;
  fields: Record<string, string>;
  key: string;
  maxSizeBytes: number;
  acceptedTypes: string[];
  expiresIn: number;
}
```

**Output (Error):**

```typescript
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  requestId?: string;
  [key: string]: any; // Extension members
}
```

**Dependencies:**

- AWS SDK S3 Client (createPresignedPost)
- Environment variables (MAX_UPLOAD_MB, ALLOWED_UPLOAD_MIME, PRESIGN_TTL_SECONDS)
- CloudWatch Metrics
- Lambda Powertools Logger

**Key Logic:**

1. Extract JWT sub claim from API Gateway authorizer context
2. Validate contentType against ALLOWED_MIME_TYPES
3. Validate fileSizeBytes against MAX_UPLOAD_BYTES
4. Generate S3 key: `uploads/{userId}/{uuid}`
5. Create presigned POST with policy conditions
6. Return presigned URL or RFC 7807 error

---

### 2. S3 Upload Bucket

**Purpose:** Store uploaded card images with policy enforcement

**Configuration:**

- Bucket name: `collectiq-uploads-{environment}`
- Encryption: SSE-S3 (AES-256) or SSE-KMS
- Versioning: Disabled (single version per upload)
- Public access: Blocked
- CORS: Configured for web domain

**Bucket Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyUnencryptedUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::collectiq-uploads-*/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    },
    {
      "Sid": "DenyUploadsWithoutUserMetadata",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::collectiq-uploads-*/uploads/*",
      "Condition": {
        "StringNotLike": {
          "s3:x-amz-meta-user-id": "*"
        }
      }
    }
  ]
}
```

**Lifecycle Rules:**

- Delete objects in `uploads/` prefix older than 24 hours if not processed
- Transition to Glacier after 90 days (future optimization)

**Event Notifications:**

- Trigger: s3:ObjectCreated:\*
- Destination: EventBridge custom bus
- Filter: Prefix `uploads/`

---

### 3. Ingestion Lambda

**Purpose:** Validate uploaded files and trigger processing workflow

**Trigger:** EventBridge rule on S3 ObjectCreated event

**Input:**

```typescript
interface S3Event {
  Records: Array<{
    s3: {
      bucket: { name: string };
      object: { key: string; size: number };
    };
  }>;
}
```

**Key Logic:**

1. For each S3 event record:
   - Verify size ≤ MAX_UPLOAD_BYTES
   - Download file (first 4KB for magic number)
   - Detect MIME type using file-type library
   - Validate detected type against allowlist
   - If invalid: delete object, emit metric, store rejection record
   - If valid: extract metadata, store upload record, trigger Step Functions

**Dependencies:**

- AWS SDK S3 Client (getObject, deleteObject)
- AWS SDK DynamoDB Client (putItem)
- AWS SDK Step Functions Client (startExecution)
- file-type library (magic number detection)
- sharp library (metadata extraction)
- CloudWatch Metrics
- Lambda Powertools Logger

**Error Handling:**

- Validation failures: Delete object, log error, emit metric
- Metadata extraction failures: Log error, retain file for manual review
- Step Functions start failures: Log error, emit metric, retry via DLQ

---

### 4. HEIC Transcode Lambda

**Purpose:** Convert HEIC images to JPEG for downstream compatibility

**Trigger:** EventBridge rule on upload record creation (originalMime = image/heic)

**Input:**

```typescript
interface TranscodeRequest {
  s3Bucket: string;
  s3Key: string;
  userId: string;
}
```

**Key Logic:**

1. Download HEIC file from S3
2. Convert to JPEG using sharp library (quality 90%)
3. Upload JPEG derivative with key `{original-key}.jpg`
4. Add S3 metadata linking to original
5. Update DynamoDB upload record with derivative info
6. Emit heic_transcode_success metric

**Dependencies:**

- AWS SDK S3 Client
- AWS SDK DynamoDB Client
- sharp library with HEIC support
- CloudWatch Metrics

**Error Handling:**

- Transcode failures: Log error, emit heic_transcode_error metric, retain original HEIC

---

### 5. Config Endpoint Lambda

**Purpose:** Expose runtime configuration to frontend

**Trigger:** API Gateway GET /api/v1/config

**Output:**

```typescript
interface Config {
  upload: {
    maxSizeBytes: number;
    maxSizeMB: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
    presignTTL: number;
  };
  features: {
    heicSupport: boolean;
    clientCompression: boolean;
  };
  version: string;
}
```

**Key Logic:**

1. Read environment variables
2. Calculate derived values (maxSizeBytes from maxSizeMB)
3. Return configuration object

---

## Data Models

### DynamoDB Upload Record

**Table:** collectiq-{environment}

**Primary Key:**

- PK: `USER#{userId}` (Partition Key)
- SK: `UPLOAD#{s3Key}` (Sort Key)

**Attributes:**

```typescript
interface UploadRecord {
  PK: string; // USER#{userId}
  SK: string; // UPLOAD#{s3Key}
  s3Key: string; // uploads/user-123/abc-def-456
  s3Bucket: string; // collectiq-uploads-hackathon
  originalBytes: number; // 8388608
  originalMime: string; // image/jpeg
  width: number; // 3000
  height: number; // 4000
  exifOrientation?: number; // 1-8
  hasAlpha?: boolean; // true/false
  uploadedAt: string; // ISO 8601 timestamp
  status: string; // pending_processing | processing | completed | failed
  derivativeKey?: string; // uploads/user-123/abc-def-456.jpg (for HEIC)
  derivativeMime?: string; // image/jpeg
  derivativeBytes?: number; // 4194304
  processedAt?: string; // ISO 8601 timestamp
  errorMessage?: string; // Error details if status=failed
}
```

**GSI1 (Optional):**

- PK: userId
- SK: uploadedAt
- Purpose: Query user's uploads chronologically

### DynamoDB Rejection Record

**Primary Key:**

- PK: `REJECTED#{s3Key}` (Partition Key)
- SK: `TIMESTAMP#{timestamp}` (Sort Key)

**Attributes:**

```typescript
interface RejectionRecord {
  PK: string; // REJECTED#{s3Key}
  SK: string; // TIMESTAMP#{timestamp}
  s3Key: string; // uploads/user-123/abc-def-456
  reason: ProblemDetails; // RFC 7807 error object
  deletedAt: string; // ISO 8601 timestamp
  userId?: string; // user-123 (if available)
}
```

**Purpose:** Audit trail for rejected uploads

---

## Error Handling

### Error Types and HTTP Status Codes

| Error Type                           | HTTP Status | Layer   | Action                            |
| ------------------------------------ | ----------- | ------- | --------------------------------- |
| Unsupported Media Type (Presign)     | 400         | Layer 1 | Return error, emit metric         |
| File Too Large (Presign)             | 400         | Layer 1 | Return error, emit metric         |
| Unauthorized                         | 401         | Layer 1 | Return error                      |
| Token Expired                        | 401         | Layer 1 | Return error                      |
| S3 Policy Violation                  | 403         | Layer 2 | S3 rejects upload                 |
| Payload Too Large (Post-Upload)      | 413         | Layer 3 | Delete file, emit metric          |
| Unsupported Media Type (Post-Upload) | 415         | Layer 3 | Delete file, emit metric          |
| Rate Limit Exceeded                  | 429         | Layer 1 | Return error with Retry-After     |
| Internal Server Error                | 500         | Any     | Log error, return generic message |

### RFC 7807 Problem Details Format

All errors follow this structure:

```typescript
interface ProblemDetails {
  type: string; // URI: https://collectiq.com/errors/{slug}
  title: string; // Human-readable summary
  status: number; // HTTP status code
  detail: string; // Specific explanation
  instance?: string; // Request path
  requestId?: string; // For support correlation
  // Extension members (error-specific)
  maxMB?: number;
  receivedBytes?: number;
  allowedTypes?: string[];
  detectedType?: string;
  limit?: number;
  window?: string;
  retryAfter?: number;
}
```

### Error Response Helper

```typescript
function problemJson(status: number, problem: Partial<ProblemDetails>) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/problem+json',
    },
    body: JSON.stringify({
      status,
      ...problem,
    }),
  };
}
```

---

## Testing Strategy

### Unit Tests

**Presign Handler:**

- ✅ Accepts valid JPEG/PNG/HEIC requests
- ✅ Rejects oversized files (13 MB)
- ✅ Rejects unsupported types (GIF, WebP)
- ✅ Generates correct S3 policy conditions
- ✅ Scopes keys to user ID
- ✅ Returns RFC 7807 errors

**Ingestion Handler:**

- ✅ Detects MIME type via magic number
- ✅ Rejects mislabeled files (PNG as JPEG)
- ✅ Deletes non-compliant files
- ✅ Extracts metadata correctly
- ✅ Stores upload records
- ✅ Triggers Step Functions

**HEIC Transcode:**

- ✅ Converts HEIC to JPEG
- ✅ Preserves image quality
- ✅ Links derivative to original
- ✅ Handles transcode failures gracefully

### Integration Tests

**S3 Policy Enforcement:**

- ✅ S3 rejects oversized uploads (403)
- ✅ S3 rejects wrong Content-Type (403)
- ✅ S3 rejects invalid key prefix (403)
- ✅ S3 accepts compliant uploads (204)

**End-to-End Flow:**

- ✅ Request presign → upload → ingestion → Step Functions
- ✅ HEIC upload → transcode → derivative stored
- ✅ Rejection flow → file deleted → audit record created

### Load Tests

**Presign Endpoint:**

- Target: 100 req/s sustained
- p95 latency: < 500ms
- Error rate: < 0.1%

**Ingestion Lambda:**

- Target: Process 50 uploads/s
- p95 latency: < 5s
- Success rate: > 99%

---

## Security Considerations

### Authentication & Authorization

- All endpoints require valid Cognito JWT
- JWT sub claim used for user isolation
- S3 keys scoped to `uploads/{userId}/`
- Cross-user access prevented by key prefix validation

### Data Protection

- Server-side encryption at rest (SSE-S3 or SSE-KMS)
- TLS 1.2+ for data in transit
- Presigned URLs expire in 5 minutes
- Unprocessed uploads deleted after 24 hours

### Input Validation

- Content-Type allowlist (no wildcards)
- File size limits enforced at 3 layers
- Magic number validation (don't trust headers)
- S3 bucket policy as fallback

### Rate Limiting

- 10 presign requests per user per minute
- Implemented via API Gateway throttling
- 429 responses include Retry-After header

### Audit & Compliance

- All rejections logged with requestId
- Rejection records stored in DynamoDB
- CloudWatch metrics for monitoring
- X-Ray tracing for request flows

---

## Observability

### CloudWatch Metrics

**Namespace:** CollectIQ/Uploads

**Metrics:**

- `presign_denied_too_large` (Count)
- `presign_denied_bad_type` (Count)
- `presign_success` (Count)
- `ingestion_rejected_mime_mismatch` (Count)
- `ingestion_rejected_too_large` (Count)
- `upload_success` (Count)
- `heic_transcode_success` (Count)
- `heic_transcode_error` (Count)
- `rate_limit_exceeded` (Count)

**Dimensions:**

- Endpoint (e.g., /api/v1/upload/presign)
- UserId (for rate limiting)
- ErrorType (for error categorization)

### Structured Logging

**Log Format:**

```json
{
  "timestamp": "2025-10-17T14:30:00.123Z",
  "level": "INFO",
  "message": "Presign request received",
  "requestId": "abc-123-def-456",
  "userId": "user-123",
  "contentType": "image/jpeg",
  "fileSizeBytes": 8388608
}
```

**Log Levels:**

- DEBUG: Detailed execution flow
- INFO: Normal operations (presign generated, upload succeeded)
- WARN: Validation failures (rejected uploads)
- ERROR: Unexpected errors (Step Functions start failure)

### X-Ray Tracing

**Segments:**

- API Gateway → Presign Lambda
- Presign Lambda → S3 (createPresignedPost)
- S3 → EventBridge → Ingestion Lambda
- Ingestion Lambda → DynamoDB + Step Functions

**Annotations:**

- userId
- contentType
- fileSizeBytes
- validationResult (pass/fail)

---

## Performance Optimization

### Presign Handler

- Cold start: < 1s (minimal dependencies)
- Warm execution: < 100ms
- Memory: 256 MB
- Timeout: 10s

### Ingestion Handler

- Download only first 4KB for magic number detection
- Use sharp for fast metadata extraction
- Parallel S3 operations (getObject + deleteObject)
- Memory: 1024 MB (for image processing)
- Timeout: 30s

### HEIC Transcode

- Async processing (non-blocking)
- Use sharp with HEIC support (libheif)
- Quality 90% (balance size/quality)
- Memory: 2048 MB (for large images)
- Timeout: 60s

---

## Deployment Architecture

### Lambda Functions

1. **presign-handler**
   - Runtime: Node.js 20
   - Memory: 256 MB
   - Timeout: 10s
   - Concurrency: 100
   - Environment: MAX_UPLOAD_MB, ALLOWED_UPLOAD_MIME, PRESIGN_TTL_SECONDS

2. **ingestion-handler**
   - Runtime: Node.js 20
   - Memory: 1024 MB
   - Timeout: 30s
   - Concurrency: 50
   - Environment: MAX_UPLOAD_MB, TABLE_NAME, INGESTION_STATE_MACHINE_ARN

3. **heic-transcode-handler**
   - Runtime: Node.js 20
   - Memory: 2048 MB
   - Timeout: 60s
   - Concurrency: 20
   - Environment: TABLE_NAME

4. **config-handler**
   - Runtime: Node.js 20
   - Memory: 128 MB
   - Timeout: 5s
   - Concurrency: 100
   - Environment: MAX_UPLOAD_MB, ALLOWED_UPLOAD_MIME, PRESIGN_TTL_SECONDS

### API Gateway

- Type: HTTP API (lower cost, better performance)
- Authorizer: JWT (Cognito User Pool)
- CORS: Configured for web domain
- Throttling: 10 req/s per user (presign endpoint)

### EventBridge

- Custom event bus: collectiq-events-{environment}
- Rules:
  - S3 ObjectCreated → Ingestion Lambda
  - Upload record created (HEIC) → HEIC Transcode Lambda

### DynamoDB

- Table: collectiq-{environment}
- Billing: On-demand (PAY_PER_REQUEST)
- Point-in-time recovery: Enabled
- Encryption: AWS managed key

---

## Configuration Management

### Environment Variables

**Presign Handler:**

```bash
MAX_UPLOAD_MB=12
ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic
PRESIGN_TTL_SECONDS=300
UPLOAD_BUCKET=collectiq-uploads-hackathon
AWS_REGION=us-east-1
CLOUDWATCH_NAMESPACE=CollectIQ/Uploads
LOG_LEVEL=INFO
```

**Ingestion Handler:**

```bash
MAX_UPLOAD_MB=12
ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic
TABLE_NAME=collectiq-hackathon
INGESTION_STATE_MACHINE_ARN=arn:aws:states:...
UPLOAD_BUCKET=collectiq-uploads-hackathon
AWS_REGION=us-east-1
CLOUDWATCH_NAMESPACE=CollectIQ/Uploads
LOG_LEVEL=INFO
```

**HEIC Transcode Handler:**

```bash
TABLE_NAME=collectiq-hackathon
UPLOAD_BUCKET=collectiq-uploads-hackathon
AWS_REGION=us-east-1
CLOUDWATCH_NAMESPACE=CollectIQ/Uploads
LOG_LEVEL=INFO
```

### Terraform Variables

```hcl
variable "max_upload_mb" {
  type    = number
  default = 12
}

variable "allowed_upload_mimes" {
  type    = list(string)
  default = ["image/jpeg", "image/png", "image/heic"]
}

variable "presign_ttl_seconds" {
  type    = number
  default = 300
}
```

---

## Migration & Rollout Plan

### Phase 1: Infrastructure Setup

- Deploy S3 bucket with policies
- Deploy Lambda functions
- Configure EventBridge rules
- Set up CloudWatch dashboards

### Phase 2: Backend Deployment

- Deploy presign handler
- Deploy ingestion handler
- Deploy HEIC transcode handler
- Deploy config endpoint

### Phase 3: Integration Testing

- Run acceptance tests
- Verify metrics and logs
- Test error scenarios
- Load test presign endpoint

### Phase 4: Frontend Integration

- Update frontend to call /config
- Update frontend to use presign flow
- Test end-to-end upload flow
- Monitor error rates

### Phase 5: Production Rollout

- Enable for 10% of users
- Monitor metrics and errors
- Gradually increase to 100%
- Deprecate old upload flow

---

## Monitoring & Alerting

### CloudWatch Alarms

**High Error Rate:**

- Metric: presign*denied*_ + ingestion*rejected*_
- Threshold: > 5% of total requests
- Action: SNS notification to on-call

**High Latency:**

- Metric: Lambda duration (p95)
- Threshold: > 5s for ingestion
- Action: SNS notification

**Failed Step Functions:**

- Metric: Step Functions ExecutionsFailed
- Threshold: > 1 in 5 minutes
- Action: SNS notification

### Dashboards

**Upload Pipeline Dashboard:**

- Presign requests (success/failure)
- Upload success rate
- Ingestion processing time
- HEIC transcode rate
- Error breakdown by type

---

## Future Enhancements

1. **Anti-Virus Scanning:** Integrate ClamAV for malware detection
2. **Image Optimization:** Automatic compression for large files
3. **Multi-Region Support:** Replicate uploads to multiple regions
4. **Advanced Analytics:** Track upload patterns and user behavior
5. **Bulk Upload:** Support multiple files in single request
6. **Progressive Upload:** Chunked upload for large files
7. **Client-Side Compression:** Reduce upload time and bandwidth

---

## References

- [AWS S3 Presigned POST](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-post-example.html)
- [RFC 7807: Problem Details](https://tools.ietf.org/html/rfc7807)
- [file-type Library](https://github.com/sindresorhus/file-type)
- [sharp Library](https://sharp.pixelplumbing.com/)
- [AWS Lambda Powertools](https://docs.powertools.aws.dev/lambda/typescript/)
