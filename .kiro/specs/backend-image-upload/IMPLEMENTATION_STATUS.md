# Implementation Status

## Overview

This document tracks what has already been implemented in the backend codebase and what still needs to be done for the image upload specification.

---

## ✅ Already Implemented

### 1. Project Structure & Utilities (Task 1)

**Status**: 90% Complete

**What exists:**

- ✅ Directory structure (`src/handlers/`, `src/utils/`, `src/store/`, `src/adapters/`)
- ✅ RFC 7807 error responses (`src/utils/errors.ts`)
  - `HttpError`, `BadRequestError`, `UnauthorizedError`, `ForbiddenError`
  - `PayloadTooLargeError`, `TooManyRequestsError`, etc.
  - `toProblemDetails()` method for RFC 7807 format
- ✅ CloudWatch metrics via `@collectiq/telemetry`
- ✅ Structured logging via `@collectiq/telemetry`
- ✅ X-Ray tracing via `src/utils/tracing.ts`
- ✅ TypeScript configuration
- ✅ DynamoDB client (`src/store/dynamodb-client.ts`)
- ✅ Validation utilities (`src/utils/validation.ts`)
  - `validate()`, `safeParse()`, `sanitizeFilename()`
  - `validateMimeType()`, `validateFileSize()`
  - `getEnvVar()`, `getEnvArray()`, `getEnvNumber()`

**What's missing:**

- ⚠️ Constants file for `ALLOWED_MIME_TYPES` and `MAX_UPLOAD_MB` defaults
- ⚠️ Helper function for emitting upload-specific metrics

---

### 2. Presign Handler (Task 2)

**Status**: 70% Complete (needs refactoring)

**What exists:**

- ✅ Handler file: `src/handlers/upload_presign.ts`
- ✅ JWT validation and user extraction (`getUserId()`)
- ✅ Request body validation using Zod
- ✅ Content-Type validation (`validateMimeType()`)
- ✅ File size validation (`validateFileSize()`)
- ✅ S3 key generation: `uploads/{userId}/{uuid}-{filename}`
- ✅ Presigned URL generation (but uses PUT, not POST)
- ✅ KMS encryption configuration
- ✅ Metadata fields (uploaded-by, original-filename)
- ✅ Error handling with RFC 7807 format
- ✅ Structured logging
- ✅ X-Ray tracing
- ✅ Unit tests (`src/tests/upload_presign.test.ts`)

**What needs refactoring:**

- ⚠️ **Currently uses presigned PUT** (`getSignedUrl`) instead of presigned POST (`createPresignedPost`)
- ⚠️ Missing S3 policy conditions (content-length-range, eq Content-Type, starts-with key)
- ⚠️ Response format doesn't match spec (missing `fields`, `maxSizeBytes`, `acceptedTypes`)
- ⚠️ Hardcoded expiration (60s) instead of using `PRESIGN_TTL_SECONDS` env var
- ⚠️ Error responses don't include extension members (`allowedTypes`, `maxMB`, `receivedBytes`)
- ⚠️ Missing metric emission (`presign_denied_too_large`, `presign_denied_bad_type`, `presign_success`)
- ⚠️ Expiration is 60s instead of 300s (spec default)

**Files to modify:**

- `src/handlers/upload_presign.ts` - Refactor to use presigned POST
- `src/tests/upload_presign.test.ts` - Update tests for new format

---

### 3. Shared Utilities (Task 7)

**Status**: 95% Complete

**What exists:**

- ✅ RFC 7807 error helper (`src/utils/errors.ts`)
- ✅ CloudWatch metrics (`@collectiq/telemetry`)
- ✅ Structured logging (`@collectiq/telemetry`)
- ✅ X-Ray tracing (`src/utils/tracing.ts`)
- ✅ Response headers (`src/utils/response-headers.ts`)
- ✅ Validation helpers (`src/utils/validation.ts`)

**What's missing:**

- ⚠️ Upload-specific metric emission helper (optional, can use existing metrics)

---

### 4. DynamoDB Setup (Task 10)

**Status**: 80% Complete

**What exists:**

- ✅ DynamoDB client (`src/store/dynamodb-client.ts`)
- ✅ Connection pooling and retry logic
- ✅ X-Ray instrumentation
- ✅ Table name from environment variable
- ✅ Card service with CRUD operations (`src/store/card-service.ts`)

**What's missing:**

- ⚠️ Upload record schema (PK=USER#{userId}, SK=UPLOAD#{s3Key})
- ⚠️ Rejection record schema (PK=REJECTED#{s3Key}, SK=TIMESTAMP#{timestamp})
- ⚠️ Functions to save/retrieve upload records

---

### 5. Authentication (Task 11)

**Status**: 100% Complete

**What exists:**

- ✅ JWT validation via API Gateway authorizer
- ✅ JWT claims extraction (`src/auth/jwt-claims.ts`)
- ✅ `getUserId()`, `extractJwtClaims()`, `hasGroup()`, `requireGroup()`
- ✅ Ownership enforcement (`src/auth/ownership.ts`)
- ✅ 401 error responses

---

## ❌ Not Implemented

### 1. S3 Bucket Configuration (Task 3)

**Status**: 0% Complete

**What's needed:**

- S3 bucket with Terraform
- Bucket policy (deny unencrypted, enforce metadata)
- Lifecycle rules (delete after 24h)
- EventBridge notification for s3:ObjectCreated:\*
- CORS configuration

**Files to create:**

- `infra/terraform/modules/s3_upload_bucket/` (if not exists)
- Bucket policy JSON
- EventBridge rule configuration

---

### 2. Ingestion Handler (Task 4)

**Status**: 0% Complete

**What's needed:**

- Lambda handler: `src/handlers/upload_ingestion.ts`
- S3 event processing
- File size verification
- Magic number validation (file-type library)
- Metadata extraction (sharp library)
- DynamoDB upload record creation
- Step Functions trigger
- Object deletion on validation failure
- Rejection record creation

**Dependencies:**

- `file-type` npm package
- `sharp` npm package
- EventBridge trigger configuration

---

### 3. HEIC Transcode Handler (Task 5)

**Status**: 0% Complete

**What's needed:**

- Lambda handler: `src/handlers/heic_transcode.ts`
- HEIC to JPEG conversion (sharp library)
- Derivative upload to S3
- DynamoDB update with derivative info
- Error handling and metrics

**Dependencies:**

- `sharp` with HEIC support (libheif)
- EventBridge trigger for HEIC uploads

---

### 4. Config Endpoint (Task 6)

**Status**: 0% Complete

**What's needed:**

- Lambda handler: `src/handlers/upload_config.ts`
- Return upload constraints (maxSizeBytes, maxSizeMB, allowedMimeTypes, etc.)
- Return feature flags (heicSupport, clientCompression)
- API Gateway route: GET /api/v1/config

---

### 5. API Gateway Configuration (Task 8)

**Status**: Partial (JWT authorizer exists)

**What exists:**

- ✅ JWT authorizer with Cognito

**What's needed:**

- POST /api/v1/upload/presign route
- GET /api/v1/config route
- Rate limiting (10 req/s per user)
- CORS configuration

---

### 6. EventBridge Rules (Task 9)

**Status**: 0% Complete

**What's needed:**

- Custom event bus: `collectiq-events-{environment}`
- Rule: S3 ObjectCreated → Ingestion Lambda
- Rule: HEIC upload → HEIC Transcode Lambda

---

### 7. Observability (Task 12)

**Status**: Partial (infrastructure exists)

**What exists:**

- ✅ CloudWatch metrics infrastructure
- ✅ Structured logging infrastructure
- ✅ X-Ray tracing infrastructure

**What's needed:**

- CloudWatch dashboard for upload metrics
- CloudWatch alarms (high error rate, high latency, failed Step Functions)
- SNS topic for alerts

---

### 8. Integration Tests (Task 13)

**Status**: 0% Complete

**What's needed:**

- S3 policy enforcement tests
- End-to-end upload flow tests
- HEIC transcode tests
- Rejection flow tests

---

### 9. Terraform Deployment (Task 14)

**Status**: Partial (some modules exist)

**What exists:**

- ✅ Terraform structure exists
- ✅ Some Lambda modules

**What's needed:**

- S3 upload bucket module
- API Gateway upload routes module
- EventBridge rules module
- Environment-specific variables

---

### 10. Acceptance Testing (Task 15)

**Status**: 0% Complete

**What's needed:**

- All 19 acceptance test scenarios
- Test scripts and fixtures

---

### 11. Documentation Updates (Task 16)

**Status**: 100% Complete (already done in docs/)

**What exists:**

- ✅ API documentation (OpenAPI spec)
- ✅ Configuration reference
- ✅ Error contract documentation
- ✅ Presign policy examples
- ✅ Acceptance test scenarios

---

## Priority Implementation Order

Based on what's already implemented, here's the recommended order:

### Phase 1: Core Upload Flow (High Priority)

1. **Refactor presign handler** (Task 2.4, 2.5) - Switch to presigned POST
2. **Create S3 bucket** (Task 3) - Infrastructure for uploads
3. **Implement ingestion handler** (Task 4) - Validation and processing
4. **Configure EventBridge** (Task 9) - Connect S3 to ingestion

### Phase 2: API & Configuration (Medium Priority)

5. **Create config endpoint** (Task 6) - Expose constraints to frontend
6. **Configure API Gateway routes** (Task 8) - Wire up endpoints
7. **Add upload-specific metrics** (Task 2.2, 2.3) - Observability

### Phase 3: HEIC Support (Medium Priority)

8. **Implement HEIC transcode** (Task 5) - iOS support
9. **Configure HEIC EventBridge rule** (Task 9.3) - Trigger transcoding

### Phase 4: Monitoring & Testing (Low Priority)

10. **Set up CloudWatch dashboard** (Task 12) - Monitoring
11. **Write integration tests** (Task 13) - Quality assurance
12. **Run acceptance tests** (Task 15) - Validation

---

## Quick Wins

These can be done quickly to improve the existing presign handler:

1. ✅ Add `ALLOWED_MIME_TYPES` constant
2. ✅ Add `MAX_UPLOAD_MB` constant
3. ✅ Emit metrics on validation failures
4. ✅ Add extension members to error responses
5. ✅ Use `PRESIGN_TTL_SECONDS` env var instead of hardcoded 60

---

## Breaking Changes

The presign handler refactoring will be a **breaking change** for the frontend:

**Current response:**

```json
{
  "uploadUrl": "https://...",
  "key": "uploads/user-123/...",
  "expiresIn": 60
}
```

**New response (presigned POST):**

```json
{
  "url": "https://collectiq-uploads.s3.amazonaws.com",
  "fields": {
    "key": "uploads/user-123/...",
    "Content-Type": "image/jpeg",
    "Policy": "...",
    "X-Amz-Signature": "...",
    ...
  },
  "key": "uploads/user-123/...",
  "maxSizeBytes": 12582912,
  "acceptedTypes": ["image/jpeg", "image/png", "image/heic"],
  "expiresIn": 300
}
```

**Frontend impact:**

- Upload method changes from PUT to POST (multipart/form-data)
- Need to include all `fields` in the POST request
- Need to append file last

---

## Summary

**Overall Progress**: ~30% Complete

- ✅ **Fully Complete**: Project structure, utilities, authentication, documentation
- ⚠️ **Partially Complete**: Presign handler (needs refactoring), DynamoDB setup
- ❌ **Not Started**: S3 bucket, ingestion handler, HEIC transcode, config endpoint, EventBridge, integration tests

**Estimated Effort**:

- Presign refactoring: 2-4 hours
- S3 bucket + policies: 2-3 hours
- Ingestion handler: 6-8 hours
- HEIC transcode: 3-4 hours
- Config endpoint: 1-2 hours
- EventBridge setup: 1-2 hours
- Integration tests: 4-6 hours
- **Total**: 19-29 hours

**Recommendation**: Start with Phase 1 (Core Upload Flow) to get the basic functionality working, then add HEIC support and monitoring.
