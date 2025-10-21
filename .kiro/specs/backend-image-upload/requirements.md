# Requirements Document

## Introduction

The Backend Image Upload system implements a defense-in-depth validation strategy for CollectIQ card image uploads. The system enforces strict constraints across three validation layers: presigned URL generation, S3 bucket policy enforcement, and post-upload ingestion verification. This approach prevents oversized or unsupported files from consuming resources while providing clear, actionable error messages to users.

The system handles JPEG, PNG, and HEIC image formats up to 12 MB, with configurable limits and comprehensive observability through CloudWatch metrics and structured logging.

## Glossary

- **Presigned URL**: A time-limited S3 URL that grants temporary upload permissions without exposing AWS credentials
- **Magic Number**: The first few bytes of a file that identify its true format, regardless of file extension or Content-Type header
- **Defense-in-Depth**: A security strategy employing multiple layers of validation to prevent malicious or non-compliant uploads
- **RFC 7807**: A standard format for HTTP API error responses (Problem Details)
- **HEIC**: High Efficiency Image Container format, native to iOS devices
- **Ingestion Lambda**: AWS Lambda function that validates and processes uploaded files
- **Step Functions**: AWS service for orchestrating multi-step workflows

## Requirements

### Requirement 1: Presigned URL Generation with Validation

**User Story:** As a collector, I want to receive a secure upload URL only when my file meets size and type requirements, so that I get immediate feedback before attempting an upload.

#### Acceptance Criteria

1. WHEN a user requests a presigned URL with a valid Content-Type (image/jpeg, image/png, or image/heic) THEN the system SHALL generate an S3 presigned POST URL with appropriate policy conditions
2. WHEN a user requests a presigned URL with an unsupported Content-Type THEN the system SHALL return HTTP 400 with RFC 7807 problem details including the allowedTypes array
3. WHEN a user requests a presigned URL for a file exceeding MAX_UPLOAD_MB THEN the system SHALL return HTTP 400 with RFC 7807 problem details including maxMB and receivedBytes
4. WHEN generating a presigned URL THEN the system SHALL include policy conditions for content-length-range [1, MAX_UPLOAD_BYTES] and eq Content-Type
5. WHEN generating a presigned URL THEN the system SHALL set expiration to PRESIGN_TTL_SECONDS (default 300 seconds)
6. WHEN generating a presigned URL THEN the system SHALL scope the S3 key to uploads/{userId}/{uuid} to enforce user isolation
7. WHEN a presign request is rejected THEN the system SHALL emit a CloudWatch metric (presign_denied_too_large or presign_denied_bad_type)

### Requirement 2: S3 Bucket Policy Enforcement

**User Story:** As a platform operator, I want S3 to reject non-compliant uploads even if clients bypass API validation, so that the system remains secure against malicious actors.

#### Acceptance Criteria

1. WHEN a client attempts to upload a file exceeding the content-length-range specified in the presigned policy THEN S3 SHALL return HTTP 403 with EntityTooLarge error
2. WHEN a client attempts to upload a file with Content-Type not matching the presigned policy THEN S3 SHALL return HTTP 403 with AccessDenied error
3. WHEN a client attempts to upload to a key prefix not matching the presigned policy THEN S3 SHALL return HTTP 403 with AccessDenied error
4. WHEN any object is uploaded to the bucket THEN S3 SHALL enforce server-side encryption (SSE-S3 or SSE-KMS)
5. WHEN an upload is attempted without required x-amz-meta-user-id metadata THEN the bucket policy SHALL deny the request

### Requirement 3: Post-Upload Magic Number Validation

**User Story:** As a platform operator, I want to verify uploaded files using magic number detection, so that mislabeled or corrupted files are rejected regardless of their declared Content-Type.

#### Acceptance Criteria

1. WHEN an S3 upload completes THEN the system SHALL trigger an ingestion Lambda via EventBridge within 5 seconds
2. WHEN the ingestion Lambda processes a file THEN the system SHALL read the file's magic number bytes and determine the true MIME type
3. WHEN the detected MIME type does not match the declared Content-Type THEN the system SHALL delete the S3 object and emit an ingestion_rejected_mime_mismatch metric
4. WHEN the detected MIME type is not in the allowlist (image/jpeg, image/png, image/heic) THEN the system SHALL delete the S3 object and return HTTP 415 with RFC 7807 problem details
5. WHEN a file is rejected due to MIME mismatch THEN the system SHALL store a rejection record in DynamoDB with reason, timestamp, and original metadata for audit purposes
6. WHEN a file passes magic number validation THEN the system SHALL proceed to metadata extraction

### Requirement 4: File Size Verification

**User Story:** As a platform operator, I want to verify file sizes post-upload to catch any files that bypassed presign validation, so that storage costs remain predictable.

#### Acceptance Criteria

1. WHEN the ingestion Lambda processes a file THEN the system SHALL verify the S3 object size against MAX_UPLOAD_BYTES
2. WHEN the file size exceeds MAX_UPLOAD_BYTES THEN the system SHALL delete the S3 object and emit an ingestion_rejected_too_large metric
3. WHEN an oversized file is rejected THEN the system SHALL return HTTP 413 with RFC 7807 problem details including maxMB and receivedBytes
4. WHEN a file is rejected for size THEN the system SHALL store a rejection record in DynamoDB for audit purposes

### Requirement 5: Metadata Extraction and Storage

**User Story:** As a developer, I want to extract and store image metadata (dimensions, orientation, format) so that downstream services can process images correctly without re-reading files.

#### Acceptance Criteria

1. WHEN a file passes validation THEN the system SHALL extract metadata including width, height, format, exifOrientation, hasAlpha, and density
2. WHEN metadata extraction completes THEN the system SHALL store a DynamoDB record with PK=USER#{userId}, SK=UPLOAD#{s3Key}
3. WHEN storing the upload record THEN the system SHALL include originalBytes, originalMime, width, height, exifOrientation, uploadedAt, and status=pending_processing
4. WHEN metadata extraction fails THEN the system SHALL log the error but not delete the file, allowing manual review
5. WHEN an upload record is created THEN the system SHALL emit an upload_success metric

### Requirement 6: HEIC Format Handling

**User Story:** As an iOS user, I want to upload HEIC images from my camera roll, so that I can use native photos without manual conversion.

#### Acceptance Criteria

1. WHEN a user uploads a HEIC file THEN the system SHALL accept it and store the original in S3
2. WHEN a HEIC file is ingested THEN the system SHALL queue a background transcode job to convert HEIC to JPEG at 90% quality
3. WHEN the transcode completes THEN the system SHALL store the JPEG derivative with key pattern {original-key}.jpg
4. WHEN storing the JPEG derivative THEN the system SHALL add S3 metadata linking it to the original (original-key, original-mime, original-bytes)
5. WHEN the transcode completes THEN the system SHALL update the DynamoDB upload record with derivativeKey, derivativeMime, and derivativeBytes
6. WHEN a HEIC transcode succeeds THEN the system SHALL emit a heic_transcode_success metric
7. WHEN a HEIC transcode fails THEN the system SHALL log the error and emit a heic_transcode_error metric but retain the original HEIC file

### Requirement 7: RFC 7807 Error Responses

**User Story:** As a frontend developer, I want consistent, machine-readable error responses, so that I can provide helpful feedback to users.

#### Acceptance Criteria

1. WHEN any validation error occurs THEN the system SHALL return a response with Content-Type: application/problem+json
2. WHEN returning an error THEN the system SHALL include type (URI), title, status (HTTP code), detail (human-readable), and requestId
3. WHEN a file is too large THEN the error SHALL include maxMB and receivedBytes extension members
4. WHEN a file type is unsupported THEN the error SHALL include allowedTypes array and requestedType or detectedType
5. WHEN an error response is generated THEN the type URI SHALL follow the pattern https://collectiq.com/errors/{error-slug}

### Requirement 8: Configuration Management

**User Story:** As a DevOps engineer, I want to configure upload constraints via environment variables, so that I can adjust limits without code changes.

#### Acceptance Criteria

1. WHEN the presign handler starts THEN the system SHALL read MAX_UPLOAD_MB from environment variables with default value 12
2. WHEN the presign handler starts THEN the system SHALL read ALLOWED_UPLOAD_MIME from environment variables with default value "image/jpeg,image/png,image/heic"
3. WHEN the presign handler starts THEN the system SHALL read PRESIGN_TTL_SECONDS from environment variables with default value 300
4. WHEN MAX_UPLOAD_MB changes THEN new presigned URLs SHALL reflect the updated limit without requiring code deployment
5. WHEN the /config endpoint is called THEN the system SHALL return current upload constraints including maxSizeBytes, maxSizeMB, allowedMimeTypes, and presignTTL

### Requirement 9: Observability and Monitoring

**User Story:** As a platform operator, I want comprehensive metrics and logs for upload operations, so that I can monitor system health and debug issues quickly.

#### Acceptance Criteria

1. WHEN a presign request is denied for size THEN the system SHALL emit a CloudWatch metric presign_denied_too_large with dimension Endpoint=/api/v1/upload/presign
2. WHEN a presign request is denied for type THEN the system SHALL emit a CloudWatch metric presign_denied_bad_type
3. WHEN an upload is rejected for MIME mismatch THEN the system SHALL emit a CloudWatch metric ingestion_rejected_mime_mismatch
4. WHEN an upload is rejected for size THEN the system SHALL emit a CloudWatch metric ingestion_rejected_too_large
5. WHEN an upload succeeds THEN the system SHALL emit a CloudWatch metric upload_success
6. WHEN any error occurs THEN the system SHALL log structured JSON including requestId, userId, errorType, and relevant context
7. WHEN X-Ray tracing is enabled THEN the system SHALL create trace segments for presign generation, S3 upload, and ingestion processing

### Requirement 10: Step Functions Integration

**User Story:** As a backend developer, I want validated uploads to trigger the card processing workflow, so that users receive valuation and authenticity results automatically.

#### Acceptance Criteria

1. WHEN an upload passes all validation THEN the system SHALL start a Step Functions execution with input containing s3Key and s3Bucket
2. WHEN starting the Step Functions execution THEN the system SHALL use the state machine ARN from INGESTION_STATE_MACHINE_ARN environment variable
3. WHEN the Step Functions execution starts THEN the system SHALL update the DynamoDB upload record status to "processing"
4. WHEN the Step Functions execution fails to start THEN the system SHALL log the error and emit an ingestion_error metric
5. WHEN the Step Functions execution completes THEN downstream handlers SHALL update the upload record status to "completed" or "failed"

### Requirement 11: Security and Compliance

**User Story:** As a security engineer, I want upload operations to follow AWS security best practices, so that user data remains protected and compliant.

#### Acceptance Criteria

1. WHEN any object is uploaded THEN the system SHALL enforce server-side encryption at rest (SSE-S3 or SSE-KMS)
2. WHEN generating presigned URLs THEN the system SHALL scope keys to uploads/{userId}/ to prevent cross-user access
3. WHEN a bucket policy is evaluated THEN the system SHALL deny uploads missing x-amz-meta-user-id metadata
4. WHEN a bucket policy is evaluated THEN the system SHALL deny unencrypted uploads (missing x-amz-server-side-encryption header)
5. WHEN an S3 lifecycle rule is evaluated THEN the system SHALL delete unprocessed uploads older than 24 hours to minimize storage costs

### Requirement 12: Rate Limiting

**User Story:** As a platform operator, I want to limit upload requests per user, so that the system remains available during traffic spikes or abuse attempts.

#### Acceptance Criteria

1. WHEN a user makes more than 10 presign requests within 60 seconds THEN the system SHALL return HTTP 429 with RFC 7807 problem details
2. WHEN returning a 429 response THEN the system SHALL include Retry-After header with seconds to wait
3. WHEN returning a 429 response THEN the error SHALL include limit, window, and retryAfter extension members
4. WHEN a rate limit is exceeded THEN the system SHALL emit a CloudWatch metric rate_limit_exceeded with dimension UserId

### Requirement 13: Authentication and Authorization

**User Story:** As a collector, I want upload operations to require authentication, so that only authorized users can upload images to my account.

#### Acceptance Criteria

1. WHEN a presign request is made without a JWT token THEN the system SHALL return HTTP 401 with RFC 7807 problem details
2. WHEN a presign request is made with an expired JWT token THEN the system SHALL return HTTP 401 with type https://collectiq.com/errors/token-expired
3. WHEN a presign request is made with a valid JWT THEN the system SHALL extract the sub claim and use it for S3 key scoping
4. WHEN the /config endpoint is called THEN the system SHALL require a valid JWT token
5. WHEN a JWT validation fails THEN the system SHALL log the failure with requestId and userId (if available)
