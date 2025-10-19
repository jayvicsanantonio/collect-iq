/**
 * Authentication and Authorization Module
 * Exports JWT claims extraction and ownership enforcement utilities
 */

export type { APIGatewayProxyEventV2WithJWT } from './jwt-claims.js';

export { extractJwtClaims, getUserId, hasGroup, requireGroup } from './jwt-claims.js';

export { enforceOwnership, isOwner, enforceCardOwnership } from './ownership.js';
