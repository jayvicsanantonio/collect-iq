import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  api,
  ApiError,
  getPresignedUrl,
  createCard,
  getCards,
  getCard,
  deleteCard,
  refreshValuation,
} from '@/lib/api';
import {
  ProblemDetailsSchema,
  PresignResponseSchema,
  CardSchema,
  ListCardsResponseSchema,
  RevalueResponseSchema,
} from '@collectiq/shared';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('ApiError', () => {
    it('should create ApiError with ProblemDetails', () => {
      const problem = {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Invalid input',
        requestId: 'req_123',
      };

      const error = new ApiError(problem);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ApiError');
      expect(error.message).toBe('Invalid input');
      expect(error.problem).toEqual(problem);
    });

    it('should use title as message when detail is missing', () => {
      const problem = {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: '',
      };

      const error = new ApiError(problem);
      expect(error.message).toBe('Not Found');
    });
  });

  describe('ProblemDetails Parsing', () => {
    it('should parse valid ProblemDetails response', async () => {
      const problem = {
        type: 'https://api.collectiq.com/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'File size exceeds limit',
        requestId: 'req_123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => problem,
      });

      try {
        await getPresignedUrl({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1024,
        });
        expect.fail('Should have thrown ApiError');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.problem).toMatchObject(problem);
        expect(ProblemDetailsSchema.safeParse(apiError.problem).success).toBe(true);
      }
    });

    it('should convert generic error to ProblemDetails', async () => {
      // Mock all retry attempts to fail with same error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Something went wrong' }),
      });

      try {
        const promise = getCards();
        await vi.advanceTimersByTimeAsync(10000); // Fast-forward through all retries
        await promise;
        expect.fail('Should have thrown ApiError');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.problem.title).toBe('Something went wrong');
        expect(apiError.problem.status).toBe(500);
      }
    });

    it('should handle non-JSON error responses', async () => {
      // Mock all retry attempts to fail with same error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'content-type': 'text/plain' }),
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      try {
        const promise = getCards();
        await vi.advanceTimersByTimeAsync(10000); // Fast-forward through all retries
        await promise;
        expect.fail('Should have thrown ApiError');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.problem.title).toBe('Service Unavailable');
        expect(apiError.problem.status).toBe(503);
      }
    });

    it('should map status codes to default error titles', async () => {
      const statusTests = [
        { status: 401, title: 'Unauthorized' },
        { status: 403, title: 'Forbidden' },
        { status: 404, title: 'Not Found' },
        { status: 413, title: 'Payload Too Large' },
      ];

      for (const { status, title } of statusTests) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status,
          statusText: title,
          headers: new Headers(),
        });

        try {
          await getCards();
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          const apiError = error as ApiError;
          expect(apiError.problem.title).toBe(title);
        }
      }

      // Test 429 separately since it triggers retry
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers(),
      });

      try {
        const promise = getCards();
        await vi.advanceTimersByTimeAsync(10000); // Fast-forward through all retries
        await promise;
        expect.fail('Should have thrown ApiError');
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.problem.title).toBe('Too Many Requests');
      }
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    it('should retry on 5xx errors with exponential backoff', async () => {
      // First two attempts fail with 503
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ items: [], nextCursor: undefined }),
        });

      const promise = getCards();
      
      // Fast-forward through retries
      await vi.advanceTimersByTimeAsync(1000); // First retry after 1s
      await vi.advanceTimersByTimeAsync(2000); // Second retry after 2s
      
      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should retry on 429 rate limit errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ items: [] }),
        });

      const promise = getCards();
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx client errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers(),
      });

      try {
        await getCards();
        expect.fail('Should have thrown ApiError');
      } catch {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      }
    });

    it('should not retry POST requests by default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers(),
      });

      try {
        await createCard({ frontS3Key: 'test-key' });
        expect.fail('Should have thrown ApiError');
      } catch {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      }
    });

    it('should stop retrying after max attempts', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers(),
      });

      const promise = getCards();
      
      // Fast-forward through all retries
      await vi.advanceTimersByTimeAsync(1000); // 1st retry
      await vi.advanceTimersByTimeAsync(2000); // 2nd retry
      await vi.advanceTimersByTimeAsync(4000); // Would be 3rd but max is 3 total

      try {
        await promise;
        expect.fail('Should have thrown ApiError');
      } catch {
        expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
      }
    });

    it('should retry on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ items: [] }),
        });

      const promise = getCards();
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Zod Schema Validation', () => {
    it('should validate PresignResponse with schema', async () => {
      const validResponse = {
        uploadUrl: 'https://s3.amazonaws.com/bucket/key?signature=xyz',
        key: 'uploads/user-123/uuid-456',
        expiresIn: 60,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => validResponse,
      });

      const result = await getPresignedUrl({
        filename: 'test.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
      });

      expect(PresignResponseSchema.safeParse(result).success).toBe(true);
      expect(result).toEqual(validResponse);
    });

    it('should throw on invalid PresignResponse schema', async () => {
      const invalidResponse = {
        uploadUrl: 'not-a-valid-url',
        key: 'test-key',
        // missing expiresIn
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => invalidResponse,
      });

      try {
        await getPresignedUrl({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1024,
        });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
      }
    });

    it('should validate Card schema', async () => {
      const validCard = {
        cardId: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'user-123',
        name: 'Charizard',
        set: 'Base Set',
        number: '4',
        rarity: 'Holo Rare',
        frontS3Key: 'uploads/user-123/front.jpg',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => validCard,
      });

      const result = await getCard('123e4567-e89b-12d3-a456-426614174000');

      expect(CardSchema.safeParse(result).success).toBe(true);
      expect(result).toEqual(validCard);
    });

    it('should validate ListCardsResponse schema', async () => {
      const validResponse = {
        items: [
          {
            cardId: '123e4567-e89b-12d3-a456-426614174000',
            userId: 'user-123',
            frontS3Key: 'uploads/user-123/front.jpg',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
        nextCursor: 'cursor-abc',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => validResponse,
      });

      const result = await getCards();

      expect(ListCardsResponseSchema.safeParse(result).success).toBe(true);
      expect(result).toEqual(validResponse);
    });

    it('should validate RevalueResponse schema', async () => {
      const validResponse = {
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:StateMachine:exec-id',
        status: 'RUNNING' as const,
        message: 'Revaluation started',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => validResponse,
      });

      const result = await refreshValuation('123e4567-e89b-12d3-a456-426614174000');

      expect(RevalueResponseSchema.safeParse(result).success).toBe(true);
      expect(result).toEqual(validResponse);
    });
  });

  describe('API Client Methods', () => {
    describe('getPresignedUrl', () => {
      it('should request presigned URL with correct parameters', async () => {
        const request = {
          filename: 'charizard.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 2048000,
        };

        const response = {
          uploadUrl: 'https://s3.amazonaws.com/bucket/key?signature=xyz',
          key: 'uploads/user-123/uuid-456',
          expiresIn: 60,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => response,
        });

        const result = await getPresignedUrl(request);

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/upload/presign',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(request),
            credentials: 'include',
          })
        );
        expect(result).toEqual(response);
      });

      it('should include request ID header', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            uploadUrl: 'https://s3.amazonaws.com/test',
            key: 'test-key',
            expiresIn: 60,
          }),
        });

        await getPresignedUrl({
          filename: 'test.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1024,
        });

        const callHeaders = mockFetch.mock.calls[0][1].headers;
        expect(callHeaders.get('X-Request-ID')).toMatch(/^req_\d+_[a-z0-9]+$/);
      });
    });

    describe('createCard', () => {
      it('should create card with required fields', async () => {
        const request = {
          frontS3Key: 'uploads/user-123/front.jpg',
        };

        const response = {
          cardId: '123e4567-e89b-12d3-a456-426614174000',
          userId: 'user-123',
          frontS3Key: 'uploads/user-123/front.jpg',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => response,
        });

        const result = await createCard(request);

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/cards',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(request),
          })
        );
        expect(result).toEqual(response);
      });

      it('should create card with optional fields', async () => {
        const request = {
          frontS3Key: 'uploads/user-123/front.jpg',
          backS3Key: 'uploads/user-123/back.jpg',
          name: 'Charizard',
          set: 'Base Set',
          number: '4',
          rarity: 'Holo Rare',
          conditionEstimate: 'Near Mint',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            cardId: '123e4567-e89b-12d3-a456-426614174000',
            userId: 'user-123',
            ...request,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          }),
        });

        const result = await createCard(request);
        expect(result.name).toBe('Charizard');
        expect(result.backS3Key).toBe('uploads/user-123/back.jpg');
      });
    });

    describe('getCards', () => {
      it('should get cards without pagination params', async () => {
        const response = {
          items: [],
          nextCursor: undefined,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => response,
        });

        const result = await getCards();

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/cards',
          expect.objectContaining({
            method: 'GET',
          })
        );
        expect(result).toEqual(response);
      });

      it('should get cards with cursor pagination', async () => {
        const response = {
          items: [],
          nextCursor: 'next-cursor',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => response,
        });

        await getCards({ cursor: 'prev-cursor', limit: 20 });

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/cards?cursor=prev-cursor&limit=20',
          expect.anything()
        );
      });

      it('should enable retry for GET requests', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers(),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ items: [] }),
          });

        const promise = getCards();
        await vi.advanceTimersByTimeAsync(1000);
        await promise;

        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    describe('getCard', () => {
      it('should get single card by ID', async () => {
        const cardId = '123e4567-e89b-12d3-a456-426614174000';
        const response = {
          cardId,
          userId: 'user-123',
          name: 'Pikachu',
          frontS3Key: 'uploads/user-123/front.jpg',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => response,
        });

        const result = await getCard(cardId);

        expect(mockFetch).toHaveBeenCalledWith(
          `http://localhost:3000/api/cards/${cardId}`,
          expect.objectContaining({
            method: 'GET',
          })
        );
        expect(result).toEqual(response);
      });

      it('should throw ApiError for non-existent card', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: 'Card not found',
          }),
        });

        try {
          await getCard('non-existent-id');
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          const apiError = error as ApiError;
          expect(apiError.problem.status).toBe(404);
        }
      });
    });

    describe('deleteCard', () => {
      it('should delete card by ID', async () => {
        const cardId = '123e4567-e89b-12d3-a456-426614174000';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
          headers: new Headers({ 'content-length': '0' }),
        });

        const result = await deleteCard(cardId);

        expect(mockFetch).toHaveBeenCalledWith(
          `http://localhost:3000/api/cards/${cardId}`,
          expect.objectContaining({
            method: 'DELETE',
          })
        );
        expect(result).toEqual({ ok: true });
      });

      it('should handle 204 No Content response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 204,
          headers: new Headers(),
        });

        const result = await deleteCard('test-id');
        expect(result).toEqual({ ok: true });
      });

      it('should not retry DELETE requests', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers(),
        });

        try {
          await deleteCard('test-id');
          expect.fail('Should have thrown ApiError');
        } catch {
          expect(mockFetch).toHaveBeenCalledTimes(1);
        }
      });
    });

    describe('refreshValuation', () => {
      it('should refresh valuation without force', async () => {
        const cardId = '123e4567-e89b-12d3-a456-426614174000';
        const response = {
          executionArn: 'arn:aws:states:us-east-1:123456789012:execution:StateMachine:exec-id',
          status: 'RUNNING' as const,
          message: 'Revaluation started',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => response,
        });

        const result = await refreshValuation(cardId);

        expect(mockFetch).toHaveBeenCalledWith(
          `http://localhost:3000/api/cards/${cardId}/revalue`,
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ cardId, forceRefresh: false }),
          })
        );
        expect(result).toEqual(response);
      });

      it('should refresh valuation with force flag', async () => {
        const cardId = '123e4567-e89b-12d3-a456-426614174000';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            executionArn: 'arn:aws:states:test',
            status: 'RUNNING' as const,
            message: 'Forced revaluation started',
          }),
        });

        await refreshValuation(cardId, true);

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.forceRefresh).toBe(true);
      });
    });
  });

  describe('Request Headers and Credentials', () => {
    it('should include Content-Type header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ items: [] }),
      });

      await getCards();

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders.get('Content-Type')).toBe('application/json');
    });

    it('should include credentials for cookie-based auth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ items: [] }),
      });

      await getCards();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('should generate unique request IDs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ items: [] }),
      });

      await getCards();
      await getCards();

      const requestId1 = mockFetch.mock.calls[0][1].headers.get('X-Request-ID');
      const requestId2 = mockFetch.mock.calls[1][1].headers.get('X-Request-ID');

      expect(requestId1).not.toBe(requestId2);
    });
  });

  describe('API Object Export', () => {
    it('should export api object with all methods', () => {
      expect(api).toBeDefined();
      expect(api.getPresignedUrl).toBe(getPresignedUrl);
      expect(api.createCard).toBe(createCard);
      expect(api.getCards).toBe(getCards);
      expect(api.getCard).toBe(getCard);
      expect(api.deleteCard).toBe(deleteCard);
      expect(api.refreshValuation).toBe(refreshValuation);
    });
  });
});
