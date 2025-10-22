# E2E Test Suite Setup Guide

This guide explains how to set up and run end-to-end tests for the CollectIQ backend.

## Overview

The E2E test suite validates complete workflows against real AWS services in a test environment. It includes:

- **Cognito Authentication**: Test user creation and JWT token management
- **API Testing**: Authenticated requests to API Gateway endpoints
- **Data Management**: DynamoDB and S3 cleanup utilities
- **Test Helpers**: Common utilities for E2E test scenarios

## Prerequisites

### 1. AWS Test Environment

You need a deployed test environment with the following resources:

- **Cognito User Pool** with USER_PASSWORD_AUTH enabled
- **DynamoDB Table** for card storage
- **S3 Bucket** for image uploads
- **API Gateway** with deployed Lambda functions
- **Step Functions** state machine (for workflow tests)

### 2. Cognito Configuration

The Cognito User Pool must be configured to allow USER_PASSWORD_AUTH:

```bash
# Enable USER_PASSWORD_AUTH on the app client
aws cognito-idp update-user-pool-client \
  --user-pool-id YOUR_POOL_ID \
  --client-id YOUR_CLIENT_ID \
  --explicit-auth-flows USER_PASSWORD_AUTH
```

### 3. IAM Permissions

Your AWS credentials need the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminDeleteUser",
        "cognito-idp:AdminGetUser",
        "cognito-idp:InitiateAuth"
      ],
      "Resource": "arn:aws:cognito-idp:*:*:userpool/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/test-*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::test-*", "arn:aws:s3:::test-*/*"]
    }
  ]
}
```

## Setup Instructions

### Step 1: Install Dependencies

```bash
cd services/backend
pnpm install
```

### Step 2: Configure Environment

Copy the example environment file and fill in your test environment values:

```bash
cp .env.test.example .env.test
```

Edit `.env.test` with your test environment configuration:

```bash
# AWS Configuration
AWS_REGION=us-east-1

# DynamoDB
DDB_TABLE=test-collectiq-cards

# S3
BUCKET_UPLOADS=test-collectiq-uploads

# Cognito Test User Pool
COGNITO_USER_POOL_ID=us-east-1_TESTPOOL
COGNITO_CLIENT_ID=test-client-id

# Test User Credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=TestPassword123!

# API Gateway
API_GATEWAY_URL=https://test-api.execute-api.us-east-1.amazonaws.com
```

### Step 3: Verify Configuration

The setup script will validate your configuration when you run tests:

```bash
pnpm test:e2e
```

If configuration is missing, you'll see an error message indicating which variables need to be set.

## Running Tests

### Run All E2E Tests

```bash
pnpm test:e2e
```

### Run E2E Tests in Watch Mode

```bash
pnpm test:e2e:watch
```

### Run Specific Test File

```bash
pnpm test:e2e src/tests/e2e/auth.e2e.test.ts
```

### Run with Verbose Output

```bash
pnpm test:e2e -- --reporter=verbose
```

## Test Structure

### Files and Directories

```
services/backend/src/tests/e2e/
├── README.md                 # Detailed E2E test documentation
├── setup.ts                  # Test suite setup and validation
├── cognito-auth.ts           # Cognito authentication utilities
├── test-helpers.ts           # Common test helper functions
├── auth.e2e.test.ts          # Authentication E2E tests
└── [future test files]       # Additional E2E test suites
```

### Configuration Files

```
services/backend/
├── .env.test.example         # Example environment configuration
├── .env.test                 # Your test environment (gitignored)
├── vitest.config.ts          # Unit test configuration
└── vitest.e2e.config.ts      # E2E test configuration
```

## Test User Management

### Automatic User Creation

The test suite automatically creates a test user if it doesn't exist:

```typescript
const { tokens, user } = await getOrCreateTestUser();
```

This function:

1. Attempts to authenticate with existing credentials
2. Creates a new user if authentication fails
3. Returns JWT tokens for API requests

### Manual User Creation

You can also create users manually:

```typescript
import { createTestUser, authenticateTestUser } from './cognito-auth.js';

// Create user
const user = await createTestUser('test@example.com', 'Password123!');

// Get tokens
const tokens = await authenticateTestUser('test@example.com', 'Password123!');
```

### User Cleanup

Clean up test users after tests:

```typescript
import { cleanupTestUser } from './cognito-auth.js';

afterAll(async () => {
  await cleanupTestUser();
});
```

## Data Cleanup

### DynamoDB Cleanup

Remove all test data for a user:

```typescript
import { cleanupUserData } from './test-helpers.js';

afterAll(async () => {
  await cleanupUserData(userId);
});
```

### S3 Cleanup

Remove all test uploads for a user:

```typescript
import { cleanupUserUploads } from './test-helpers.js';

afterAll(async () => {
  await cleanupUserUploads(userId);
});
```

## Writing E2E Tests

### Basic Test Template

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getOrCreateTestUser } from './cognito-auth.js';
import { apiRequest, cleanupUserData } from './test-helpers.js';
import type { CognitoTokens } from './cognito-auth.js';

describe('Feature E2E Tests', () => {
  let tokens: CognitoTokens;
  let userId: string;

  beforeAll(async () => {
    const { tokens: testTokens, user } = await getOrCreateTestUser();
    tokens = testTokens;
    userId = user.sub!;
  });

  afterAll(async () => {
    await cleanupUserData(userId);
  });

  it('should complete the workflow', async () => {
    const response = await apiRequest('/cards', { method: 'GET' }, tokens);

    expect(response.status).toBe(200);
  });
});
```

### Making API Requests

```typescript
// GET request
const response = await apiRequest('/cards', { method: 'GET' }, tokens);

// POST request
const response = await apiRequest(
  '/cards',
  {
    method: 'POST',
    body: JSON.stringify({ name: 'Pikachu' }),
  },
  tokens,
);

// DELETE request
const response = await apiRequest(`/cards/${cardId}`, { method: 'DELETE' }, tokens);
```

### Waiting for Async Operations

```typescript
import { waitFor } from './test-helpers.js';

// Wait for card to be processed
const success = await waitFor(
  async () => {
    const response = await apiRequest(`/cards/${cardId}`, { method: 'GET' }, tokens);
    const card = await response.json();
    return card.authenticityScore !== undefined;
  },
  30000, // 30 second timeout
  1000, // Check every 1 second
);

expect(success).toBe(true);
```

## Troubleshooting

### Authentication Errors

**Error**: `NotAuthorizedException: Incorrect username or password`

**Solution**:

- Verify USER_PASSWORD_AUTH is enabled on the app client
- Check that test user credentials are correct in `.env.test`

### Permission Errors

**Error**: `AccessDeniedException: User is not authorized`

**Solution**:

- Verify your AWS credentials have required IAM permissions
- Check that you're using the correct AWS profile

### Configuration Errors

**Error**: `Missing required environment variables`

**Solution**:

- Ensure `.env.test` exists and is properly configured
- Copy from `.env.test.example` and fill in all required values

### Network Errors

**Error**: `ECONNREFUSED` or timeout errors

**Solution**:

- Verify API Gateway URL is correct
- Check that your test environment is deployed and running
- Ensure network connectivity to AWS

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install

      - name: Run E2E Tests
        env:
          AWS_REGION: ${{ secrets.AWS_REGION }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          DDB_TABLE: ${{ secrets.TEST_DDB_TABLE }}
          BUCKET_UPLOADS: ${{ secrets.TEST_BUCKET }}
          COGNITO_USER_POOL_ID: ${{ secrets.TEST_COGNITO_POOL_ID }}
          COGNITO_CLIENT_ID: ${{ secrets.TEST_COGNITO_CLIENT_ID }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
          API_GATEWAY_URL: ${{ secrets.TEST_API_URL }}
        run: pnpm test:e2e
```

## Cost Considerations

E2E tests make real AWS API calls and incur costs:

- **Cognito**: ~$0.0055 per user operation
- **DynamoDB**: Pay per read/write operation
- **S3**: Storage and data transfer costs
- **API Gateway**: ~$1 per million requests
- **Lambda**: Invocation and compute time
- **Rekognition**: ~$0.001 per image (if tested)
- **Bedrock**: Token-based pricing (if tested)

### Cost Optimization Tips

1. Run E2E tests selectively (not on every commit)
2. Use small test images (1x1 pixel)
3. Clean up resources promptly after tests
4. Reuse test users across runs
5. Consider using LocalStack for some services

## Next Steps

After setting up the E2E test suite:

1. Review the example test in `auth.e2e.test.ts`
2. Write additional E2E tests for your workflows
3. Integrate E2E tests into your CI/CD pipeline
4. Monitor test execution times and costs
5. Expand test coverage as features are added

For more details, see `src/tests/e2e/README.md`.
