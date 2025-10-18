import { afterEach, vi } from 'vitest';

// Set environment variables BEFORE any imports
process.env.NEXT_PUBLIC_REGION = 'us-east-1';
process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = 'us-east-1_TEST123';
process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID = 'test-client-id';
process.env.NEXT_PUBLIC_COGNITO_DOMAIN =
  'test.auth.us-east-1.amazoncognito.com';
process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI =
  'http://localhost:3000/auth/callback';
process.env.NEXT_PUBLIC_OAUTH_LOGOUT_URI = 'http://localhost:3000';
process.env.NEXT_PUBLIC_API_BASE = 'http://localhost:3000/api';

// Mock Web Crypto API for Node environment
if (typeof global.crypto === 'undefined') {
  const { webcrypto } = await import('crypto');
  global.crypto = webcrypto as Crypto;
}

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
});

// Clear mocks after each test
afterEach(() => {
  vi.clearAllMocks();
  sessionStorageMock.clear();
});
