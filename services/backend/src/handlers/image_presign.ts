/**
 * Image Presign Handler
 * GET /images/presign?key={s3Key}
 * Generates secure, time-limited S3 presigned URLs for viewing card images
 */

import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getUserId, type APIGatewayProxyEventV2WithJWT } from '../auth/jwt-claims.js';
import { formatErrorResponse, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';
import { tracing } from '../utils/tracing.js';
import { getJsonHeaders } from '../utils/response-headers.js';
import { getEnvVar } from '../utils/validation.js';

// Constants
const PRESIGN_EXPIRATION_SECONDS = 3600; // 1 hour for viewing

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.REGION || process.env.AWS_REGION || 'us-east-1',
});

/**
 * Lambda handler for generating presigned GET URLs for images
 */
export async function handler(
  event: APIGatewayProxyEventV2WithJWT
): Promise<APIGatewayProxyResultV2> {
  const requestId = event.requestContext.requestId;
  const startTime = Date.now();

  tracing.startSubsegment('image_presign_handler', { requestId });

  try {
    const userId = getUserId(event);
    const bucketName = getEnvVar('BUCKET_UPLOADS');

    tracing.addAnnotation('userId', userId);
    tracing.addAnnotation('operation', 'image_presign');

    logger.info('Processing image presign request', {
      requestId,
      userId,
      operation: 'image_presign',
    });

    // Get S3 key from query parameters
    const s3Key = event.queryStringParameters?.key;

    if (!s3Key) {
      throw new BadRequestError('Missing required query parameter: key', requestId);
    }

    // Verify the S3 key belongs to the requesting user
    // Expected format: uploads/{userId}/{uuid}-{filename}
    if (!s3Key.startsWith(`uploads/${userId}/`)) {
      throw new ForbiddenError('Access denied: You can only access your own images', requestId, {
        s3Key,
        userId,
      });
    }

    logger.debug('Generating presigned GET URL', {
      requestId,
      userId,
      s3Key,
    });

    // Create GetObject command
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    // Generate presigned URL
    const viewUrl = await tracing.trace(
      's3_presign_get_object',
      () =>
        getSignedUrl(s3Client, command, {
          expiresIn: PRESIGN_EXPIRATION_SECONDS,
        }),
      { requestId, userId }
    );

    const response = {
      viewUrl,
      expiresIn: PRESIGN_EXPIRATION_SECONDS,
    };

    logger.info('Presigned GET URL generated successfully', {
      requestId,
      userId,
      s3Key,
      expiresIn: PRESIGN_EXPIRATION_SECONDS,
    });

    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/images/presign', 'GET', latency);

    tracing.endSubsegment('image_presign_handler', {
      success: true,
      s3Key,
    });

    return {
      statusCode: 200,
      headers: getJsonHeaders({}, event.headers?.origin),
      body: JSON.stringify(response),
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/images/presign', 'GET', latency);

    tracing.endSubsegment('image_presign_handler', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    logger.error('Failed to generate presigned GET URL', error as Error, {
      requestId,
      operation: 'image_presign',
    });

    return formatErrorResponse(error, requestId, event.headers?.origin);
  }
}
