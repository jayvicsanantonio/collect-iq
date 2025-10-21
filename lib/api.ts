import { getAccessToken, signIn } from './auth';
import { env } from './env';
import { z } from 'zod';
import {
  PresignRequest,
  PresignResponse,
  PresignRequestSchema,
  PresignResponseSchema,
  CreateCardRequest,
  CreateCardRequestSchema,
  ListCardsResponse,
  ListCardsResponseSchema,
  Card,
  CardSchema,
  ProblemDetails,
  ProblemDetailsSchema,
  RevalueResponse,
  RevalueResponseSchema,
  RevalueRequest,
  RevalueRequestSchema,
} from '@/lib/types';

/**
 * Generate a UUID v4 for idempotency keys
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a unique request ID for traceability
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * API request options
 */
export interface ApiRequestOptions extends RequestInit {
  /** Skip automatic authentication (for public endpoints) */
  skipAuth?: boolean;
  /** Custom headers to merge with defaults */
  headers?: HeadersInit;
  /** Enable retry with exponential backoff (default: true for GET, false for others) */
  retry?: boolean;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Idempotency key for POST operations (auto-generated if not provided) */
  idempotencyKey?: string;
  /** Zod schema for response validation */
  schema?: z.ZodSchema;
}

/**
 * API error class with status code and response details
 */
export class ApiError extends Error {
  public requestId?: string;

  constructor(
    public status: number,
    public statusText: string,
    message: string,
    public response?: unknown,
    public problem?: ProblemDetails
  ) {
    super(message);
    this.name = 'ApiError';
    this.requestId = problem?.requestId;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Check if this is a specific HTTP status code
   */
  isStatus(status: number): boolean {
    return this.status === status;
  }

  /**
   * Check if this error requires authentication
   */
  requiresAuth(): boolean {
    return this.status === 401;
  }

  /**
   * Check if this error is retryable
   */
  isRetryable(): boolean {
    return this.status >= 500 || this.status === 429;
  }
}

/**
 * Make an authenticated API request to the backend with retry logic
 * Automatically adds Authorization header with access token
 * Handles 401 responses by attempting token refresh and retry
 * Implements exponential backoff for GET requests
 *
 * @param endpoint - API endpoint path (e.g., '/cards', '/upload/presign')
 * @param options - Fetch options with optional skipAuth flag
 * @returns Typed response data
 * @throws ApiError on HTTP errors or network failures
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    skipAuth = false,
    headers: customHeaders,
    retry = options.method === 'GET' || !options.method,
    maxRetries = 3,
    idempotencyKey,
    schema,
    ...fetchOptions
  } = options;

  // Build full URL
  const url = `${env.NEXT_PUBLIC_API_BASE}${endpoint}`;

  // Generate request ID for traceability
  const requestId = generateRequestId();

  // Prepare headers
  const headers = new Headers(customHeaders);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Request-ID', requestId);

  // Add Idempotency-Key for POST operations
  if (options.method === 'POST' && idempotencyKey) {
    headers.set('Idempotency-Key', idempotencyKey);
  }

  // Add Authorization header if not skipping auth
  if (!skipAuth) {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      // No token available - redirect to sign in
      await signIn();
      throw new ApiError(401, 'Unauthorized', 'No access token available');
    }
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // Retry logic with exponential backoff
  let lastError: ApiError | null = null;
  const attempts = retry ? maxRetries : 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      // Exponential backoff delay (1s, 2s, 4s)
      if (attempt > 0) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        await sleep(delay);
      }

      // Make the request
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        credentials: 'include', // Include cookies for authentication
      });

      // Handle 401 - token might be expired, Amplify should have refreshed it
      if (response.status === 401 && !skipAuth) {
        // Try one more time with fresh token
        const freshToken = await getAccessToken();
        if (freshToken) {
          headers.set('Authorization', `Bearer ${freshToken}`);
          const retryResponse = await fetch(url, {
            ...fetchOptions,
            headers,
            credentials: 'include',
          });

          if (retryResponse.ok) {
            const data = await parseResponse<T>(retryResponse, schema);
            return data;
          }

          // Still 401 after retry - redirect to sign in
          if (retryResponse.status === 401) {
            await signIn();
          }

          const error = await parseError(retryResponse, requestId);
          throw error;
        }

        // No fresh token - redirect to sign in
        await signIn();
        throw new ApiError(401, 'Unauthorized', 'Session expired');
      }

      // Handle other HTTP errors
      if (!response.ok) {
        const error = await parseError(response, requestId);

        // Don't retry non-retryable errors
        if (!error.isRetryable() || !retry) {
          throw error;
        }

        lastError = error;
        continue; // Retry
      }

      // Parse and return response
      const data = await parseResponse<T>(response, schema);
      return data;
    } catch (error) {
      // Re-throw ApiError as-is if not retryable
      if (error instanceof ApiError) {
        if (!error.isRetryable() || !retry) {
          throw error;
        }
        lastError = error;
        continue; // Retry
      }

      // Network or other errors
      const networkError = new ApiError(
        0,
        'Network Error',
        error instanceof Error ? error.message : 'Unknown error occurred'
      );

      if (!retry) {
        throw networkError;
      }

      lastError = networkError;
    }
  }

  // All retries exhausted
  throw lastError || new ApiError(0, 'Unknown Error', 'Request failed after retries');
}

/**
 * Parse error response and create ApiError
 */
async function parseError(response: Response, requestId: string): Promise<ApiError> {
  const errorText = await response.text();
  let errorMessage = `API request failed: ${response.statusText}`;
  let problem: ProblemDetails | undefined;

  try {
    const parsed = JSON.parse(errorText);
    const result = ProblemDetailsSchema.safeParse(parsed);
    if (result.success) {
      problem = result.data;
      // Add requestId if not present
      if (!problem.requestId) {
        problem.requestId = requestId;
      }
      errorMessage = problem.detail || problem.title || errorMessage;
    } else if (parsed && typeof parsed.message === 'string') {
      errorMessage = parsed.message;
    } else if (typeof parsed === 'string') {
      errorMessage = parsed;
    }
  } catch {
    if (errorText) errorMessage = errorText;
  }

  return new ApiError(response.status, response.statusText, errorMessage, errorText, problem);
}

/**
 * Parse successful response with optional schema validation
 */
async function parseResponse<T>(response: Response, schema?: z.ZodSchema): Promise<T> {
  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await response.json();

    // Validate with Zod schema if provided
    if (schema) {
      const result = schema.safeParse(data);
      if (!result.success) {
        console.error('Schema validation failed:', result.error);
        // Return data anyway but log the error
        return data as T;
      }
      return result.data as T;
    }

    return data as T;
  }

  // Fallback to text for non-JSON responses
  const text = await response.text();
  return text as unknown as T;
}

/**
 * Convenience methods for common HTTP verbs
 */
const baseApi = {
  get: <T = unknown>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      // Auto-generate idempotency key if not provided
      idempotencyKey: options?.idempotencyKey || generateUUID(),
    }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
};

/**
 * High-level API helpers (typed with schema validation)
 */

/**
 * Get presigned URL for S3 upload
 * POST /upload/presign
 */
export async function getPresignedUrl(params: PresignRequest): Promise<PresignResponse> {
  // Validate request
  const validatedParams = PresignRequestSchema.parse(params);

  return baseApi.post<PresignResponse>('/upload/presign', validatedParams, {
    schema: PresignResponseSchema,
  });
}

/**
 * Create a new card record
 * POST /cards
 */
export async function createCard(data: CreateCardRequest, idempotencyKey?: string): Promise<Card> {
  // Validate request
  const validatedData = CreateCardRequestSchema.parse(data);

  return baseApi.post<Card>('/cards', validatedData, {
    schema: CardSchema,
    idempotencyKey: idempotencyKey || generateUUID(),
  });
}

/**
 * Get list of cards with pagination
 * GET /cards
 */
export async function getCards(params?: {
  cursor?: string;
  limit?: number;
}): Promise<ListCardsResponse> {
  const search = new URLSearchParams();
  if (params?.cursor) search.set('cursor', params.cursor);
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();

  return baseApi.get<ListCardsResponse>(`/cards${qs ? `?${qs}` : ''}`, {
    schema: ListCardsResponseSchema,
  });
}

/**
 * Get a single card by ID
 * GET /cards/{id}
 */
export async function getCard(cardId: string): Promise<Card> {
  return baseApi.get<Card>(`/cards/${cardId}`, {
    schema: CardSchema,
  });
}

/**
 * Delete a card
 * DELETE /cards/{id}
 * Returns 204 No Content
 */
export async function deleteCard(cardId: string): Promise<void> {
  await baseApi.delete(`/cards/${cardId}`);
}

/**
 * Revalue a card (trigger new valuation)
 * POST /cards/{id}/revalue
 */
export async function revalueCard(
  cardId: string,
  options?: { forceRefresh?: boolean },
  idempotencyKey?: string
): Promise<RevalueResponse> {
  const request: RevalueRequest = {
    forceRefresh: options?.forceRefresh,
  };

  // Validate request
  const validatedRequest = RevalueRequestSchema.parse(request);

  return baseApi.post<RevalueResponse>(`/cards/${cardId}/revalue`, validatedRequest, {
    schema: RevalueResponseSchema,
    idempotencyKey: idempotencyKey || generateUUID(),
  });
}

/**
 * Get presigned URL for viewing an image from S3
 * GET /images/presign?key={s3Key}
 */
export async function getImagePresignedUrl(
  s3Key: string
): Promise<{ viewUrl: string; expiresIn: number }> {
  const search = new URLSearchParams({ key: s3Key });
  return baseApi.get<{ viewUrl: string; expiresIn: number }>(
    `/images/presign?${search.toString()}`
  );
}

// Public API client type including typed helpers
export interface ApiClient {
  get: <T = unknown>(endpoint: string, options?: ApiRequestOptions) => Promise<T>;
  post: <T = unknown>(endpoint: string, body?: unknown, options?: ApiRequestOptions) => Promise<T>;
  put: <T = unknown>(endpoint: string, body?: unknown, options?: ApiRequestOptions) => Promise<T>;
  delete: <T = unknown>(endpoint: string, options?: ApiRequestOptions) => Promise<T>;
  patch: <T = unknown>(endpoint: string, body?: unknown, options?: ApiRequestOptions) => Promise<T>;

  getPresignedUrl: (params: PresignRequest) => Promise<PresignResponse>;
  createCard: (data: CreateCardRequest, idempotencyKey?: string) => Promise<Card>;
  getCards: (params?: { cursor?: string; limit?: number }) => Promise<ListCardsResponse>;
  getCard: (cardId: string) => Promise<Card>;
  deleteCard: (cardId: string) => Promise<void>;
  revalueCard: (
    cardId: string,
    options?: { forceRefresh?: boolean },
    idempotencyKey?: string
  ) => Promise<RevalueResponse>;
  getImagePresignedUrl: (s3Key: string) => Promise<{ viewUrl: string; expiresIn: number }>;
}

export const api: ApiClient = {
  ...baseApi,
  getPresignedUrl,
  createCard,
  getCards,
  getCard,
  deleteCard,
  revalueCard,
  getImagePresignedUrl,
};
