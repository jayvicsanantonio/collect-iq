# API Error Contract (RFC 7807)

## Overview

CollectIQ APIs return errors using the [RFC 7807 Problem Details](https://tools.ietf.org/html/rfc7807) standard. All error responses use `application/problem+json` content type and include actionable information for clients to handle failures gracefully.

---

## Error Response Structure

### Standard Fields

```typescript
interface ProblemDetails {
  type: string; // URI reference identifying the problem type
  title: string; // Short, human-readable summary
  status: number; // HTTP status code
  detail: string; // Human-readable explanation specific to this occurrence
  instance?: string; // URI reference identifying the specific occurrence
  [key: string]: any; // Extension members (e.g., maxMB, allowedTypes)
}
```

### Content-Type

All error responses include:

```http
Content-Type: application/problem+json; charset=utf-8
```

---

## Upload Errors

### 400 - Bad Request (Presign Validation)

#### Unsupported Media Type (Presign)

```http
POST /api/v1/upload/presign
Content-Type: application/json

{
  "contentType": "image/gif",
  "fileName": "card.gif",
  "fileSizeBytes": 1048576
}
```

Response:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://collectiq.com/errors/unsupported-media-type",
  "title": "Unsupported Media Type",
  "status": 400,
  "detail": "Content-Type 'image/gif' is not allowed. Supported types: image/jpeg, image/png, image/heic",
  "instance": "/api/v1/upload/presign",
  "requestId": "abc-123-def-456",
  "requestedType": "image/gif",
  "allowedTypes": ["image/jpeg", "image/png", "image/heic"]
}
```

#### File Too Large (Presign)

```http
POST /api/v1/upload/presign
Content-Type: application/json

{
  "contentType": "image/jpeg",
  "fileName": "high-res-card.jpg",
  "fileSizeBytes": 15728640
}
```

Response:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://collectiq.com/errors/file-too-large",
  "title": "File Too Large",
  "status": 400,
  "detail": "File size 15728640 bytes exceeds maximum 12582912 bytes (12 MB)",
  "instance": "/api/v1/upload/presign",
  "requestId": "xyz-789-ghi-012",
  "receivedBytes": 15728640,
  "maxBytes": 12582912,
  "maxMB": 12
}
```

#### Missing Required Fields

```http
POST /api/v1/upload/presign
Content-Type: application/json

{
  "fileName": "card.jpg"
}
```

Response:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://collectiq.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Request body is missing required fields",
  "instance": "/api/v1/upload/presign",
  "requestId": "mno-345-pqr-678",
  "errors": [
    {
      "field": "contentType",
      "message": "Required field is missing"
    },
    {
      "field": "fileSizeBytes",
      "message": "Required field is missing"
    }
  ]
}
```

---

### 401 - Unauthorized

#### Missing JWT Token

```http
POST /api/v1/upload/presign
Content-Type: application/json

{
  "contentType": "image/jpeg",
  "fileName": "card.jpg",
  "fileSizeBytes": 1048576
}
```

Response:

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/problem+json
WWW-Authenticate: Bearer realm="CollectIQ API"

{
  "type": "https://collectiq.com/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Missing or invalid authentication token. Please sign in and try again.",
  "instance": "/api/v1/upload/presign",
  "requestId": "stu-901-vwx-234"
}
```

#### Expired JWT Token

```http
POST /api/v1/upload/presign
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "contentType": "image/jpeg",
  "fileName": "card.jpg",
  "fileSizeBytes": 1048576
}
```

Response:

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/problem+json
WWW-Authenticate: Bearer realm="CollectIQ API", error="invalid_token", error_description="Token has expired"

{
  "type": "https://collectiq.com/errors/token-expired",
  "title": "Token Expired",
  "status": 401,
  "detail": "Your authentication token has expired. Please sign in again.",
  "instance": "/api/v1/upload/presign",
  "requestId": "yza-567-bcd-890",
  "expiredAt": "2025-10-17T14:30:00Z"
}
```

---

### 403 - Forbidden

#### S3 Policy Violation

When a client attempts to bypass presign validation:

```http
PUT https://collectiq-uploads.s3.amazonaws.com/uploads/user-123/abc-def-456
Content-Type: image/gif
Content-Length: 15728640

[binary data]
```

Response (from S3):

```http
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json

{
  "type": "https://collectiq.com/errors/policy-violation",
  "title": "Policy Violation",
  "status": 403,
  "detail": "Upload does not satisfy bucket policy conditions. Content-Type or size constraints violated.",
  "instance": "/uploads/user-123/abc-def-456",
  "requestId": "S3-REQUEST-ID-123",
  "s3Error": "AccessDenied"
}
```

---

### 413 - Payload Too Large

#### Post-Upload Size Validation

When an oversized file slips through presign (edge case):

```http
POST /api/v1/upload/ingest
Content-Type: application/json

{
  "s3Key": "uploads/user-123/abc-def-456",
  "s3Bucket": "collectiq-uploads-hackathon"
}
```

Response:

```http
HTTP/1.1 413 Payload Too Large
Content-Type: application/problem+json

{
  "type": "https://collectiq.com/errors/payload-too-large",
  "title": "Payload Too Large",
  "status": 413,
  "detail": "Uploaded file size 15728640 bytes exceeds maximum 12582912 bytes (12 MB). The file has been deleted.",
  "instance": "/api/v1/upload/ingest",
  "requestId": "efg-123-hij-456",
  "receivedBytes": 15728640,
  "maxBytes": 12582912,
  "maxMB": 12,
  "s3Key": "uploads/user-123/abc-def-456",
  "action": "deleted"
}
```

---

### 415 - Unsupported Media Type

#### MIME Type Mismatch (Magic Number Check)

When a file's magic number doesn't match its declared Content-Type:

```http
POST /api/v1/upload/ingest
Content-Type: application/json

{
  "s3Key": "uploads/user-123/fake-jpeg.jpg",
  "s3Bucket": "collectiq-uploads-hackathon"
}
```

Response:

```http
HTTP/1.1 415 Unsupported Media Type
Content-Type: application/problem+json

{
  "type": "https://collectiq.com/errors/unsupported-media-type",
  "title": "Unsupported Media Type",
  "status": 415,
  "detail": "File magic number indicates type 'image/png', but Content-Type header was 'image/jpeg'. Supported types: image/jpeg, image/png, image/heic. The file has been deleted.",
  "instance": "/api/v1/upload/ingest",
  "requestId": "klm-789-nop-012",
  "declaredType": "image/jpeg",
  "detectedType": "image/png",
  "allowedTypes": ["image/jpeg", "image/png", "image/heic"],
  "s3Key": "uploads/user-123/fake-jpeg.jpg",
  "action": "deleted"
}
```

#### Truly Unsupported Format

```http
POST /api/v1/upload/ingest
Content-Type: application/json

{
  "s3Key": "uploads/user-123/card.webp",
  "s3Bucket": "collectiq-uploads-hackathon"
}
```

Response:

```http
HTTP/1.1 415 Unsupported Media Type
Content-Type: application/problem+json

{
  "type": "https://collectiq.com/errors/unsupported-media-type",
  "title": "Unsupported Media Type",
  "status": 415,
  "detail": "File type 'image/webp' is not supported. Supported types: image/jpeg, image/png, image/heic. The file has been deleted.",
  "instance": "/api/v1/upload/ingest",
  "requestId": "qrs-345-tuv-678",
  "detectedType": "image/webp",
  "allowedTypes": ["image/jpeg", "image/png", "image/heic"],
  "s3Key": "uploads/user-123/card.webp",
  "action": "deleted"
}
```

---

### 429 - Too Many Requests

#### Rate Limit Exceeded

```http
POST /api/v1/upload/presign
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "contentType": "image/jpeg",
  "fileName": "card.jpg",
  "fileSizeBytes": 1048576
}
```

Response:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json
Retry-After: 60

{
  "type": "https://collectiq.com/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded the rate limit of 10 uploads per minute. Please wait 60 seconds and try again.",
  "instance": "/api/v1/upload/presign",
  "requestId": "wxy-901-zab-234",
  "limit": 10,
  "window": "1 minute",
  "retryAfter": 60
}
```

---

### 500 - Internal Server Error

#### Unexpected Error

```http
POST /api/v1/upload/presign
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "contentType": "image/jpeg",
  "fileName": "card.jpg",
  "fileSizeBytes": 1048576
}
```

Response:

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json

{
  "type": "https://collectiq.com/errors/internal-error",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred while processing your request. Our team has been notified.",
  "instance": "/api/v1/upload/presign",
  "requestId": "cde-567-fgh-890"
}
```

---

## Valuation Errors

### 404 - Card Not Found

```http
GET /api/v1/cards/abc-123-def-456
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json

{
  "type": "https://collectiq.com/errors/card-not-found",
  "title": "Card Not Found",
  "status": 404,
  "detail": "Card with ID 'abc-123-def-456' does not exist or you do not have permission to access it.",
  "instance": "/api/v1/cards/abc-123-def-456",
  "requestId": "ijk-123-lmn-456",
  "cardId": "abc-123-def-456"
}
```

### 422 - Unprocessable Entity

#### Low Confidence Score

```http
POST /api/v1/cards/abc-123-def-456/valuation
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response:

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://collectiq.com/errors/low-confidence",
  "title": "Low Confidence Score",
  "status": 422,
  "detail": "Unable to provide reliable valuation. Image quality is too low or card features are not clearly visible. Please upload a higher quality image.",
  "instance": "/api/v1/cards/abc-123-def-456/valuation",
  "requestId": "opq-789-rst-012",
  "cardId": "abc-123-def-456",
  "confidenceScore": 0.42,
  "minimumConfidence": 0.70,
  "suggestions": [
    "Ensure the card is well-lit",
    "Avoid glare on holographic surfaces",
    "Capture the entire card in frame",
    "Use a higher resolution camera"
  ]
}
```

---

## Authentication Errors

### 400 - Invalid OAuth Callback

```http
GET /auth/callback?error=access_denied&error_description=User+cancelled+login
```

Response:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://collectiq.com/errors/oauth-error",
  "title": "OAuth Error",
  "status": 400,
  "detail": "Authentication failed: User cancelled login",
  "instance": "/auth/callback",
  "requestId": "uvw-345-xyz-678",
  "oauthError": "access_denied",
  "oauthDescription": "User cancelled login"
}
```

---

## Vault Errors

### 403 - Forbidden (Cross-User Access)

```http
GET /api/v1/vault/user-456/cards
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

Response (when JWT sub is `user-123`):

```http
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json

{
  "type": "https://collectiq.com/errors/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "You do not have permission to access this user's vault.",
  "instance": "/api/v1/vault/user-456/cards",
  "requestId": "abc-901-def-234",
  "requestedUserId": "user-456",
  "authenticatedUserId": "user-123"
}
```

---

## Error Type URIs

All `type` fields use the following pattern:

```
https://collectiq.com/errors/{error-slug}
```

### Catalog

| Type URI                                              | HTTP Status | Description                           |
| ----------------------------------------------------- | ----------- | ------------------------------------- |
| `https://collectiq.com/errors/unsupported-media-type` | 400, 415    | File type not in allowlist            |
| `https://collectiq.com/errors/file-too-large`         | 400         | File exceeds size limit (presign)     |
| `https://collectiq.com/errors/payload-too-large`      | 413         | File exceeds size limit (post-upload) |
| `https://collectiq.com/errors/validation-error`       | 400         | Request body validation failed        |
| `https://collectiq.com/errors/policy-violation`       | 403         | S3 bucket policy violation            |
| `https://collectiq.com/errors/unauthorized`           | 401         | Missing or invalid JWT                |
| `https://collectiq.com/errors/token-expired`          | 401         | JWT expired                           |
| `https://collectiq.com/errors/forbidden`              | 403         | Insufficient permissions              |
| `https://collectiq.com/errors/rate-limit-exceeded`    | 429         | Too many requests                     |
| `https://collectiq.com/errors/card-not-found`         | 404         | Card does not exist                   |
| `https://collectiq.com/errors/low-confidence`         | 422         | AI confidence below threshold         |
| `https://collectiq.com/errors/oauth-error`            | 400         | OAuth flow error                      |
| `https://collectiq.com/errors/internal-error`         | 500         | Unexpected server error               |

---

## Client Handling

### TypeScript Interface

```typescript
// packages/shared/src/problem-details.ts
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  requestId?: string;
  [key: string]: any;
}

export class ApiError extends Error {
  constructor(public problem: ProblemDetails) {
    super(problem.detail);
    this.name = 'ApiError';
  }

  get status() {
    return this.problem.status;
  }

  get type() {
    return this.problem.type;
  }
}
```

### Fetch Wrapper

```typescript
// apps/web/lib/api-client.ts
export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const contentType = response.headers.get('Content-Type');

    if (contentType?.includes('application/problem+json')) {
      const problem: ProblemDetails = await response.json();
      throw new ApiError(problem);
    }

    // Fallback for non-RFC 7807 errors
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
```

### React Error Boundary

```typescript
// apps/web/components/error-boundary.tsx
import { ApiError } from '@/lib/api-client';

export function ErrorBoundary({ error }: { error: Error }) {
  if (error instanceof ApiError) {
    const { problem } = error;

    return (
      <div className="error-container">
        <h2>{problem.title}</h2>
        <p>{problem.detail}</p>

        {problem.allowedTypes && (
          <div>
            <strong>Allowed types:</strong>
            <ul>
              {problem.allowedTypes.map((type: string) => (
                <li key={type}>{type}</li>
              ))}
            </ul>
          </div>
        )}

        {problem.requestId && (
          <p className="text-sm text-gray-500">
            Request ID: {problem.requestId}
          </p>
        )}
      </div>
    );
  }

  return <div>An unexpected error occurred</div>;
}
```

---

## Logging & Monitoring

### Structured Error Logs

```typescript
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'upload-service' });

logger.error('Upload validation failed', {
  requestId: event.requestContext.requestId,
  userId: event.requestContext.authorizer.jwt.claims.sub,
  errorType: 'unsupported-media-type',
  requestedType: body.contentType,
  allowedTypes: ALLOWED_MIME_TYPES,
  statusCode: 400,
});
```

### CloudWatch Metrics

```typescript
await cloudwatchClient.putMetricData({
  Namespace: 'CollectIQ/Errors',
  MetricData: [
    {
      MetricName: 'ApiError',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'ErrorType', Value: 'unsupported-media-type' },
        { Name: 'StatusCode', Value: '400' },
        { Name: 'Endpoint', Value: '/api/v1/upload/presign' },
      ],
    },
  ],
});
```

---

## Testing

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { handler } from './presign';

describe('Presign Handler Errors', () => {
  it('returns 400 for unsupported media type', async () => {
    const event = {
      body: JSON.stringify({
        contentType: 'image/gif',
        fileName: 'card.gif',
        fileSizeBytes: 1024,
      }),
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(response.headers['Content-Type']).toBe('application/problem+json');
    expect(body.type).toBe('https://collectiq.com/errors/unsupported-media-type');
    expect(body.allowedTypes).toEqual(['image/jpeg', 'image/png', 'image/heic']);
  });

  it('returns 400 for oversized file', async () => {
    const event = {
      body: JSON.stringify({
        contentType: 'image/jpeg',
        fileName: 'huge.jpg',
        fileSizeBytes: 15 * 1024 * 1024,
      }),
    };

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.type).toBe('https://collectiq.com/errors/file-too-large');
    expect(body.maxMB).toBe(12);
  });
});
```

---

## References

- [RFC 7807: Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
- [MDN: HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [AWS API Gateway Error Responses](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-gatewayResponse-definition.html)
