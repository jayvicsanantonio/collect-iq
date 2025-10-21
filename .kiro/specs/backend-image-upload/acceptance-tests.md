# Backend Image Upload Acceptance Tests

## Overview

This document defines acceptance criteria and test scenarios for the backend image upload pipeline. All tests must pass before deployment to production.

---

## Test Environment Setup

### Prerequisites

```bash
# Environment variables
export MAX_UPLOAD_MB=12
export ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic
export PRESIGN_TTL_SECONDS=300
export UPLOAD_BUCKET=collectiq-uploads-test
export TABLE_NAME=collectiq-test

# Test fixtures
mkdir -p test-fixtures
cd test-fixtures

# Generate test files
dd if=/dev/urandom of=valid-10mb.jpg bs=1048576 count=10    # 10 MB JPEG
dd if=/dev/urandom of=invalid-13mb.jpg bs=1048576 count=13  # 13 MB JPEG
dd if=/dev/urandom of=valid-5mb.png bs=1048576 count=5      # 5 MB PNG
dd if=/dev/urandom of=valid-8mb.heic bs=1048576 count=8     # 8 MB HEIC

# Create mislabeled file (PNG with .jpg extension)
cp valid-5mb.png mislabeled.jpg
```

---

## Layer 1: Presign Request Validation

### AC-1.1: Accept Valid JPEG Request

**Given:** User requests presigned URL for 10 MB JPEG  
**When:** POST /api/v1/upload/presign with valid payload  
**Then:** Return 200 with presigned URL and policy

```bash
curl -X POST https://api.collectiq.com/api/v1/upload/presign \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contentType": "image/jpeg",
    "fileName": "charizard.jpg",
    "fileSizeBytes": 10485760
  }' | jq .
```

**Expected Response:**

```json
{
  "url": "https://collectiq-uploads.s3.amazonaws.com",
  "fields": {
    "key": "uploads/user-123/...",
    "Content-Type": "image/jpeg",
    "Policy": "...",
    "X-Amz-Signature": "..."
  },
  "key": "uploads/user-123/...",
  "maxSizeBytes": 12582912,
  "acceptedTypes": ["image/jpeg", "image/png", "image/heic"],
  "expiresIn": 300
}
```

**Status:** ✅ PASS / ❌ FAIL

---

### AC-1.2: Reject Oversized File at Presign

**Given:** User requests presigned URL for 13 MB JPEG  
**When:** POST /api/v1/upload/presign with oversized payload  
**Then:** Return 400 with problem+json

```bash
curl -X POST https://api.collectiq.com/api/v1/upload/presign \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contentType": "image/jpeg",
    "fileName": "huge.jpg",
    "fileSizeBytes": 13631488
  }' | jq .
```

**Expected Response:**

```json
{
  "type": "https://collectiq.com/errors/file-too-large",
  "title": "File Too Large",
  "status": 400,
  "detail": "File size 13631488 bytes exceeds maximum 12582912 bytes (12 MB)",
  "maxMB": 12,
  "receivedBytes": 13631488,
  "requestId": "..."
}
```

**Assertions:**

- [ ] HTTP status is 400
- [ ] Content-Type is `application/problem+json`
- [ ] Response includes `maxMB` and `receivedBytes`
- [ ] CloudWatch metric `presign_denied_too_large` incremented

**Status:** ✅ PASS / ❌ FAIL

---

### AC-1.3: Reject Unsupported Media Type at Presign

**Given:** User requests presigned URL for GIF  
**When:** POST /api/v1/upload/presign with unsupported type  
**Then:** Return 400 with problem+json

```bash
curl -X POST https://api.collectiq.com/api/v1/upload/presign \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contentType": "image/gif",
    "fileName": "animated.gif",
    "fileSizeBytes": 1048576
  }' | jq .
```

**Expected Response:**

```json
{
  "type": "https://collectiq.com/errors/unsupported-media-type",
  "title": "Unsupported Media Type",
  "status": 400,
  "detail": "Content-Type 'image/gif' is not allowed. Supported types: image/jpeg, image/png, image/heic",
  "requestedType": "image/gif",
  "allowedTypes": ["image/jpeg", "image/png", "image/heic"],
  "requestId": "..."
}
```

**Assertions:**

- [ ] HTTP status is 400
- [ ] Response includes `allowedTypes` array
- [ ] CloudWatch metric `presign_denied_bad_type` incremented

**Status:** ✅ PASS / ❌ FAIL

---

### AC-1.4: Reject Unauthenticated Request

**Given:** User is not authenticated  
**When:** POST /api/v1/upload/presign without JWT  
**Then:** Return 401 with problem+json

```bash
curl -X POST https://api.collectiq.com/api/v1/upload/presign \
  -H "Content-Type: application/json" \
  -d '{
    "contentType": "image/jpeg",
    "fileName": "card.jpg",
    "fileSizeBytes": 1048576
  }' | jq .
```

**Expected Response:**

```json
{
  "type": "https://collectiq.com/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Missing or invalid authentication token. Please sign in and try again.",
  "requestId": "..."
}
```

**Status:** ✅ PASS / ❌ FAIL

---

## Layer 2: S3 Bucket Policy Enforcement

### AC-2.1: S3 Rejects Oversized File

**Given:** Client bypasses presign validation  
**When:** Upload 13 MB file directly to S3 with valid presigned URL (for 10 MB)  
**Then:** S3 returns 403 Forbidden

```bash
# Get presigned URL for 10 MB
PRESIGN=$(curl -X POST https://api.collectiq.com/api/v1/upload/presign \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg","fileName":"test.jpg","fileSizeBytes":10485760}')

URL=$(echo $PRESIGN | jq -r '.url')
KEY=$(echo $PRESIGN | jq -r '.fields.key')

# Attempt to upload 13 MB file
curl -X POST $URL \
  -F "key=$KEY" \
  -F "Content-Type=image/jpeg" \
  -F "Policy=$(echo $PRESIGN | jq -r '.fields.Policy')" \
  -F "X-Amz-Signature=$(echo $PRESIGN | jq -r '.fields["X-Amz-Signature"]')" \
  -F "file=@test-fixtures/invalid-13mb.jpg"
```

**Expected Response:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>EntityTooLarge</Code>
  <Message>Your proposed upload exceeds the maximum allowed size</Message>
  <ProposedSize>13631488</ProposedSize>
  <MaxSizeAllowed>12582912</MaxSizeAllowed>
</Error>
```

**Assertions:**

- [ ] HTTP status is 403
- [ ] S3 error code is `EntityTooLarge`
- [ ] File is NOT stored in S3

**Status:** ✅ PASS / ❌ FAIL

---

### AC-2.2: S3 Rejects Wrong Content-Type

**Given:** Client uses presigned URL for JPEG  
**When:** Upload PNG file with JPEG Content-Type  
**Then:** S3 returns 403 Forbidden

```bash
# Get presigned URL for JPEG
PRESIGN=$(curl -X POST https://api.collectiq.com/api/v1/upload/presign \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg","fileName":"test.jpg","fileSizeBytes":5242880}')

# Attempt to upload PNG with JPEG presign
curl -X POST $(echo $PRESIGN | jq -r '.url') \
  -F "key=$(echo $PRESIGN | jq -r '.fields.key')" \
  -F "Content-Type=image/png" \
  -F "Policy=$(echo $PRESIGN | jq -r '.fields.Policy')" \
  -F "X-Amz-Signature=$(echo $PRESIGN | jq -r '.fields["X-Amz-Signature"]')" \
  -F "file=@test-fixtures/valid-5mb.png"
```

**Expected Response:**

```xml
<Error>
  <Code>AccessDenied</Code>
  <Message>Invalid according to Policy: Policy Condition failed: ["eq", "$Content-Type", "image/jpeg"]</Message>
</Error>
```

**Assertions:**

- [ ] HTTP status is 403
- [ ] S3 error code is `AccessDenied`
- [ ] File is NOT stored in S3

**Status:** ✅ PASS / ❌ FAIL

---

### AC-2.3: S3 Rejects Invalid Key Prefix

**Given:** Client attempts cross-user upload  
**When:** Upload to another user's key prefix  
**Then:** S3 returns 403 Forbidden

```bash
# Get presigned URL for user-123
PRESIGN=$(curl -X POST https://api.collectiq.com/api/v1/upload/presign \
  -H "Authorization: Bearer $JWT_USER_123" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg","fileName":"test.jpg","fileSizeBytes":5242880}')

# Modify key to user-456's prefix
MODIFIED_KEY="uploads/user-456/abc-def-456"

curl -X POST $(echo $PRESIGN | jq -r '.url') \
  -F "key=$MODIFIED_KEY" \
  -F "Content-Type=image/jpeg" \
  -F "Policy=$(echo $PRESIGN | jq -r '.fields.Policy')" \
  -F "X-Amz-Signature=$(echo $PRESIGN | jq -r '.fields["X-Amz-Signature"]')" \
  -F "file=@test-fixtures/valid-10mb.jpg"
```

**Expected Response:**

```xml
<Error>
  <Code>AccessDenied</Code>
  <Message>Invalid according to Policy: Policy Condition failed: ["starts-with", "$key", "uploads/user-123/"]</Message>
</Error>
```

**Status:** ✅ PASS / ❌ FAIL

---

## Layer 3: Post-Upload Validation

### AC-3.1: Accept Valid JPEG Upload

**Given:** Valid 10 MB JPEG uploaded to S3  
**When:** Ingestion Lambda processes upload  
**Then:** File passes validation and triggers Step Functions

```bash
# Upload valid JPEG
PRESIGN=$(curl -X POST https://api.collectiq.com/api/v1/upload/presign \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg","fileName":"charizard.jpg","fileSizeBytes":10485760}')

# Upload file
curl -X POST $(echo $PRESIGN | jq -r '.url') \
  -F "key=$(echo $PRESIGN | jq -r '.fields.key')" \
  -F "Content-Type=image/jpeg" \
  -F "Policy=$(echo $PRESIGN | jq -r '.fields.Policy')" \
  -F "X-Amz-Signature=$(echo $PRESIGN | jq -r '.fields["X-Amz-Signature"]')" \
  -F "file=@test-fixtures/valid-10mb.jpg"

# Wait for ingestion
sleep 5

# Check DynamoDB
aws dynamodb get-item \
  --table-name collectiq-test \
  --key "{\"PK\":{\"S\":\"USER#user-123\"},\"SK\":{\"S\":\"UPLOAD#$(echo $PRESIGN | jq -r '.key')\"}}"
```

**Assertions:**

- [ ] HTTP status is 204 (S3 upload success)
- [ ] File exists in S3
- [ ] DynamoDB record created with status `pending_processing`
- [ ] Step Functions execution started
- [ ] CloudWatch metric `upload_success` incremented
- [ ] Metadata extracted (width, height, exifOrientation)

**Status:** ✅ PASS / ❌ FAIL

---

### AC-3.2: Reject Mislabeled File (Magic Number Check)

**Given:** PNG file uploaded with JPEG Content-Type  
**When:** Ingestion Lambda detects MIME mismatch  
**Then:** File deleted, 415 error logged, metric emitted

```bash
# Get presigned URL for JPEG
PRESIGN=$(curl -X POST https://api.collectiq.com/api/v1/upload/presign \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg","fileName":"fake.jpg","fileSizeBytes":5242880}')

# Upload PNG file (mislabeled as JPEG)
curl -X POST $(echo $PRESIGN | jq -r '.url') \
  -F "key=$(echo $PRESIGN | jq -r '.fields.key')" \
  -F "Content-Type=image/jpeg" \
  -F "Policy=$(echo $PRESIGN | jq -r '.fields.Policy')" \
  -F "X-Amz-Signature=$(echo $PRESIGN | jq -r '.fields["X-Amz-Signature"]')" \
  -F "file=@test-fixtures/mislabeled.jpg"

# Wait for ingestion
sleep 5

# Verify file deleted
aws s3api head-object \
  --bucket collectiq-uploads-test \
  --key $(echo $PRESIGN | jq -r '.key') 2>&1 | grep "404"
```

**Assertions:**

- [ ] File uploaded successfully to S3 (204)
- [ ] Ingestion Lambda detects PNG magic number
- [ ] File deleted from S3 (404 on head-object)
- [ ] DynamoDB rejection record created
- [ ] CloudWatch metric `ingestion_rejected_mime_mismatch` incremented
- [ ] Structured log includes `detectedType: image/png`, `declaredType: image/jpeg`

**Status:** ✅ PASS / ❌ FAIL

---

### AC-3.3: Reject Oversized File (Post-Upload)

**Given:** 13 MB file slips through presign (edge case)  
**When:** Ingestion Lambda detects size violation  
**Then:** File deleted, 413 error logged, metric emitted

```bash
# Simulate oversized upload (manual S3 PUT, bypassing presign)
aws s3 cp test-fixtures/invalid-13mb.jpg \
  s3://collectiq-uploads-test/uploads/user-123/test-oversized.jpg \
  --metadata user-id=user-123,original-filename=huge.jpg

# Wait for ingestion
sleep 5

# Verify file deleted
aws s3api head-object \
  --bucket collectiq-uploads-test \
  --key uploads/user-123/test-oversized.jpg 2>&1 | grep "404"
```

**Assertions:**

- [ ] File deleted from S3
- [ ] CloudWatch metric `ingestion_rejected_too_large` incremented
- [ ] Structured log includes `receivedBytes: 13631488`, `maxBytes: 12582912`

**Status:** ✅ PASS / ❌ FAIL

---

## HEIC Handling

### AC-4.1: Accept HEIC Upload

**Given:** Valid 8 MB HEIC uploaded  
**When:** Ingestion Lambda processes HEIC  
**Then:** File accepted, background transcode queued

```bash
# Upload HEIC
PRESIGN=$(curl -X POST https://api.collectiq.com/api/v1/upload/presign \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/heic","fileName":"card.heic","fileSizeBytes":8388608}')

curl -X POST $(echo $PRESIGN | jq -r '.url') \
  -F "key=$(echo $PRESIGN | jq -r '.fields.key')" \
  -F "Content-Type=image/heic" \
  -F "Policy=$(echo $PRESIGN | jq -r '.fields.Policy')" \
  -F "X-Amz-Signature=$(echo $PRESIGN | jq -r '.fields["X-Amz-Signature"]')" \
  -F "file=@test-fixtures/valid-8mb.heic"

# Wait for transcode
sleep 10

# Check for JPEG derivative
aws s3 ls s3://collectiq-uploads-test/uploads/user-123/ | grep ".jpg"
```

**Assertions:**

- [ ] HEIC file stored in S3
- [ ] DynamoDB record includes `originalMime: image/heic`
- [ ] JPEG derivative created (`.heic` → `.jpg`)
- [ ] DynamoDB updated with `derivativeKey`, `derivativeMime`, `derivativeBytes`
- [ ] CloudWatch metric `heic_transcode_success` incremented

**Status:** ✅ PASS / ❌ FAIL

---

## Configuration

### AC-5.1: Config Endpoint Returns Current Limits

**Given:** Backend configured with MAX_UPLOAD_MB=12  
**When:** GET /api/v1/config  
**Then:** Return current constraints

```bash
curl -X GET https://api.collectiq.com/api/v1/config \
  -H "Authorization: Bearer $JWT_TOKEN" | jq .
```

**Expected Response:**

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
  },
  "version": "1.0.0"
}
```

**Status:** ✅ PASS / ❌ FAIL

---

### AC-5.2: Dynamic Configuration Change

**Given:** MAX_UPLOAD_MB changed from 12 to 10  
**When:** Lambda reloads environment variables  
**Then:** New presigns reflect updated limit

```bash
# Update environment variable
aws lambda update-function-configuration \
  --function-name collectiq-presign-handler \
  --environment "Variables={MAX_UPLOAD_MB=10,...}"

# Wait for update
sleep 5

# Request presign for 11 MB (should fail)
curl -X POST https://api.collectiq.com/api/v1/upload/presign \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg","fileName":"test.jpg","fileSizeBytes":11534336}' | jq .
```

**Expected Response:**

```json
{
  "type": "https://collectiq.com/errors/file-too-large",
  "title": "File Too Large",
  "status": 400,
  "detail": "File size 11534336 bytes exceeds maximum 10485760 bytes (10 MB)",
  "maxMB": 10,
  "receivedBytes": 11534336
}
```

**Status:** ✅ PASS / ❌ FAIL

---

## Observability

### AC-6.1: Metrics Emitted for All Rejection Paths

**Given:** Various rejection scenarios executed  
**When:** Query CloudWatch metrics  
**Then:** All metrics present with correct counts

```bash
# Query metrics
aws cloudwatch get-metric-statistics \
  --namespace CollectIQ/Uploads \
  --metric-name presign_denied_too_large \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

**Expected Metrics:**

- [ ] `presign_denied_too_large` > 0
- [ ] `presign_denied_bad_type` > 0
- [ ] `ingestion_rejected_mime_mismatch` > 0
- [ ] `upload_success` > 0

**Status:** ✅ PASS / ❌ FAIL

---

### AC-6.2: Structured Logs Include Request Context

**Given:** Upload rejection occurs  
**When:** Query CloudWatch Logs  
**Then:** Logs include requestId, userId, bytes, mime

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/collectiq-presign-handler \
  --filter-pattern '{ $.errorType = "unsupported-media-type" }' \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

**Expected Log Entry:**

```json
{
  "timestamp": "2025-10-17T14:30:00.123Z",
  "level": "WARN",
  "message": "Presign request rejected",
  "requestId": "abc-123-def-456",
  "userId": "user-123",
  "errorType": "unsupported-media-type",
  "requestedType": "image/gif",
  "allowedTypes": ["image/jpeg", "image/png", "image/heic"]
}
```

**Status:** ✅ PASS / ❌ FAIL

---

## Performance

### AC-7.1: Presign Response Time < 500ms

**Given:** Normal load conditions  
**When:** Request presigned URL  
**Then:** Response time < 500ms (p95)

```bash
# Load test with Apache Bench
ab -n 1000 -c 10 -H "Authorization: Bearer $JWT_TOKEN" \
  -p presign-payload.json -T application/json \
  https://api.collectiq.com/api/v1/upload/presign
```

**Expected:**

- [ ] p50 < 200ms
- [ ] p95 < 500ms
- [ ] p99 < 1000ms

**Status:** ✅ PASS / ❌ FAIL

---

### AC-7.2: Ingestion Processing Time < 5s

**Given:** Valid upload to S3  
**When:** Ingestion Lambda processes file  
**Then:** DynamoDB record created within 5 seconds

```bash
# Measure time from S3 upload to DynamoDB record
START=$(date +%s)
# ... upload file ...
# ... poll DynamoDB ...
END=$(date +%s)
DURATION=$((END - START))
echo "Ingestion took ${DURATION}s"
```

**Expected:**

- [ ] Duration < 5 seconds

**Status:** ✅ PASS / ❌ FAIL

---

## Security

### AC-8.1: Cross-User Upload Prevented

**Given:** User A's JWT token  
**When:** Attempt to upload to User B's key prefix  
**Then:** S3 rejects with 403

**Status:** ✅ PASS / ❌ FAIL (covered in AC-2.3)

---

### AC-8.2: Expired JWT Rejected

**Given:** Expired JWT token  
**When:** Request presigned URL  
**Then:** Return 401 with token-expired error

```bash
curl -X POST https://api.collectiq.com/api/v1/upload/presign \
  -H "Authorization: Bearer $EXPIRED_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg","fileName":"test.jpg","fileSizeBytes":1048576}'
```

**Expected Response:**

```json
{
  "type": "https://collectiq.com/errors/token-expired",
  "title": "Token Expired",
  "status": 401,
  "detail": "Your authentication token has expired. Please sign in again.",
  "expiredAt": "2025-10-17T14:30:00Z"
}
```

**Status:** ✅ PASS / ❌ FAIL

---

## Summary

### Test Results

| Category           | Total  | Passed | Failed | Skipped |
| ------------------ | ------ | ------ | ------ | ------- |
| Layer 1: Presign   | 4      | 0      | 0      | 0       |
| Layer 2: S3 Policy | 3      | 0      | 0      | 0       |
| Layer 3: Ingestion | 3      | 0      | 0      | 0       |
| HEIC Handling      | 1      | 0      | 0      | 0       |
| Configuration      | 2      | 0      | 0      | 0       |
| Observability      | 2      | 0      | 0      | 0       |
| Performance        | 2      | 0      | 0      | 0       |
| Security           | 2      | 0      | 0      | 0       |
| **Total**          | **19** | **0**  | **0**  | **0**   |

### Sign-Off

- [ ] All acceptance tests passed
- [ ] Performance benchmarks met
- [ ] Security tests passed
- [ ] Observability verified
- [ ] Documentation complete

**Approved by:** **\*\*\*\***\_\_\_**\*\*\*\***  
**Date:** **\*\*\*\***\_\_\_**\*\*\*\***
