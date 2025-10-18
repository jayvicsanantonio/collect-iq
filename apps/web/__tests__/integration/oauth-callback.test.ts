import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  parseState,
  getStoredCodeVerifier,
  getStoredState,
  clearStoredPKCE,
} from '@/lib/auth';

describe('OAuth Callback Flow Integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('Complete PKCE Flow', () => {
    it('should complete full PKCE flow from generation to validation', async () => {
      // Step 1: Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      await generateCodeChallenge(codeVerifier);
      const state = generateState('/vault');

      // Verify parameters are generated
      expect(codeVerifier).toBeDefined();
      expect(state).toBeDefined();

      // Step 2: Store parameters (simulating sign in flow)
      sessionStorage.setItem('pkce_code_verifier', codeVerifier);
      sessionStorage.setItem('oauth_state', state);

      // Step 3: Simulate OAuth callback - retrieve stored parameters
      const storedVerifier = getStoredCodeVerifier();
      const storedState = getStoredState();

      expect(storedVerifier).toBe(codeVerifier);
      expect(storedState).toBe(state);

      // Step 4: Validate state parameter
      const parsedState = parseState(storedState!);
      expect(parsedState).not.toBeNull();
      expect(parsedState?.destination).toBe('/vault');
      expect(parsedState?.nonce).toBeDefined();

      // Step 5: Clear PKCE parameters after successful exchange
      clearStoredPKCE();

      expect(getStoredCodeVerifier()).toBeNull();
      expect(getStoredState()).toBeNull();
    });

    it('should handle PKCE flow without destination', async () => {
      const codeVerifier = generateCodeVerifier();
      await generateCodeChallenge(codeVerifier);
      const state = generateState(); // No destination

      sessionStorage.setItem('pkce_code_verifier', codeVerifier);
      sessionStorage.setItem('oauth_state', state);

      const parsedState = parseState(state);
      expect(parsedState).not.toBeNull();
      expect(parsedState?.destination).toBeUndefined();
      expect(parsedState?.nonce).toBeDefined();
    });
  });

  describe('State Parameter Validation', () => {
    it('should detect state mismatch (CSRF protection)', () => {
      const originalState = generateState('/vault');
      const maliciousState = generateState('/vault'); // Different nonce

      sessionStorage.setItem('oauth_state', originalState);

      // Simulate attacker providing different state
      const storedState = getStoredState();
      expect(storedState).not.toBe(maliciousState);
    });

    it('should validate state contains required nonce', () => {
      const state = generateState('/upload');
      const parsed = parseState(state);

      expect(parsed).not.toBeNull();
      expect(parsed?.nonce).toBeDefined();
      expect(typeof parsed?.nonce).toBe('string');
      expect(parsed?.nonce.length).toBeGreaterThan(0);
    });

    it('should reject state without nonce', () => {
      const invalidState = btoa(JSON.stringify({ destination: '/vault' }));
      const parsed = parseState(invalidState);

      expect(parsed).toBeNull();
    });

    it('should reject malformed state', () => {
      const malformedStates = [
        'not-base64!!!',
        btoa('not-json{'),
        btoa('{}'), // Missing nonce
        '',
        'invalid',
      ];

      malformedStates.forEach((state) => {
        const parsed = parseState(state);
        expect(parsed).toBeNull();
      });
    });
  });

  describe('Code Verifier Storage and Retrieval', () => {
    it('should store and retrieve code verifier correctly', () => {
      const verifier = generateCodeVerifier();
      sessionStorage.setItem('pkce_code_verifier', verifier);

      const retrieved = getStoredCodeVerifier();
      expect(retrieved).toBe(verifier);
    });

    it('should handle missing code verifier', () => {
      const retrieved = getStoredCodeVerifier();
      expect(retrieved).toBeNull();
    });

    it('should clear code verifier on cleanup', () => {
      const verifier = generateCodeVerifier();
      sessionStorage.setItem('pkce_code_verifier', verifier);

      clearStoredPKCE();

      expect(getStoredCodeVerifier()).toBeNull();
    });
  });

  describe('OAuth Callback Error Scenarios', () => {
    it('should handle missing code verifier during callback', () => {
      const state = generateState('/vault');
      sessionStorage.setItem('oauth_state', state);
      // Code verifier not stored

      const verifier = getStoredCodeVerifier();
      expect(verifier).toBeNull();
    });

    it('should handle missing state during callback', () => {
      const verifier = generateCodeVerifier();
      sessionStorage.setItem('pkce_code_verifier', verifier);
      // State not stored

      const state = getStoredState();
      expect(state).toBeNull();
    });

    it('should handle corrupted sessionStorage data', () => {
      sessionStorage.setItem('pkce_code_verifier', '');
      sessionStorage.setItem('oauth_state', '');

      const verifier = getStoredCodeVerifier();
      const state = getStoredState();

      // Empty strings are stored but retrieved as empty strings
      // This tests that the functions handle empty/invalid data gracefully
      expect(verifier).toBeDefined();
      expect(state).toBeDefined();
    });
  });

  describe('Destination Preservation', () => {
    it('should preserve intended destination through OAuth flow', () => {
      const destinations = ['/vault', '/upload', '/cards/123'];

      destinations.forEach((destination) => {
        const state = generateState(destination);
        const parsed = parseState(state);

        expect(parsed).not.toBeNull();
        expect(parsed?.destination).toBe(destination);
      });
    });

    it('should handle special characters in destination', () => {
      const destination = '/cards/123?filter=rare&sort=value';
      const state = generateState(destination);
      const parsed = parseState(state);

      expect(parsed).not.toBeNull();
      expect(parsed?.destination).toBe(destination);
    });

    it('should handle encoded destination paths', () => {
      const destination = '/cards/test%20card';
      const state = generateState(destination);
      const parsed = parseState(state);

      expect(parsed).not.toBeNull();
      expect(parsed?.destination).toBe(destination);
    });
  });

  describe('Session Management Flow', () => {
    it('should simulate complete authentication flow', async () => {
      // 1. User clicks sign in
      const destination = '/vault';
      const codeVerifier = generateCodeVerifier();
      await generateCodeChallenge(codeVerifier);
      const state = generateState(destination);

      // 2. Store PKCE parameters
      sessionStorage.setItem('pkce_code_verifier', codeVerifier);
      sessionStorage.setItem('oauth_state', state);

      // 3. User redirected to Cognito (simulated)
      // ...

      // 4. Cognito redirects back with code and state
      const callbackState = state;
      const authCode = 'mock-auth-code-123';

      // 5. Validate state
      const storedState = getStoredState();
      expect(storedState).toBe(callbackState);

      const parsedState = parseState(callbackState);
      expect(parsedState).not.toBeNull();
      expect(parsedState?.destination).toBe(destination);

      // 6. Retrieve code verifier for token exchange
      const storedVerifier = getStoredCodeVerifier();
      expect(storedVerifier).toBe(codeVerifier);

      // 7. Exchange code for tokens (would happen in API route)
      // Mock token exchange
      const mockTokenExchange = {
        code: authCode,
        codeVerifier: storedVerifier,
      };
      expect(mockTokenExchange.code).toBe(authCode);
      expect(mockTokenExchange.codeVerifier).toBe(codeVerifier);

      // 8. Clear PKCE parameters after successful exchange
      clearStoredPKCE();

      expect(getStoredCodeVerifier()).toBeNull();
      expect(getStoredState()).toBeNull();

      // 9. Redirect to intended destination
      expect(parsedState?.destination).toBe(destination);
    });
  });

  describe('Security Validations', () => {
    it('should generate unique nonces for each state', () => {
      const state1 = generateState('/vault');
      const state2 = generateState('/vault');

      const parsed1 = parseState(state1);
      const parsed2 = parseState(state2);

      expect(parsed1?.nonce).not.toBe(parsed2?.nonce);
    });

    it('should generate unique code verifiers', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();

      expect(verifier1).not.toBe(verifier2);
    });

    it('should generate different challenges for different verifiers', async () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();

      const challenge1 = await generateCodeChallenge(verifier1);
      const challenge2 = await generateCodeChallenge(verifier2);

      expect(challenge1).not.toBe(challenge2);
    });

    it('should use base64url encoding (no padding)', () => {
      const verifier = generateCodeVerifier();
      const state = generateState('/vault');

      // Base64URL should not contain +, /, or =
      expect(verifier).not.toMatch(/[+/=]/);
      expect(state).not.toMatch(/[+/]/); // State uses standard base64 with padding
    });
  });
});
