/**
 * JWT Configuration Verification Tests
 *
 * These tests verify that the backend correctly handles JWT claims
 * from API Gateway's JWT authorizer.
 */

import { describe, it, expect } from 'vitest';
import {
  extractJwtClaims,
  getUserId,
  hasGroup,
  requireGroup,
  type APIGatewayProxyEventV2WithJWT,
} from '../auth/jwt-claims.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

describe('JWT Claims Extraction', () => {
  describe('extractJwtClaims', () => {
    it('should extract valid JWT claims from API Gateway event', () => {
      const event: APIGatewayProxyEventV2WithJWT = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                email: 'user@example.com',
                'cognito:username': 'user@example.com',
                'cognito:groups': ['users', 'premium'],
                iat: 1234567890,
                exp: 1234571490,
              },
            },
          },
          requestId: 'test-request-id',
          accountId: '123456789012',
          apiId: 'test-api',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: {
            method: 'GET',
            path: '/cards',
            protocol: 'HTTP/1.1',
            sourceIp: '1.2.3.4',
            userAgent: 'test-agent',
          },
          routeKey: 'GET /cards',
          stage: '$default',
          time: '01/Jan/2024:00:00:00 +0000',
          timeEpoch: 1234567890000,
        },
        version: '2.0',
        routeKey: 'GET /cards',
        rawPath: '/cards',
        rawQueryString: '',
        headers: {},
        isBase64Encoded: false,
      };

      const claims = extractJwtClaims(event);

      expect(claims.sub).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(claims.email).toBe('user@example.com');
      expect(claims.username).toBe('user@example.com');
      expect(claims.groups).toEqual(['users', 'premium']);
      expect(claims.iat).toBe(1234567890);
      expect(claims.exp).toBe(1234571490);
    });

    it('should handle missing email claim', () => {
      const event: APIGatewayProxyEventV2WithJWT = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                'cognito:username': 'testuser',
                iat: 1234567890,
                exp: 1234571490,
              },
            },
          },
          requestId: 'test-request-id',
          accountId: '123456789012',
          apiId: 'test-api',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: {
            method: 'GET',
            path: '/cards',
            protocol: 'HTTP/1.1',
            sourceIp: '1.2.3.4',
            userAgent: 'test-agent',
          },
          routeKey: 'GET /cards',
          stage: '$default',
          time: '01/Jan/2024:00:00:00 +0000',
          timeEpoch: 1234567890000,
        },
        version: '2.0',
        routeKey: 'GET /cards',
        rawPath: '/cards',
        rawQueryString: '',
        headers: {},
        isBase64Encoded: false,
      };

      const claims = extractJwtClaims(event);

      expect(claims.sub).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(claims.email).toBeUndefined();
      expect(claims.username).toBe('testuser');
    });

    it('should handle missing groups claim', () => {
      const event: APIGatewayProxyEventV2WithJWT = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                email: 'user@example.com',
                iat: 1234567890,
                exp: 1234571490,
              },
            },
          },
          requestId: 'test-request-id',
          accountId: '123456789012',
          apiId: 'test-api',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: {
            method: 'GET',
            path: '/cards',
            protocol: 'HTTP/1.1',
            sourceIp: '1.2.3.4',
            userAgent: 'test-agent',
          },
          routeKey: 'GET /cards',
          stage: '$default',
          time: '01/Jan/2024:00:00:00 +0000',
          timeEpoch: 1234567890000,
        },
        version: '2.0',
        routeKey: 'GET /cards',
        rawPath: '/cards',
        rawQueryString: '',
        headers: {},
        isBase64Encoded: false,
      };

      const claims = extractJwtClaims(event);

      expect(claims.sub).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(claims.groups).toBeUndefined();
    });

    it('should throw UnauthorizedError when claims are missing', () => {
      const event: APIGatewayProxyEventV2WithJWT = {
        requestContext: {
          requestId: 'test-request-id',
          accountId: '123456789012',
          apiId: 'test-api',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: {
            method: 'GET',
            path: '/cards',
            protocol: 'HTTP/1.1',
            sourceIp: '1.2.3.4',
            userAgent: 'test-agent',
          },
          routeKey: 'GET /cards',
          stage: '$default',
          time: '01/Jan/2024:00:00:00 +0000',
          timeEpoch: 1234567890000,
        },
        version: '2.0',
        routeKey: 'GET /cards',
        rawPath: '/cards',
        rawQueryString: '',
        headers: {},
        isBase64Encoded: false,
      };

      expect(() => extractJwtClaims(event)).toThrow(UnauthorizedError);
      expect(() => extractJwtClaims(event)).toThrow('Missing JWT claims in request context');
    });

    it('should throw UnauthorizedError when sub claim is missing', () => {
      const event: APIGatewayProxyEventV2WithJWT = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                email: 'user@example.com',
                iat: 1234567890,
                exp: 1234571490,
              },
            },
          },
          requestId: 'test-request-id',
          accountId: '123456789012',
          apiId: 'test-api',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: {
            method: 'GET',
            path: '/cards',
            protocol: 'HTTP/1.1',
            sourceIp: '1.2.3.4',
            userAgent: 'test-agent',
          },
          routeKey: 'GET /cards',
          stage: '$default',
          time: '01/Jan/2024:00:00:00 +0000',
          timeEpoch: 1234567890000,
        },
        version: '2.0',
        routeKey: 'GET /cards',
        rawPath: '/cards',
        rawQueryString: '',
        headers: {},
        isBase64Encoded: false,
      };

      expect(() => extractJwtClaims(event)).toThrow(UnauthorizedError);
      expect(() => extractJwtClaims(event)).toThrow('Malformed JWT claims');
    });

    it('should handle timestamp as string', () => {
      const event: APIGatewayProxyEventV2WithJWT = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                email: 'user@example.com',
                iat: '1234567890',
                exp: '1234571490',
              },
            },
          },
          requestId: 'test-request-id',
          accountId: '123456789012',
          apiId: 'test-api',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: {
            method: 'GET',
            path: '/cards',
            protocol: 'HTTP/1.1',
            sourceIp: '1.2.3.4',
            userAgent: 'test-agent',
          },
          routeKey: 'GET /cards',
          stage: '$default',
          time: '01/Jan/2024:00:00:00 +0000',
          timeEpoch: 1234567890000,
        },
        version: '2.0',
        routeKey: 'GET /cards',
        rawPath: '/cards',
        rawQueryString: '',
        headers: {},
        isBase64Encoded: false,
      };

      const claims = extractJwtClaims(event);

      expect(claims.iat).toBe(1234567890);
      expect(claims.exp).toBe(1234571490);
    });

    it('should handle groups as array', () => {
      const event: APIGatewayProxyEventV2WithJWT = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                email: 'user@example.com',
                'cognito:groups': ['admin', 'users'],
                iat: 1234567890,
                exp: 1234571490,
              },
            },
          },
          requestId: 'test-request-id',
          accountId: '123456789012',
          apiId: 'test-api',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: {
            method: 'GET',
            path: '/cards',
            protocol: 'HTTP/1.1',
            sourceIp: '1.2.3.4',
            userAgent: 'test-agent',
          },
          routeKey: 'GET /cards',
          stage: '$default',
          time: '01/Jan/2024:00:00:00 +0000',
          timeEpoch: 1234567890000,
        },
        version: '2.0',
        routeKey: 'GET /cards',
        rawPath: '/cards',
        rawQueryString: '',
        headers: {},
        isBase64Encoded: false,
      };

      const claims = extractJwtClaims(event);

      expect(claims.groups).toEqual(['admin', 'users']);
    });
  });

  describe('getUserId', () => {
    it('should extract user ID from JWT claims', () => {
      const event: APIGatewayProxyEventV2WithJWT = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                email: 'user@example.com',
                iat: 1234567890,
                exp: 1234571490,
              },
            },
          },
          requestId: 'test-request-id',
          accountId: '123456789012',
          apiId: 'test-api',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: {
            method: 'GET',
            path: '/cards',
            protocol: 'HTTP/1.1',
            sourceIp: '1.2.3.4',
            userAgent: 'test-agent',
          },
          routeKey: 'GET /cards',
          stage: '$default',
          time: '01/Jan/2024:00:00:00 +0000',
          timeEpoch: 1234567890000,
        },
        version: '2.0',
        routeKey: 'GET /cards',
        rawPath: '/cards',
        rawQueryString: '',
        headers: {},
        isBase64Encoded: false,
      };

      const userId = getUserId(event);

      expect(userId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });
  });

  describe('hasGroup', () => {
    it('should return true when user has the group', () => {
      const event: APIGatewayProxyEventV2WithJWT = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                email: 'user@example.com',
                'cognito:groups': ['admin', 'users'],
                iat: 1234567890,
                exp: 1234571490,
              },
            },
          },
          requestId: 'test-request-id',
          accountId: '123456789012',
          apiId: 'test-api',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: {
            method: 'GET',
            path: '/cards',
            protocol: 'HTTP/1.1',
            sourceIp: '1.2.3.4',
            userAgent: 'test-agent',
          },
          routeKey: 'GET /cards',
          stage: '$default',
          time: '01/Jan/2024:00:00:00 +0000',
          timeEpoch: 1234567890000,
        },
        version: '2.0',
        routeKey: 'GET /cards',
        rawPath: '/cards',
        rawQueryString: '',
        headers: {},
        isBase64Encoded: false,
      };

      expect(hasGroup(event, 'admin')).toBe(true);
      expect(hasGroup(event, 'users')).toBe(true);
    });

    it('should return false when user does not have the group', () => {
      const event: APIGatewayProxyEventV2WithJWT = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                email: 'user@example.com',
                'cognito:groups': ['users'],
                iat: 1234567890,
                exp: 1234571490,
              },
            },
          },
          requestId: 'test-request-id',
          accountId: '123456789012',
          apiId: 'test-api',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: {
            method: 'GET',
            path: '/cards',
            protocol: 'HTTP/1.1',
            sourceIp: '1.2.3.4',
            userAgent: 'test-agent',
          },
          routeKey: 'GET /cards',
          stage: '$default',
          time: '01/Jan/2024:00:00:00 +0000',
          timeEpoch: 1234567890000,
        },
        version: '2.0',
        routeKey: 'GET /cards',
        rawPath: '/cards',
        rawQueryString: '',
        headers: {},
        isBase64Encoded: false,
      };

      expect(hasGroup(event, 'admin')).toBe(false);
    });

    it('should return false when user has no groups', () => {
      const event: APIGatewayProxyEventV2WithJWT = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                email: 'user@example.com',
                iat: 1234567890,
                exp: 1234571490,
              },
            },
          },
          requestId: 'test-request-id',
          accountId: '123456789012',
          apiId: 'test-api',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: {
            method: 'GET',
            path: '/cards',
            protocol: 'HTTP/1.1',
            sourceIp: '1.2.3.4',
            userAgent: 'test-agent',
          },
          routeKey: 'GET /cards',
          stage: '$default',
          time: '01/Jan/2024:00:00:00 +0000',
          timeEpoch: 1234567890000,
        },
        version: '2.0',
        routeKey: 'GET /cards',
        rawPath: '/cards',
        rawQueryString: '',
        headers: {},
        isBase64Encoded: false,
      };

      expect(hasGroup(event, 'admin')).toBe(false);
    });
  });

  describe('requireGroup', () => {
    it('should not throw when user has the required group', () => {
      const event: APIGatewayProxyEventV2WithJWT = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                email: 'user@example.com',
                'cognito:groups': ['admin'],
                iat: 1234567890,
                exp: 1234571490,
              },
            },
          },
          requestId: 'test-request-id',
          accountId: '123456789012',
          apiId: 'test-api',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: {
            method: 'GET',
            path: '/cards',
            protocol: 'HTTP/1.1',
            sourceIp: '1.2.3.4',
            userAgent: 'test-agent',
          },
          routeKey: 'GET /cards',
          stage: '$default',
          time: '01/Jan/2024:00:00:00 +0000',
          timeEpoch: 1234567890000,
        },
        version: '2.0',
        routeKey: 'GET /cards',
        rawPath: '/cards',
        rawQueryString: '',
        headers: {},
        isBase64Encoded: false,
      };

      expect(() => requireGroup(event, 'admin')).not.toThrow();
    });

    it('should throw ForbiddenError when user does not have the required group', () => {
      const event: APIGatewayProxyEventV2WithJWT = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                email: 'user@example.com',
                'cognito:groups': ['users'],
                iat: 1234567890,
                exp: 1234571490,
              },
            },
          },
          requestId: 'test-request-id',
          accountId: '123456789012',
          apiId: 'test-api',
          domainName: 'api.example.com',
          domainPrefix: 'api',
          http: {
            method: 'GET',
            path: '/cards',
            protocol: 'HTTP/1.1',
            sourceIp: '1.2.3.4',
            userAgent: 'test-agent',
          },
          routeKey: 'GET /cards',
          stage: '$default',
          time: '01/Jan/2024:00:00:00 +0000',
          timeEpoch: 1234567890000,
        },
        version: '2.0',
        routeKey: 'GET /cards',
        rawPath: '/cards',
        rawQueryString: '',
        headers: {},
        isBase64Encoded: false,
      };

      expect(() => requireGroup(event, 'admin')).toThrow(ForbiddenError);
      expect(() => requireGroup(event, 'admin')).toThrow("Access denied: requires group 'admin'");
    });
  });
});
