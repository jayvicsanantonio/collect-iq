/**
 * Health Check Handler
 *
 * Provides a simple health check endpoint for monitoring and load balancers.
 * This endpoint does not require authentication.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getNoCacheHeaders } from '../utils/response-headers.js';

interface HealthCheckResponse {
  status: 'healthy';
  timestamp: string;
  service: string;
  version: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const response: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'collectiq-backend',
    version: process.env.SERVICE_VERSION || '1.0.0',
  };

  return {
    statusCode: 200,
    headers: getNoCacheHeaders(),
    body: JSON.stringify(response),
  };
};
