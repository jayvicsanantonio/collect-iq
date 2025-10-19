import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler } from '../handlers/upload_presign.js';
import type { APIGatewayProxyEventV2WithJWT } from '../auth/jwt-claims.js';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({})),
  PutObjectCommand: vi.fn((params) => params),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://test-bucket.s3.amazonaws.com/presigned-url'),
}));

describe('Upload Presign Handler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      BUCKET_UPLOADS: 'test-bucket',
      ALLOWED_UPLOAD_MIME: 'image/jpeg,image/png,image/heic',
      MAX_UPLOAD_MB: '12',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  const createMockEvent = (body: unknown): APIGatewayProxyEventV2WithJWT => ({
    version: '2.0',
    routeKey: 'POST /upload/presign',
    rawPath: '/upload/presign',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'POST',
        path: '/upload/presign',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'test-request-id',
      routeKey: 'POST /upload/presign',
      stage: 'dev',
      time: '01/Jan/2025:00:00:00 +0000',
      timeEpoch: 1704067200000,
      authorizer: {
        jwt: {
          claims: {
            sub: 'test-user-123',
            email: 'test@example.com',
            iat: 1704067200,
            exp: 1704070800,
          },
        },
      },
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  });

  it('should generate presigned URL for valid request', async () => {
    const event = createMockEvent({
      filename: 'pikachu.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024 * 1024, // 1MB
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.headers?.['Content-Type']).toBe('application/json');

    const body = JSON.parse(response.body as string);
    expect(body.uploadUrl).toBeDefined();
    expect(body.key).toMatch(/^uploads\/test-user-123\/[a-f0-9-]+_pikachu\.jpg$/);
    expect(body.expiresIn).toBe(60);
  });

  it('should reject invalid MIME type', async () => {
    const event = createMockEvent({
      filename: 'document.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024 * 1024,
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body as string);
    // Zod schema validation catches this first
    expect(body.detail).toContain('Validation failed');
  });

  it('should reject oversized file', async () => {
    const event = createMockEvent({
      filename: 'large-image.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 15 * 1024 * 1024, // 15MB > 12MB limit
    });

    const response = await handler(event);

    // Zod schema validation catches this first with 400
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body as string);
    expect(body.detail).toContain('Validation failed');
  });

  it('should reject invalid request body', async () => {
    const event = createMockEvent({
      filename: '',
      contentType: 'image/jpeg',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body as string);
    expect(body.detail).toContain('Validation failed');
  });

  it('should sanitize filename in S3 key', async () => {
    const event = createMockEvent({
      filename: 'my card photo!@#$.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024 * 1024,
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body as string);
    expect(body.key).toMatch(/my_card_photo_\.jpg$/);
  });

  it('should handle missing JWT claims', async () => {
    const event = createMockEvent({
      filename: 'test.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024 * 1024,
    });

    // Remove JWT claims
    delete event.requestContext.authorizer;

    const response = await handler(event);

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body as string);
    expect(body.detail).toContain('JWT claims');
  });
});
