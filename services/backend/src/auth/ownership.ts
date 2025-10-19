/**
 * Ownership Enforcement Utility
 * Ensures users can only access their own resources
 */

import { ForbiddenError } from '../utils/errors.js';

/**
 * Enforce ownership by comparing authenticated user ID with resource owner ID
 *
 * @param userId - Authenticated user ID (from JWT sub claim)
 * @param resourceOwnerId - Owner ID of the resource being accessed
 * @param resourceType - Type of resource (for error message)
 * @param resourceId - ID of resource (for error message)
 * @param requestId - Request ID for tracing
 * @throws ForbiddenError if userId does not match resourceOwnerId
 */
export function enforceOwnership(
  userId: string,
  resourceOwnerId: string,
  resourceType: string = 'resource',
  resourceId?: string,
  requestId?: string,
): void {
  if (userId !== resourceOwnerId) {
    const detail = resourceId
      ? `You do not have permission to access ${resourceType} ${resourceId}`
      : `You do not have permission to access this ${resourceType}`;

    throw new ForbiddenError(detail, requestId || '', {
      userId,
      resourceOwnerId,
      resourceType,
      resourceId,
    });
  }
}

/**
 * Check if user owns a resource without throwing
 *
 * @param userId - Authenticated user ID
 * @param resourceOwnerId - Owner ID of the resource
 * @returns true if user owns the resource
 */
export function isOwner(userId: string, resourceOwnerId: string): boolean {
  return userId === resourceOwnerId;
}

/**
 * Enforce ownership for card resources
 * Convenience wrapper with card-specific error messages
 *
 * @param userId - Authenticated user ID
 * @param cardOwnerId - Owner ID of the card
 * @param cardId - Card ID
 * @param requestId - Request ID for tracing
 * @throws ForbiddenError if user does not own the card
 */
export function enforceCardOwnership(
  userId: string,
  cardOwnerId: string,
  cardId: string,
  requestId?: string,
): void {
  enforceOwnership(userId, cardOwnerId, 'card', cardId, requestId);
}
