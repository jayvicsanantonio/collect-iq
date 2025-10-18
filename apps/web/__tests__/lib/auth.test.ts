import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildHostedUIUrl,
  buildLogoutUrl,
  generateState,
  parseState,
  parseJWT,
  isTokenExpired,
  getStoredCodeVerifier,
  getStoredState,
  clearStoredPKCE,
} from '@/lib/auth';

describe('Auth Helper Functions', () => {
  describe('generateCodeVerifier', () => {
    it('should generate a code verifier', () => {
      const verifier = generateCodeVerifier();
      expect(verifier).toBeDefined();
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBeGreaterThan(0);
    });

    it('should generate unique verifiers', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      expect(verifier1).not.toBe(verifier2);
    });

    it('should generate base64url encoded string', () => {
      const verifier = generateCodeVerifier();
      // Base64URL should not contain +, /, or =
      expect(verifier).not.toMatch(/[+/=]/);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate a code challenge from verifier', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      
      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBeGreaterThan(0);
    });

    it('should generate consistent challenge for same verifier', async () => {
      const verifier = 'test-verifier-123';
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);
      
      expect(challenge1).toBe(challenge2);
    });

    it('should generate different challenges for different verifiers', async () => {
      const verifier1 = 'test-verifier-1';
      const verifier2 = 'test-verifier-2';
      const challenge1 = await generateCodeChallenge(verifier1);
      const challenge2 = await generateCodeChallenge(verifier2);
      
      expect(challenge1).not.toBe(challenge2);
    });

    it('should generate base64url encoded string', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      // Base64URL should not contain +, /, or =
      expect(challenge).not.toMatch(/[+/=]/);
    });
  });

  describe('buildHostedUIUrl', () => {
    it('should build correct authorization URL', async () => {
      const codeChallenge = 'test-challenge';
      const state = 'test-state';
      
      const url = await buildHostedUIUrl({
        codeChallenge,
        state,
      });

      expect(url).toContain('https://test.auth.us-east-1.amazoncognito.com/oauth2/authorize');
      expect(url).toContain('response_type=code');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback');
      expect(url).toContain('state=test-state');
      expect(url).toContain('code_challenge=test-challenge');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('scope=openid+email+profile');
    });

    it('should URL encode parameters correctly', async () => {
      const codeChallenge = 'test-challenge-with-special-chars';
      const state = 'test-state-123';
      
      const url = await buildHostedUIUrl({
        codeChallenge,
        state,
      });

      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('code_challenge')).toBe(codeChallenge);
      expect(urlObj.searchParams.get('state')).toBe(state);
    });
  });

  describe('buildLogoutUrl', () => {
    it('should build correct logout URL', () => {
      const url = buildLogoutUrl();

      expect(url).toContain('https://test.auth.us-east-1.amazoncognito.com/logout');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('logout_uri=http%3A%2F%2Flocalhost%3A3000');
    });

    it('should include correct parameters', () => {
      const url = buildLogoutUrl();
      const urlObj = new URL(url);
      
      expect(urlObj.searchParams.get('client_id')).toBe('test-client-id');
      expect(urlObj.searchParams.get('logout_uri')).toBe('http://localhost:3000');
    });
  });

  describe('generateState', () => {
    it('should generate state without destination', () => {
      const state = generateState();
      
      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
    });

    it('should generate state with destination', () => {
      const state = generateState('/vault');
      
      expect(state).toBeDefined();
      const parsed = parseState(state);
      expect(parsed).not.toBeNull();
      expect(parsed?.destination).toBe('/vault');
    });

    it('should include nonce in state', () => {
      const state = generateState();
      const parsed = parseState(state);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.nonce).toBeDefined();
      expect(typeof parsed?.nonce).toBe('string');
    });

    it('should generate unique states', () => {
      const state1 = generateState('/vault');
      const state2 = generateState('/vault');
      
      expect(state1).not.toBe(state2);
    });
  });

  describe('parseState', () => {
    it('should parse valid state', () => {
      const state = generateState('/upload');
      const parsed = parseState(state);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.destination).toBe('/upload');
      expect(parsed?.nonce).toBeDefined();
    });

    it('should return null for invalid base64', () => {
      const parsed = parseState('invalid-base64!!!');
      expect(parsed).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const invalidState = btoa('not-valid-json{');
      const parsed = parseState(invalidState);
      expect(parsed).toBeNull();
    });

    it('should return null for state without nonce', () => {
      const invalidState = btoa(JSON.stringify({ destination: '/vault' }));
      const parsed = parseState(invalidState);
      expect(parsed).toBeNull();
    });

    it('should handle state without destination', () => {
      const state = generateState();
      const parsed = parseState(state);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.destination).toBeUndefined();
      expect(parsed?.nonce).toBeDefined();
    });
  });

  describe('parseJWT', () => {
    it('should parse valid JWT token', () => {
      // Create a simple JWT (header.payload.signature)
      const payload = { sub: 'user-123', email: 'test@example.com', exp: 1234567890 };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;
      
      const parsed = parseJWT(token);
      
      expect(parsed.sub).toBe('user-123');
      expect(parsed.email).toBe('test@example.com');
      expect(parsed.exp).toBe(1234567890);
    });

    it('should throw for invalid JWT format', () => {
      expect(() => parseJWT('invalid-token')).toThrow('Failed to parse JWT token');
    });

    it('should throw for token with wrong number of parts', () => {
      expect(() => parseJWT('header.payload')).toThrow('Failed to parse JWT token');
    });

    it('should throw for token with invalid base64', () => {
      expect(() => parseJWT('header.invalid!!!.signature')).toThrow('Failed to parse JWT token');
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const payload = { sub: 'user-123', exp: futureExp };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;
      
      expect(isTokenExpired(token)).toBe(false);
    });

    it('should return true for expired token', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const payload = { sub: 'user-123', exp: pastExp };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;
      
      expect(isTokenExpired(token)).toBe(true);
    });

    it('should return true for token without exp claim', () => {
      const payload = { sub: 'user-123' };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;
      
      expect(isTokenExpired(token)).toBe(true);
    });

    it('should return true for invalid token', () => {
      expect(isTokenExpired('invalid-token')).toBe(true);
    });

    it('should account for 60 second clock skew buffer', () => {
      // Token expires in 30 seconds (within buffer)
      const nearExp = Math.floor(Date.now() / 1000) + 30;
      const payload = { sub: 'user-123', exp: nearExp };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;
      
      expect(isTokenExpired(token)).toBe(true);
    });
  });

  describe('sessionStorage helpers', () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    describe('getStoredCodeVerifier', () => {
      it('should return stored code verifier', () => {
        sessionStorage.setItem('pkce_code_verifier', 'test-verifier');
        expect(getStoredCodeVerifier()).toBe('test-verifier');
      });

      it('should return null if not stored', () => {
        expect(getStoredCodeVerifier()).toBeNull();
      });
    });

    describe('getStoredState', () => {
      it('should return stored state', () => {
        sessionStorage.setItem('oauth_state', 'test-state');
        expect(getStoredState()).toBe('test-state');
      });

      it('should return null if not stored', () => {
        expect(getStoredState()).toBeNull();
      });
    });

    describe('clearStoredPKCE', () => {
      it('should clear stored PKCE parameters', () => {
        sessionStorage.setItem('pkce_code_verifier', 'test-verifier');
        sessionStorage.setItem('oauth_state', 'test-state');
        
        clearStoredPKCE();
        
        expect(getStoredCodeVerifier()).toBeNull();
        expect(getStoredState()).toBeNull();
      });

      it('should not throw if nothing stored', () => {
        expect(() => clearStoredPKCE()).not.toThrow();
      });
    });
  });
});
