import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSession, refreshSession, clearSession } from '@/lib/auth';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Session Management', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getSession', () => {
    it('should return session when authenticated', async () => {
      const mockSession = {
        sub: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        idToken: 'mock-id-token',
        expiresAt: Date.now() + 3600000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSession,
      });

      const session = await getSession();

      expect(session).toEqual(mockSession);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/session', {
        credentials: 'include',
      });
    });

    it('should return null when not authenticated (401)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const session = await getSession();

      expect(session).toBeNull();
    });

    it('should return null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const session = await getSession();

      expect(session).toBeNull();
    });

    it('should return null on server error (500)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const session = await getSession();

      expect(session).toBeNull();
    });

    it('should include credentials in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await getSession();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/session',
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });
  });

  describe('refreshSession', () => {
    it('should return new session on successful refresh', async () => {
      const mockSession = {
        sub: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        idToken: 'new-id-token',
        expiresAt: Date.now() + 3600000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSession,
      });

      const session = await refreshSession();

      expect(session).toEqual(mockSession);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
    });

    it('should return null when refresh fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const session = await refreshSession();

      expect(session).toBeNull();
    });

    it('should return null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const session = await refreshSession();

      expect(session).toBeNull();
    });

    it('should use POST method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await refreshSession();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/refresh',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should include credentials in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await refreshSession();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/refresh',
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });
  });

  describe('clearSession', () => {
    it('should return true on successful sign out', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await clearSession();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
      });
    });

    it('should return false when sign out fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await clearSession();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await clearSession();

      expect(result).toBe(false);
    });

    it('should use POST method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await clearSession();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/signout',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should include credentials in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await clearSession();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/signout',
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });
  });

  describe('Session Expiry and Refresh Logic', () => {
    it('should handle expired session scenario', async () => {
      // First call returns null (expired)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const session = await getSession();
      expect(session).toBeNull();

      // Attempt refresh
      const mockRefreshedSession = {
        sub: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        idToken: 'new-id-token',
        expiresAt: Date.now() + 3600000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefreshedSession,
      });

      const refreshedSession = await refreshSession();
      expect(refreshedSession).toEqual(mockRefreshedSession);
    });

    it('should handle refresh token expiry', async () => {
      // Refresh fails (refresh token expired)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const session = await refreshSession();
      expect(session).toBeNull();
    });

    it('should handle complete session flow', async () => {
      // 1. Get valid session
      const mockSession = {
        sub: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        idToken: 'id-token',
        expiresAt: Date.now() + 3600000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSession,
      });

      let session = await getSession();
      expect(session).toEqual(mockSession);

      // 2. Session expires
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      session = await getSession();
      expect(session).toBeNull();

      // 3. Refresh session
      const mockRefreshedSession = {
        ...mockSession,
        accessToken: 'new-access-token',
        expiresAt: Date.now() + 3600000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefreshedSession,
      });

      session = await refreshSession();
      expect(session).toEqual(mockRefreshedSession);

      // 4. Sign out
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const signOutResult = await clearSession();
      expect(signOutResult).toBe(true);
    });
  });
});
