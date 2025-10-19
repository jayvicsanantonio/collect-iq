/**
 * Upload Presign Handler
 * Generates secure, time-limited S3 presigned URLs for card image uploads
 */

import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { PresignRequestSchema, type PresignResponse } from '@collectiq/shared';
import { getUserId, type APIGatewayProxyEventV2WithJWT } from '../auth/jwt-claims.js';
import {
  formatErrorResponse,
  BadRequestError,
  PayloadTooLargeError,
  UnauthorizedError,
} from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';
import { tracing } from '../utils/tracing.js';
import { getJsonHeaders } from '../utils/response-headers.js';
import {
  validate,
  sanitizeFilename,
  validateMimeType,
  validateFileSize,
  getEnvVar,
  getEnvArray,
  getEnvNumber,
} from '../utils/validation.js';

// Constants
const PRESIGN_EXPIRATION_SECONDS = 60;

// Initialize S3 client without X-Ray instrumentation to avoid context issues
// X-Ray will still trace the Lambda function itself
const s3Client = new S3Client({
  region: process.env.REGION || process.env.AWS_REGION || 'us-east-1',
});

/**
 * Get environment configuration
 * Lazy-loaded to avoid errors during module import in tests
 */
function getConfig() {
  return {
    BUCKET_UPLOADS: getEnvVar('BUCKET_UPLOADS'),
    ALLOWED_UPLOAD_MIME: getEnvArray('ALLOWED_UPLOAD_MIME', [
      'image/jpeg',
      'image/png',
      'image/heic',
    ]),
    MAX_UPLOAD_MB: getEnvNumber('MAX_UPLOAD_MB', 12),
    KMS_KEY_ID: getEnvVar('KMS_KEY_ID', ''), // Optional, defaults to empty string
  };
}

/**
 * Lambda handler for generating presigned upload URLs
 */
export async function handler(
  event: APIGatewayProxyEventV2WithJWT
): Promise<APIGatewayProxyResultV2> {
  const requestId = event.requestContext.requestId;
  const startTime = Date.now();

  tracing.startSubsegment('upload_presign_handler', { requestId });

  try {
    // Get configuration
    const config = getConfig();

    // Extract user ID from JWT claims
    const userId = getUserId(event);

    tracing.addAnnotation('userId', userId);
    tracing.addAnnotation('operation', 'upload_presign');

    logger.info('Processing presign request', {
      requestId,
      userId,
      operation: 'upload_presign',
    });

    // Parse and validate request body
    const body = event.body ? JSON.parse(event.body) : {};
    const request = validate(PresignRequestSchema, body);

    // Validate MIME type
    if (!validateMimeType(request.contentType, config.ALLOWED_UPLOAD_MIME)) {
      throw new BadRequestError(
        `Invalid content type. Allowed types: ${config.ALLOWED_UPLOAD_MIME.join(', ')}`,
        requestId,
        {
          contentType: request.contentType,
          allowedTypes: config.ALLOWED_UPLOAD_MIME,
        }
      );
    }

    // Validate file size
    if (!validateFileSize(request.sizeBytes, config.MAX_UPLOAD_MB)) {
      throw new PayloadTooLargeError(
        `File size exceeds maximum allowed size of ${config.MAX_UPLOAD_MB}MB`,
        requestId,
        {
          sizeBytes: request.sizeBytes,
          maxBytes: config.MAX_UPLOAD_MB * 1024 * 1024,
        }
      );
    }

    // Generate S3 key: uploads/{sub}/{uuid}-{sanitizedFilename}
    const fileUuid = uuidv4();
    const sanitized = sanitizeFilename(request.filename);
    const s3Key = `uploads/${userId}/${fileUuid}-${sanitized}`;

    logger.debug('Generated S3 key', {
      requestId,
      userId,
      s3Key,
      originalFilename: request.filename,
    });

    // Create PutObject command with encryption headers
    const command = new PutObjectCommand({
      Bucket: config.BUCKET_UPLOADS,
      Key: s3Key,
      ContentType: request.contentType,
      ContentLength: request.sizeBytes,
      // Add KMS encryption if key is provided
      ...(config.KMS_KEY_ID && {
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: config.KMS_KEY_ID,
      }),
      // Metadata for tracking
      Metadata: {
        'uploaded-by': userId,
        'original-filename': request.filename,
      },
    });

    // Generate presigned URL
    const hoistableHeaders = new Set(['x-amz-meta-uploaded-by', 'x-amz-meta-original-filename']);

    // Add KMS headers if encryption is enabled
    if (config.KMS_KEY_ID) {
      hoistableHeaders.add('x-amz-server-side-encryption');
      hoistableHeaders.add('x-amz-server-side-encryption-aws-kms-key-id');
    }

    const uploadUrl = await tracing.trace(
      's3_presign_put_object',
      () =>
        getSignedUrl(s3Client, command, {
          expiresIn: PRESIGN_EXPIRATION_SECONDS,
          hoistableHeaders,
        }),
      { requestId, userId }
    );

    const response: PresignResponse = {
      uploadUrl,
      key: s3Key,
      expiresIn: PRESIGN_EXPIRATION_SECONDS,
    };

    logger.info('Presigned URL generated successfully', {
      requestId,
      userId,
      s3Key,
      expiresIn: PRESIGN_EXPIRATION_SECONDS,
    });

    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/upload/presign', 'POST', latency);

    tracing.endSubsegment('upload_presign_handler', {
      success: true,
      s3Key,
    });

    return {
      statusCode: 200,
      headers: getJsonHeaders({}, event.headers?.origin),
      body: JSON.stringify(response),
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      await metrics.recordAuthFailure(error.detail);
    }

    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/upload/presign', 'POST', latency);

    tracing.endSubsegment('upload_presign_handler', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    logger.error('Failed to generate presigned URL', error as Error, {
      requestId,
      operation: 'upload_presign',
    });

    return formatErrorResponse(error, requestId, event.headers?.origin);
  }
}
