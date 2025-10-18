/**
 * RFC 7807 Problem Details for HTTP APIs
 * Provides standardized error responses
 */

import { getProblemJsonHeaders } from './response-headers.js';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  [key: string]: unknown;
}

export class HttpError extends Error {
  public readonly status: number;
  public readonly type: string;
  public readonly title: string;
  public readonly detail: string;
  public readonly instance: string;
  public readonly extensions: Record<string, unknown>;

  constructor(
    status: number,
    title: string,
    detail: string,
    instance: string = '',
    type?: string,
    extensions?: Record<string, unknown>,
  ) {
    super(detail);
    this.name = 'HttpError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.instance = instance;
    this.type = type || `/errors/${title.toLowerCase().replace(/\s+/g, '-')}`;
    this.extensions = extensions || {};
  }

  toProblemDetails(): ProblemDetails {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
      instance: this.instance,
      ...this.extensions,
    };
  }

  toJSON(): ProblemDetails {
    return this.toProblemDetails();
  }
}

// Common HTTP errors
export class BadRequestError extends HttpError {
  constructor(detail: string, instance: string = '', extensions?: Record<string, unknown>) {
    super(400, 'Bad Request', detail, instance, '/errors/bad-request', extensions);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(detail: string = 'Authentication required', instance: string = '') {
    super(401, 'Unauthorized', detail, instance, '/errors/unauthorized');
  }
}

export class ForbiddenError extends HttpError {
  constructor(
    detail: string = 'Access denied',
    instance: string = '',
    extensions?: Record<string, unknown>,
  ) {
    super(403, 'Forbidden', detail, instance, '/errors/forbidden', extensions);
  }
}

export class NotFoundError extends HttpError {
  constructor(detail: string, instance: string = '') {
    super(404, 'Not Found', detail, instance, '/errors/not-found');
  }
}

export class ConflictError extends HttpError {
  constructor(detail: string, instance: string = '', extensions?: Record<string, unknown>) {
    super(409, 'Conflict', detail, instance, '/errors/conflict', extensions);
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor(detail: string, instance: string = '', extensions?: Record<string, unknown>) {
    super(413, 'Payload Too Large', detail, instance, '/errors/payload-too-large', extensions);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(
    detail: string = 'Rate limit exceeded',
    instance: string = '',
    extensions?: Record<string, unknown>,
  ) {
    super(429, 'Too Many Requests', detail, instance, '/errors/too-many-requests', extensions);
  }
}

export class InternalServerError extends HttpError {
  constructor(
    detail: string = 'An internal error occurred',
    instance: string = '',
    extensions?: Record<string, unknown>,
  ) {
    super(
      500,
      'Internal Server Error',
      detail,
      instance,
      '/errors/internal-server-error',
      extensions,
    );
  }
}

export class BadGatewayError extends HttpError {
  constructor(detail: string, instance: string = '', extensions?: Record<string, unknown>) {
    super(502, 'Bad Gateway', detail, instance, '/errors/bad-gateway', extensions);
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(
    detail: string = 'Service temporarily unavailable',
    instance: string = '',
    extensions?: Record<string, unknown>,
  ) {
    super(503, 'Service Unavailable', detail, instance, '/errors/service-unavailable', extensions);
  }
}

export class GatewayTimeoutError extends HttpError {
  constructor(
    detail: string = 'Request timeout',
    instance: string = '',
    extensions?: Record<string, unknown>,
  ) {
    super(504, 'Gateway Timeout', detail, instance, '/errors/gateway-timeout', extensions);
  }
}

/**
 * Format error for API Gateway response
 */
export function formatErrorResponse(
  error: unknown,
  requestId?: string,
): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  let problemDetails: ProblemDetails;

  if (error instanceof HttpError) {
    problemDetails = error.toProblemDetails();
  } else if (error instanceof Error) {
    problemDetails = {
      type: '/errors/internal-server-error',
      title: 'Internal Server Error',
      status: 500,
      detail: error.message,
      instance: '',
    };
  } else {
    problemDetails = {
      type: '/errors/internal-server-error',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
      instance: '',
    };
  }

  if (requestId) {
    problemDetails.requestId = requestId;
  }

  return {
    statusCode: problemDetails.status,
    headers: getProblemJsonHeaders(),
    body: JSON.stringify(problemDetails),
  };
}
