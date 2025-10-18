/**
 * API client tests
 * Tests for the typed API client with retry logic, error handling, and schema validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest, ApiError, api } from '../api';
import {
  CardSchema,
  type Card,
  type ListCardsResponse,
  type PresignResponse,
} from '@collectiq/shared';

// Mock the auth module
vi.mock('../auth', () => ({
  getAccessToken: vi.fn(() => Promise.resolve('mock-access-token')),
  signIn: vi.fn(() => Promise.resolve()),
}));

// Mock the env module
vi.mock('../env', () => ({
  env: {
    NEXT_PUBLIC_API_BASE: 'https://api.test.com',
  },
}));

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('apiRequest', () => {
    it('should make a successful GET request', async () => {
      const mockData = { message: 'success' };
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockData),
      });

      const result = await apiRequest('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/test',
        expect.objectContaining({
          credentials: 'include',
        })
      );
      expect(result).toEqual(mockData);
    });

    it('should include Authorization header', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await apiRequest('/test');

      const fetchCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.get('Authorization')).toBe('Bearer mock-access-token');
    });

    it('should include X-Request-ID header', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await apiRequest('/test');

      const fetchCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers.get('X-Request-ID')).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should handle 204 No Content', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
      });

      const result = await apiRequest('/test');

      expect(result).toBeUndefined();
    });

    it('should parse ProblemDetails error', async () => {
      const problemDetails = {
        type: 'https://api.test.com/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'The requested resource was not found',
        requestId: 'req-123',
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve(JSON.stringify(problemDetails)),
      });

      try {
        await apiRequest('/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
        expect((error as ApiError).problem).toEqual(problemDetails);
        expect((error as ApiError).requestId).toBe('req-123');
      }
    });

    it('should retry GET requests with exponential backoff', async () => {
      // First two attempts fail with 500
      (global.fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers(),
          text: () => Promise.resolve('Server error'),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers(),
          text: () => Promise.resolve('Server error'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ success: true }),
        });

      const result = await apiRequest('/test', { method: 'GET' });

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ success: true });
    });

    it('should not retry POST requests by default', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        text: () => Promise.resolve('Server error'),
      });

      await expect(
        apiRequest('/test', { method: 'POST', body: JSON.stringify({}) })
      ).rejects.toThrow(ApiError);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry non-retryable errors', async () => {
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers(),
        text: () => Promise.resolve('Bad request'),
      });

      await expect(apiRequest('/test')).rejects.toThrow(ApiError);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should validate response with Zod schema', async () => {
      const mockCard: Card = {
        cardId: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'user-123',
        name: 'Pikachu',
        set: 'Base Set',
        number: '25',
        rarity: 'Common',
        frontS3Key: 's3://bucket/key',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockCard),
      });

      const result = await apiRequest<Card>('/cards/123', {
        schema: CardSchema,
      });

      expect(result).toEqual(mockCard);
    });
  });

  describe('API Methods', () => {
    describe('getPresignedUrl', () => {
      it('should request presigned URL', async () => {
        const mockResponse: PresignResponse = {
          uploadUrl: 'https://s3.amazonaws.com/bucket/key?signature=xyz',
          key: 'uploads/user-123/card-456.jpg',
          expiresIn: 60,
        };

        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve(mockResponse),
        });

        const result = await api.getPresignedUrl({
          filename: 'card.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1024000,
        });

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.test.com/upload/presign',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      it('should validate request parameters', async () => {
        await expect(
          api.getPresignedUrl({
            filename: '',
            contentType: 'image/jpeg',
            sizeBytes: 1024000,
          })
        ).rejects.toThrow();
      });
    });

    describe('createCard', () => {
      it('should create a card with idempotency key', async () => {
        const mockCard: Card = {
          cardId: '123e4567-e89b-12d3-a456-426614174000',
          userId: 'user-123',
          frontS3Key: 's3://bucket/key',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve(mockCard),
        });

        const result = await api.createCard({
          frontS3Key: 's3://bucket/key',
        });

        expect(result).toEqual(mockCard);

        const fetchCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
        const headers = fetchCall[1].headers;
        expect(headers.get('Idempotency-Key')).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });
    });

    describe('getCards', () => {
      it('should fetch cards list', async () => {
        const mockResponse: ListCardsResponse = {
          items: [],
          nextCursor: 'cursor-123',
        };

        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve(mockResponse),
        });

        const result = await api.getCards();

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.test.com/cards',
          expect.objectContaining({})
        );
      });

      it('should include pagination parameters', async () => {
        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ items: [] }),
        });

        await api.getCards({ cursor: 'abc123', limit: 20 });

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.test.com/cards?cursor=abc123&limit=20',
          expect.objectContaining({})
        );
      });
    });

    describe('getCard', () => {
      it('should fetch a single card', async () => {
        const mockCard: Card = {
          cardId: '123e4567-e89b-12d3-a456-426614174000',
          userId: 'user-123',
          frontS3Key: 's3://bucket/key',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve(mockCard),
        });

        const result = await api.getCard('123e4567-e89b-12d3-a456-426614174000');

        expect(result).toEqual(mockCard);
      });
    });

    describe('deleteCard', () => {
      it('should delete a card', async () => {
        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          status: 204,
          headers: new Headers(),
        });

        await api.deleteCard('123e4567-e89b-12d3-a456-426614174000');

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.test.com/cards/123e4567-e89b-12d3-a456-426614174000',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });
    });

    describe('revalueCard', () => {
      it('should trigger card revaluation', async () => {
        const mockResponse = {
          executionArn: 'arn:aws:states:us-east-1:123456789012:execution:...',
          status: 'RUNNING' as const,
          message: 'Revaluation started',
        };

        (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          status: 202,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve(mockResponse),
        });

        const result = await api.revalueCard(
          '123e4567-e89b-12d3-a456-426614174000',
          { forceRefresh: true }
        );

        expect(result).toEqual(mockResponse);

        const fetchCall = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
        const headers = fetchCall[1].headers;
        expect(headers.get('Idempotency-Key')).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });
    });
  });

  describe('ApiError', () => {
    it('should check status correctly', () => {
      const error = new ApiError(404, 'Not Found', 'Resource not found');
      expect(error.isStatus(404)).toBe(true);
      expect(error.isStatus(500)).toBe(false);
    });

    it('should identify auth errors', () => {
      const error = new ApiError(401, 'Unauthorized', 'Not authenticated');
      expect(error.requiresAuth()).toBe(true);
    });

    it('should identify retryable errors', () => {
      const error500 = new ApiError(500, 'Server Error', 'Internal error');
      const error429 = new ApiError(429, 'Too Many Requests', 'Rate limited');
      const error400 = new ApiError(400, 'Bad Request', 'Invalid input');

      expect(error500.isRetryable()).toBe(true);
      expect(error429.isRetryable()).toBe(true);
      expect(error400.isRetryable()).toBe(false);
    });
  });
});
