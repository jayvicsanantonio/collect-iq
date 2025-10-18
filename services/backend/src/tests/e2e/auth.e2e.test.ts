/**
 * Authentication E2E Tests
 *
 * Tests Cognito authentication flow and JWT token validation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getOrCreateTestUser, authenticateTestUser } from './cognito-auth.js';
import { apiRequest } from './test-helpers.js';
import type { CognitoTokens } from './cognito-auth.js';

describe('Authentication E2E', () => {
  let tokens: CognitoTokens;

  beforeAll(async () => {
    const { tokens: testTokens } = await getOrCreateTestUser();
    tokens = testTokens;
  });

  it('should authenticate test user and obtain JWT tokens', async () => {
    const email = process.env.TEST_USER_EMAIL!;
    const password = process.env.TEST_USER_PASSWORD!;

    const result = await authenticateTestUser(email, password);

    expect(result.accessToken).toBeDefined();
    expect(result.idToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it('should access protected endpoint with valid JWT', async () => {
    const response = await apiRequest(
      '/cards',
      {
        method: 'GET',
      },
      tokens,
    );

    // Should return 200 OK (empty list is fine)
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('should reject request without JWT token', async () => {
    const baseUrl = process.env.API_GATEWAY_URL;
    const response = await fetch(`${baseUrl}/cards`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Should return 401 Unauthorized
    expect(response.status).toBe(401);
  });

  it('should reject request with invalid JWT token', async () => {
    const baseUrl = process.env.API_GATEWAY_URL;
    const response = await fetch(`${baseUrl}/cards`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token-12345',
      },
    });

    // Should return 401 Unauthorized
    expect(response.status).toBe(401);
  });

  it('should access healthz endpoint without authentication', async () => {
    const baseUrl = process.env.API_GATEWAY_URL;
    const response = await fetch(`${baseUrl}/healthz`, {
      method: 'GET',
    });

    // Should return 200 OK
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });
});
