/**
 * JWT Claims Extraction Utility
 * Parses API Gateway authorizer context to extract Cognito JWT claims
 */

import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { AuthContext, AuthContextSchema } from '@collectiq/shared';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

/**
 * Extended API Gateway event type with JWT authorizer context
 */
export interface APIGatewayProxyEventV2WithJWT extends APIGatewayProxyEventV2 {
  requestContext: APIGatewayProxyEventV2['requestContext'] & {
    authorizer?: {
      jwt?: {
        claims: Record<string, string | number | string[]>;
      };
    };
  };
}

/**
 * Extract JWT claims from API Gateway event
 * API Gateway JWT authorizer populates event.requestContext.authorizer.jwt.claims
 *
 * @param event - API Gateway proxy event
 * @returns Validated AuthContext with sub, email, groups, iat, exp
 * @throws UnauthorizedError if claims are missing or malformed
 */
export function extractJwtClaims(event: APIGatewayProxyEventV2WithJWT): AuthContext {
  const claims = event.requestContext?.authorizer?.jwt?.claims;

  if (!claims) {
    throw new UnauthorizedError(
      'Missing JWT claims in request context',
      event.requestContext?.requestId || '',
    );
  }

  try {
    const sub = getStringClaim(claims, 'sub');
    if (!sub) {
      throw new Error('Missing sub claim');
    }

    const rawEmail = getStringClaim(claims, 'email');
    const username =
      getStringClaim(claims, 'cognito:username') ?? getStringClaim(claims, 'username');
    const email = rawEmail ?? (username && username.includes('@') ? username : undefined);

    // Parse claims into AuthContext structure
    const authContext = {
      sub,
      email,
      username,
      groups: claims['cognito:groups'] ? parseGroups(claims['cognito:groups']) : undefined,
      iat: parseTimestamp(claims.iat),
      exp: parseTimestamp(claims.exp),
    };

    // Validate with Zod schema
    const validated = AuthContextSchema.parse(authContext);

    return validated;
  } catch (error) {
    if (error instanceof Error) {
      throw new UnauthorizedError(
        `Malformed JWT claims: ${error.message}`,
        event.requestContext?.requestId || '',
      );
    }
    throw new UnauthorizedError(
      'Failed to parse JWT claims',
      event.requestContext?.requestId || '',
    );
  }
}

/**
 * Parse groups claim which may be a string or array
 */
function parseGroups(groups: unknown): string[] {
  if (Array.isArray(groups)) {
    return groups.filter((g) => typeof g === 'string');
  }
  if (typeof groups === 'string') {
    // Handle comma-separated string
    return groups.split(',').map((g) => g.trim());
  }
  return [];
}

/**
 * Parse timestamp claim which may be string or number
 */
function parseTimestamp(timestamp: unknown): number {
  if (typeof timestamp === 'number') {
    return timestamp;
  }
  if (typeof timestamp === 'string') {
    const parsed = parseInt(timestamp, 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid timestamp: ${timestamp}`);
    }
    return parsed;
  }
  throw new Error(`Timestamp must be number or string, got ${typeof timestamp}`);
}

/**
 * Safely extract a string claim from the JWT claims collection
 */
function getStringClaim(
  claims: Record<string, string | number | string[]>,
  key: string,
): string | undefined {
  const value = claims[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Get user ID (sub claim) from event
 * Convenience function for handlers that only need the user ID
 *
 * @param event - API Gateway proxy event
 * @returns Cognito sub (user ID)
 */
export function getUserId(event: APIGatewayProxyEventV2WithJWT): string {
  const claims = extractJwtClaims(event);
  return claims.sub;
}

/**
 * Check if user has a specific group membership
 *
 * @param event - API Gateway proxy event
 * @param groupName - Group name to check
 * @returns true if user is in the group
 */
export function hasGroup(event: APIGatewayProxyEventV2WithJWT, groupName: string): boolean {
  const claims = extractJwtClaims(event);
  return claims.groups?.includes(groupName) ?? false;
}

/**
 * Require user to be in a specific group
 *
 * @param event - API Gateway proxy event
 * @param groupName - Required group name
 * @throws ForbiddenError if user is not in the group
 */
export function requireGroup(event: APIGatewayProxyEventV2WithJWT, groupName: string): void {
  if (!hasGroup(event, groupName)) {
    const claims = extractJwtClaims(event);
    throw new ForbiddenError(
      `Access denied: requires group '${groupName}'`,
      event.requestContext?.requestId || '',
      { userId: claims.sub },
    );
  }
}
