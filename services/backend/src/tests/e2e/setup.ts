/**
 * E2E Test Suite Setup
 *
 * This file runs before all E2E tests to:
 * - Load test environment variables
 * - Validate required configuration
 * - Set up global test utilities
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load test environment variables
config({ path: resolve(process.cwd(), '.env.test') });

// Validate required environment variables
const requiredEnvVars = [
  'AWS_REGION',
  'DDB_TABLE',
  'BUCKET_UPLOADS',
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
  'TEST_USER_EMAIL',
  'TEST_USER_PASSWORD',
  'API_GATEWAY_URL',
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables for E2E tests:');
  missingVars.forEach((varName) => console.error(`   - ${varName}`));
  console.error('\nPlease copy .env.test and fill in the values.');
  process.exit(1);
}

console.log('✅ E2E test environment configured');
console.log(`   Region: ${process.env.AWS_REGION}`);
console.log(`   DynamoDB Table: ${process.env.DDB_TABLE}`);
console.log(`   S3 Bucket: ${process.env.BUCKET_UPLOADS}`);
console.log(`   API Gateway: ${process.env.API_GATEWAY_URL}`);
