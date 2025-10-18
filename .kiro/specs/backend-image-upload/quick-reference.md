# Backend Image Upload Quick Reference

## 🚀 Quick Start

### Upload Flow (3 Layers)

```
1. Client → POST /api/v1/upload/presign
   ✓ Validate type & size

2. Client → S3 presigned POST
   ✓ S3 policy enforcement

3. S3 → EventBridge → Lambda
   ✓ Magic number check
```

---

## 📋 Constraints

```bash
MAX_SIZE:  12 MB (12,582,912 bytes)
TYPES:     image/jpeg, image/png, image/heic
PRESIGN:   300 seconds (5 minutes)
```

---

## 🔧 Environment Variables

```bash
# Required
MAX_UPLOAD_MB=12
ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic
PRESIGN_TTL_SECONDS=300
UPLOAD_BUCKET=collectiq-uploads-hackathon
TABLE_NAME=collectiq-hackathon

# Optional
QUARANTINE_BUCKET=collectiq-quarantine-hackathon
CLOUDWATCH_NAMESPACE=CollectIQ/Uploads
LOG_LEVEL=INFO
```

---

## 📡 API Endpoints

### Generate Presigned URL

```bash
POST /api/v1/upload/presign
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "contentType": "image/jpeg",
  "fileName": "charizard.jpg",
  "fileSizeBytes": 8388608
}
```

**Response (200):**

```json
{
  "url": "https://...",
  "fields": { "key": "...", "Policy": "...", ... },
  "maxSizeBytes": 12582912,
  "acceptedTypes": ["image/jpeg", "image/png", "image/heic"],
  "expiresIn": 300
}
```

### Get Configuration

```bash
GET /api/v1/config
Authorization: Bearer <JWT>
```

**Response (200):**

```json
{
  "upload": {
    "maxSizeBytes": 12582912,
    "maxSizeMB": 12,
    "allowedMimeTypes": ["image/jpeg", "image/png", "image/heic"]
  }
}
```

---

## ❌ Error Responses (RFC 7807)

### 400 - File Too Large

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

### 400 - Unsupported Media Type

```json
{
  "type": "https://collectiq.com/errors/unsupported-media-type",
  "title": "Unsupported Media Type",
  "status": 400,
  "detail": "Content-Type 'image/gif' is not allowed",
  "allowedTypes": ["image/jpeg", "image/png", "image/heic"]
}
```

### 413 - Payload Too Large (Post-Upload)

```json
{
  "type": "https://collectiq.com/errors/payload-too-large",
  "title": "Payload Too Large",
  "status": 413,
  "detail": "Uploaded file size exceeds maximum. The file has been deleted.",
  "action": "deleted"
}
```

### 415 - MIME Mismatch (Magic Number)

```json
{
  "type": "https://collectiq.com/errors/unsupported-media-type",
  "title": "Unsupported Media Type",
  "status": 415,
  "detail": "File magic number indicates type 'image/png', but Content-Type was 'image/jpeg'",
  "declaredType": "image/jpeg",
  "detectedType": "image/png",
  "action": "deleted"
}
```

---

## 📊 CloudWatch Metrics

```typescript
// Namespace: CollectIQ/Uploads
presign_denied_too_large; // Presign rejected (size)
presign_denied_bad_type; // Presign rejected (type)
presign_success; // Presign generated
ingestion_rejected_mime_mismatch; // Upload rejected (MIME)
ingestion_rejected_too_large; // Upload rejected (size)
upload_success; // Upload successful
heic_transcode_success; // HEIC → JPEG transcode
```

---

## 🔍 Debugging

### Check Presign Logs

```bash
aws logs tail /aws/lambda/collectiq-presign-handler --follow
```

### Check Ingestion Logs

```bash
aws logs tail /aws/lambda/collectiq-ingestion-handler --follow
```

### Query Metrics

```bash
aws cloudwatch get-metric-statistics \
  --namespace CollectIQ/Uploads \
  --metric-name upload_success \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Check S3 Object

```bash
aws s3api head-object \
  --bucket collectiq-uploads-hackathon \
  --key uploads/user-123/abc-def-456
```

### Check DynamoDB Record

```bash
aws dynamodb get-item \
  --table-name collectiq-hackathon \
  --key '{"PK":{"S":"USER#user-123"},"SK":{"S":"UPLOAD#uploads/user-123/abc-def-456"}}'
```

---

## 🧪 Testing

### Unit Test (Presign Validation)

```typescript
it('rejects oversized file', async () => {
  const response = await handler({
    body: JSON.stringify({
      contentType: 'image/jpeg',
      fileSizeBytes: 15 * 1024 * 1024,
    }),
  });
  expect(response.statusCode).toBe(400);
  expect(JSON.parse(response.body).maxMB).toBe(12);
});
```

### Integration Test (S3 Policy)

```typescript
it('S3 rejects oversized upload', async () => {
  const presign = await getPresignedUrl('image/jpeg', 10 * 1024 * 1024);
  const file = new File([new ArrayBuffer(15 * 1024 * 1024)], 'huge.jpg');
  await expect(uploadToS3(presign, file)).rejects.toThrow('403');
});
```

### E2E Test (Complete Flow)

```typescript
it('completes upload flow', async () => {
  const presign = await getPresignedUrl('image/jpeg', 5 * 1024 * 1024);
  const file = new File([validJpegBuffer], 'card.jpg');
  const key = await uploadToS3(presign, file);
  await waitForIngestion(key);
  const record = await getDynamoRecord(key);
  expect(record.status).toBe('pending_processing');
});
```

---

## 🔐 Security Checklist

- [ ] JWT validation on all endpoints
- [ ] User-scoped S3 key prefixes (`uploads/{userId}/`)
- [ ] Server-side encryption (SSE-S3 or SSE-KMS)
- [ ] Bucket policy denies unencrypted uploads
- [ ] Bucket policy requires user-id metadata
- [ ] Magic number validation (don't trust headers)
- [ ] Rate limiting (10 uploads/minute)
- [ ] CORS configured for web domain only

---

## 📚 Documentation

- [Complete Spec](./image-upload-spec.md) - Full technical specification
- [Presign Policies](./presign-policy-examples.md) - S3 policy examples
- [Error Contract](../api/errors.md) - RFC 7807 error responses
- [OpenAPI Spec](../api/openapi.yaml) - API definition
- [Configuration](../config.md) - Environment variables
- [Acceptance Tests](./acceptance-tests.md) - Test scenarios

---

## 🆘 Common Issues

### Issue: S3 returns 403 on upload

**Cause:** Policy condition mismatch  
**Fix:** Verify Content-Type matches presigned URL type

### Issue: File uploaded but not processed

**Cause:** EventBridge rule not triggered  
**Fix:** Check S3 event notification configuration

### Issue: Ingestion rejects valid file

**Cause:** Magic number detection false positive  
**Fix:** Verify file is not corrupted, check file-type library version

### Issue: Presign returns 400 for valid request

**Cause:** Environment variable not set  
**Fix:** Verify MAX_UPLOAD_MB and ALLOWED_UPLOAD_MIME

---

## 🎯 Performance Targets

| Metric               | Target  | Current |
| -------------------- | ------- | ------- |
| Presign p95          | < 500ms | -       |
| Ingestion p95        | < 5s    | -       |
| Upload success rate  | > 99%   | -       |
| False rejection rate | < 0.1%  | -       |

---

## 📞 Support

- **Slack**: #collectiq-backend
- **Email**: backend-team@collectiq.com
- **On-call**: PagerDuty rotation
