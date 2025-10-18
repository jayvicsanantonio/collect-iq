# S3 Presigned POST Policy Examples

## Overview

This document provides concrete examples of S3 presigned POST policies used in CollectIQ's defense-in-depth upload validation strategy. These policies enforce constraints at the S3 layer, preventing unauthorized or non-compliant uploads even if clients bypass API validation.

---

## Basic Presigned POST Policy

### Single Content-Type Policy

```json
{
  "expiration": "2025-10-17T15:00:00Z",
  "conditions": [
    ["content-length-range", 1, 12582912],
    ["eq", "$Content-Type", "image/jpeg"],
    ["starts-with", "$key", "uploads/user-123/"]
  ]
}
```

**Enforcement:**

- File size: 1 byte to 12 MB (12,582,912 bytes)
- Content-Type: Must be exactly `image/jpeg`
- Key prefix: Must start with `uploads/user-123/` (user isolation)

---

## Per-Type Presigned URLs

### Strategy

Generate separate presigned URLs for each allowed MIME type. Client selects the appropriate URL based on file type.

### Implementation

```typescript
// services/backend/src/handlers/presign.ts
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic'];

export async function generatePresignedUrls(userId: string, fileName: string) {
  const s3Client = new S3Client({ region: process.env.AWS_REGION });
  const maxBytes = parseInt(process.env.MAX_UPLOAD_MB || '12') * 1024 * 1024;
  const ttl = parseInt(process.env.PRESIGN_TTL_SECONDS || '300');

  const presignedUrls = await Promise.all(
    ALLOWED_MIME_TYPES.map(async (mimeType) => {
      const key = `uploads/${userId}/${crypto.randomUUID()}`;

      const { url, fields } = await createPresignedPost(s3Client, {
        Bucket: process.env.UPLOAD_BUCKET,
        Key: key,
        Conditions: [
          ['content-length-range', 1, maxBytes],
          ['eq', '$Content-Type', mimeType],
          ['starts-with', '$key', `uploads/${userId}/`],
          ['eq', '$x-amz-meta-user-id', userId],
          ['eq', '$x-amz-meta-original-filename', fileName],
        ],
        Fields: {
          'Content-Type': mimeType,
          'x-amz-meta-user-id': userId,
          'x-amz-meta-original-filename': fileName,
          'x-amz-meta-upload-source': 'web',
        },
        Expires: ttl,
      });

      return { mimeType, url, fields, key };
    }),
  );

  return {
    presignedUrls,
    maxSizeBytes: maxBytes,
    expiresIn: ttl,
  };
}
```

### Response Example

```json
{
  "presignedUrls": [
    {
      "mimeType": "image/jpeg",
      "url": "https://collectiq-uploads.s3.amazonaws.com",
      "fields": {
        "key": "uploads/user-123/abc-def-456",
        "Content-Type": "image/jpeg",
        "x-amz-meta-user-id": "user-123",
        "x-amz-meta-original-filename": "charizard.jpg",
        "x-amz-meta-upload-source": "web",
        "Policy": "eyJleHBpcmF0aW9uIjoiMjAyNS0xMC0xN1QxNTowMDowMFoiLCJjb25kaXRpb25zIjpbWyJjb250ZW50LWxlbmd0aC1yYW5nZSIsMSwxMjU4MjkxMl0sWyJlcSIsIiRDb250ZW50LVR5cGUiLCJpbWFnZS9qcGVnIl0sWyJzdGFydHMtd2l0aCIsIiRrZXkiLCJ1cGxvYWRzL3VzZXItMTIzLyJdXX0=",
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": "AKIAIOSFODNN7EXAMPLE/20251017/us-east-1/s3/aws4_request",
        "X-Amz-Date": "20251017T140000Z",
        "X-Amz-Signature": "abc123def456..."
      },
      "key": "uploads/user-123/abc-def-456"
    },
    {
      "mimeType": "image/png",
      "url": "https://collectiq-uploads.s3.amazonaws.com",
      "fields": {
        "key": "uploads/user-123/ghi-jkl-789",
        "Content-Type": "image/png",
        "x-amz-meta-user-id": "user-123",
        "x-amz-meta-original-filename": "charizard.png",
        "x-amz-meta-upload-source": "web",
        "Policy": "eyJleHBpcmF0aW9uIjoiMjAyNS0xMC0xN1QxNTowMDowMFoiLCJjb25kaXRpb25zIjpbWyJjb250ZW50LWxlbmd0aC1yYW5nZSIsMSwxMjU4MjkxMl0sWyJlcSIsIiRDb250ZW50LVR5cGUiLCJpbWFnZS9wbmciXSxbInN0YXJ0cy13aXRoIiwiJGtleSIsInVwbG9hZHMvdXNlci0xMjMvIl1dfQ==",
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": "AKIAIOSFODNN7EXAMPLE/20251017/us-east-1/s3/aws4_request",
        "X-Amz-Date": "20251017T140000Z",
        "X-Amz-Signature": "xyz789ghi012..."
      },
      "key": "uploads/user-123/ghi-jkl-789"
    },
    {
      "mimeType": "image/heic",
      "url": "https://collectiq-uploads.s3.amazonaws.com",
      "fields": {
        "key": "uploads/user-123/mno-pqr-345",
        "Content-Type": "image/heic",
        "x-amz-meta-user-id": "user-123",
        "x-amz-meta-original-filename": "charizard.heic",
        "x-amz-meta-upload-source": "web",
        "Policy": "eyJleHBpcmF0aW9uIjoiMjAyNS0xMC0xN1QxNTowMDowMFoiLCJjb25kaXRpb25zIjpbWyJjb250ZW50LWxlbmd0aC1yYW5nZSIsMSwxMjU4MjkxMl0sWyJlcSIsIiRDb250ZW50LVR5cGUiLCJpbWFnZS9oZWljIl0sWyJzdGFydHMtd2l0aCIsIiRrZXkiLCJ1cGxvYWRzL3VzZXItMTIzLyJdXX0=",
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": "AKIAIOSFODNN7EXAMPLE/20251017/us-east-1/s3/aws4_request",
        "X-Amz-Date": "20251017T140000Z",
        "X-Amz-Signature": "stu901vwx234..."
      },
      "key": "uploads/user-123/mno-pqr-345"
    }
  ],
  "maxSizeBytes": 12582912,
  "expiresIn": 300
}
```

---

## Policy Conditions Reference

### content-length-range

Enforces file size limits:

```json
["content-length-range", minBytes, maxBytes]
```

**Examples:**

```json
// 1 byte to 12 MB
["content-length-range", 1, 12582912]

// 100 KB to 5 MB
["content-length-range", 102400, 5242880]

// Exactly 1 MB (not recommended, use range)
["content-length-range", 1048576, 1048576]
```

### eq (Exact Match)

Requires exact value match:

```json
["eq", "$fieldName", "value"]
```

**Examples:**

```json
// Content-Type must be image/jpeg
["eq", "$Content-Type", "image/jpeg"]

// User ID must match
["eq", "$x-amz-meta-user-id", "user-123"]

// Server-side encryption required
["eq", "$x-amz-server-side-encryption", "AES256"]
```

### starts-with (Prefix Match)

Requires value to start with prefix:

```json
["starts-with", "$fieldName", "prefix"]
```

**Examples:**

```json
// Key must start with user's upload directory
["starts-with", "$key", "uploads/user-123/"]

// Allow any Content-Type starting with "image/"
["starts-with", "$Content-Type", "image/"]

// Metadata prefix
["starts-with", "$x-amz-meta-category", "pokemon-"]
```

### acl (Access Control)

Enforces object ACL:

```json
["eq", "$acl", "private"]
```

**Examples:**

```json
// Private objects only
["eq", "$acl", "private"]

// Public read (not recommended for user uploads)
["eq", "$acl", "public-read"]
```

---

## Advanced Policy Examples

### Multi-Condition Policy

```json
{
  "expiration": "2025-10-17T15:00:00Z",
  "conditions": [
    ["content-length-range", 1, 12582912],
    ["eq", "$Content-Type", "image/jpeg"],
    ["starts-with", "$key", "uploads/user-123/"],
    ["eq", "$x-amz-meta-user-id", "user-123"],
    ["eq", "$x-amz-meta-upload-source", "web"],
    ["eq", "$x-amz-server-side-encryption", "AES256"],
    ["eq", "$acl", "private"]
  ]
}
```

### Wildcard Content-Type (Not Recommended)

```json
{
  "expiration": "2025-10-17T15:00:00Z",
  "conditions": [
    ["content-length-range", 1, 12582912],
    ["starts-with", "$Content-Type", "image/"],
    ["starts-with", "$key", "uploads/user-123/"]
  ]
}
```

**Warning:** This allows any `image/*` type (e.g., `image/gif`, `image/webp`). Use exact `eq` conditions for strict validation.

### Metadata-Rich Policy

```json
{
  "expiration": "2025-10-17T15:00:00Z",
  "conditions": [
    ["content-length-range", 1, 12582912],
    ["eq", "$Content-Type", "image/jpeg"],
    ["starts-with", "$key", "uploads/user-123/"],
    ["eq", "$x-amz-meta-user-id", "user-123"],
    ["eq", "$x-amz-meta-original-filename", "charizard.jpg"],
    ["eq", "$x-amz-meta-upload-source", "web"],
    ["eq", "$x-amz-meta-compressed-client", "true"],
    ["eq", "$x-amz-meta-client-version", "1.0.0"]
  ]
}
```

---

## Client Upload Example

### JavaScript (Browser)

```typescript
// apps/web/lib/upload-client.ts
export async function uploadToS3(
  presignedUrl: { url: string; fields: Record<string, string> },
  file: File,
): Promise<string> {
  const formData = new FormData();

  // Add all presigned fields first
  Object.entries(presignedUrl.fields).forEach(([key, value]) => {
    formData.append(key, value);
  });

  // Add file last (required by S3)
  formData.append('file', file);

  const response = await fetch(presignedUrl.url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`S3 upload failed: ${response.status} ${text}`);
  }

  return presignedUrl.fields.key;
}
```

### cURL Example

```bash
# Get presigned URL
PRESIGN_RESPONSE=$(curl -X POST https://api.collectiq.com/api/v1/upload/presign \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contentType": "image/jpeg",
    "fileName": "charizard.jpg",
    "fileSizeBytes": 8388608
  }')

# Extract fields
URL=$(echo $PRESIGN_RESPONSE | jq -r '.url')
KEY=$(echo $PRESIGN_RESPONSE | jq -r '.fields.key')
CONTENT_TYPE=$(echo $PRESIGN_RESPONSE | jq -r '.fields["Content-Type"]')
POLICY=$(echo $PRESIGN_RESPONSE | jq -r '.fields.Policy')
SIGNATURE=$(echo $PRESIGN_RESPONSE | jq -r '.fields["X-Amz-Signature"]')
# ... extract other fields

# Upload file
curl -X POST $URL \
  -F "key=$KEY" \
  -F "Content-Type=$CONTENT_TYPE" \
  -F "Policy=$POLICY" \
  -F "X-Amz-Signature=$SIGNATURE" \
  -F "file=@charizard.jpg"
```

---

## S3 Rejection Scenarios

### Scenario 1: Oversized File

**Policy:**

```json
["content-length-range", 1, 12582912]
```

**Upload Attempt:**

```bash
curl -X POST https://collectiq-uploads.s3.amazonaws.com \
  -F "key=uploads/user-123/abc" \
  -F "Content-Type=image/jpeg" \
  -F "Policy=..." \
  -F "X-Amz-Signature=..." \
  -F "file=@15mb-image.jpg"  # 15 MB file
```

**S3 Response:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>EntityTooLarge</Code>
  <Message>Your proposed upload exceeds the maximum allowed size</Message>
  <ProposedSize>15728640</ProposedSize>
  <MaxSizeAllowed>12582912</MaxSizeAllowed>
  <RequestId>ABC123DEF456</RequestId>
  <HostId>xyz789...</HostId>
</Error>
```

**HTTP Status:** `403 Forbidden`

---

### Scenario 2: Wrong Content-Type

**Policy:**

```json
["eq", "$Content-Type", "image/jpeg"]
```

**Upload Attempt:**

```bash
curl -X POST https://collectiq-uploads.s3.amazonaws.com \
  -F "key=uploads/user-123/abc" \
  -F "Content-Type=image/png" \  # PNG instead of JPEG
  -F "Policy=..." \
  -F "X-Amz-Signature=..." \
  -F "file=@image.png"
```

**S3 Response:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>AccessDenied</Code>
  <Message>Invalid according to Policy: Policy Condition failed: ["eq", "$Content-Type", "image/jpeg"]</Message>
  <RequestId>GHI789JKL012</RequestId>
  <HostId>mno345...</HostId>
</Error>
```

**HTTP Status:** `403 Forbidden`

---

### Scenario 3: Invalid Key Prefix

**Policy:**

```json
["starts-with", "$key", "uploads/user-123/"]
```

**Upload Attempt:**

```bash
curl -X POST https://collectiq-uploads.s3.amazonaws.com \
  -F "key=uploads/user-456/abc" \  # Different user ID
  -F "Content-Type=image/jpeg" \
  -F "Policy=..." \
  -F "X-Amz-Signature=..." \
  -F "file=@image.jpg"
```

**S3 Response:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>AccessDenied</Code>
  <Message>Invalid according to Policy: Policy Condition failed: ["starts-with", "$key", "uploads/user-123/"]</Message>
  <RequestId>PQR345STU678</RequestId>
  <HostId>vwx901...</HostId>
</Error>
```

**HTTP Status:** `403 Forbidden`

---

## Bucket Policy Enforcement

### Deny Unencrypted Uploads

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
    }
  ]
}
```

### Deny Uploads Without User Metadata

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyUploadsWithoutUserMetadata",
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

### Enforce Content-Type Prefix

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EnforceImageContentType",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::collectiq-uploads-hackathon/uploads/*",
      "Condition": {
        "StringNotLike": {
          "s3:content-type": "image/*"
        }
      }
    }
  ]
}
```

---

## Terraform Implementation

### Presigned POST Module

```hcl
# infra/terraform/modules/s3_uploads/presign.tf

locals {
  max_upload_bytes = var.max_upload_mb * 1024 * 1024
}

resource "aws_iam_policy" "presign_policy" {
  name        = "${var.environment}-collectiq-presign-policy"
  description = "Allow Lambda to generate presigned POSTs"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl"
        ]
        Resource = "${aws_s3_bucket.uploads.arn}/uploads/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-server-side-encryption" = "AES256"
          }
          NumericLessThanEquals = {
            "s3:content-length" = local.max_upload_bytes
          }
        }
      }
    ]
  })
}
```

---

## Testing

### Unit Test: Policy Generation

```typescript
import { describe, it, expect } from 'vitest';
import { generatePresignedUrls } from './presign';

describe('Presigned URL Generation', () => {
  it('generates policies with correct conditions', async () => {
    const result = await generatePresignedUrls('user-123', 'test.jpg');

    const jpegUrl = result.presignedUrls.find((u) => u.mimeType === 'image/jpeg');
    expect(jpegUrl).toBeDefined();

    // Decode policy
    const policy = JSON.parse(Buffer.from(jpegUrl.fields.Policy, 'base64').toString('utf-8'));

    // Verify conditions
    expect(policy.conditions).toContainEqual(['content-length-range', 1, 12582912]);
    expect(policy.conditions).toContainEqual(['eq', '$Content-Type', 'image/jpeg']);
    expect(policy.conditions).toContainEqual(['starts-with', '$key', 'uploads/user-123/']);
  });
});
```

### Integration Test: S3 Rejection

```typescript
import { describe, it, expect } from 'vitest';
import { uploadToS3 } from './upload-client';

describe('S3 Policy Enforcement', () => {
  it('rejects oversized file', async () => {
    const presignedUrl = await getPresignedUrl('image/jpeg');
    const oversizedFile = new File([new ArrayBuffer(15 * 1024 * 1024)], 'huge.jpg', {
      type: 'image/jpeg',
    });

    await expect(uploadToS3(presignedUrl, oversizedFile)).rejects.toThrow('403');
  });

  it('rejects wrong Content-Type', async () => {
    const presignedUrl = await getPresignedUrl('image/jpeg');
    const pngFile = new File([new Uint8Array([137, 80, 78, 71])], 'fake.jpg', {
      type: 'image/png', // PNG file with JPEG presign
    });

    await expect(uploadToS3(presignedUrl, pngFile)).rejects.toThrow('403');
  });
});
```

---

## References

- [AWS S3 Presigned POST](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-post-example.html)
- [S3 POST Policy Conditions](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html)
- [S3 Bucket Policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-policies.html)
- [AWS SDK for JavaScript v3 - S3 Presigned POST](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-presigned-post/)
