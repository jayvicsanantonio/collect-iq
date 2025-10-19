/**
 * Store Module
 * Exports DynamoDB data access layer functions
 */

// DynamoDB client and utilities
export {
  getDynamoDBClient,
  getTableName,
  generateUserPK,
  generateCardSK,
  generatePriceSK,
  generateFeedbackSK,
  extractCardId,
  extractUserId,
  extractPriceTimestamp,
  calculateTTL,
  isEntityType,
} from './dynamodb-client.js';

// Card CRUD operations
export { createCard, listCards, getCard, updateCard, deleteCard } from './card-service.js';

// Pricing cache operations
export {
  savePricingSnapshot,
  getPricingSnapshot,
  deletePricingSnapshots,
} from './pricing-cache.js';
