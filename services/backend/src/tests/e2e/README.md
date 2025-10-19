# E2E Test Suite

This directory contains end-to-end tests for the CollectIQ backend services. These tests validate complete workflows against real AWS services in a test environment.

## Prerequisites

1. **AWS Test Environment**: You need a deployed test environment with:
   - Cognito User Pool configured for USER_PASSWORD_AUTH
   - DynamoDB table
   - S3 bucket for uploads
   - API Gateway with deployed Lambda functions
   - Step Functions state machine (for workflow tests)

2. **Environment Configuration**: Copy `.env.test` and fill in your test environment values:

   ```bash
   cp .env.test .env.test.local
   # Edit .env.test.local with your test environment values
   ```

3. **IAM Permissions**: Your AWS credentials need permissions to:
   - Create/delete Cognito users
   - Read/write DynamoDB items
   - Upload/delete S3 objects
   - Invoke API Gateway endpoints

## Configuration

### Required Environment Variables

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

### Cognito User Pool Configuration

The test user pool must have:

- **USER_PASSWORD_AUTH** enabled in app client settings
- **Email** as a required attribute
- Password policy that allows the test password

To enable USER_PASSWORD_AUTH:

```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id YOUR_POOL_ID \
  --client-id YOUR_CLIENT_ID \
  --explicit-auth-flows USER_PASSWORD_AUTH
```

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
pnpm test:e2e src/tests/e2e/complete-flow.e2e.test.ts
```

## Test Structure

### Setup (`setup.ts`)

- Loads test environment variables
- Validates required configuration
- Runs before all E2E tests

### Cognito Auth (`cognito-auth.ts`)

- `authenticateTestUser()`: Get JWT tokens for a user
- `createTestUser()`: Create a new test user
- `deleteTestUser()`: Clean up test user
- `getOrCreateTestUser()`: Get or create test user (idempotent)

### Test Helpers (`test-helpers.ts`)

- `apiRequest()`: Make authenticated API requests
- `cleanupUserData()`: Remove test data from DynamoDB
- `cleanupUserUploads()`: Remove test uploads from S3
- `waitFor()`: Wait for async conditions
- `generateTestEmail()`: Generate unique test emails
- `createTestImageBuffer()`: Create minimal test images

## Writing E2E Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getOrCreateTestUser, cleanupTestUser } from './cognito-auth.js';
import { apiRequest, cleanupUserData } from './test-helpers.js';
import type { CognitoTokens } from './cognito-auth.js';

describe('Feature E2E Tests', () => {
  let tokens: CognitoTokens;
  let userId: string;

  beforeAll(async () => {
    // Set up test user and get tokens
    const { tokens: testTokens, user } = await getOrCreateTestUser();
    tokens = testTokens;
    userId = user.sub!;
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupUserData(userId);
    // Optionally delete test user (or keep for reuse)
    // await cleanupTestUser();
  });

  it('should complete the workflow', async () => {
    // Make API request
    const response = await apiRequest(
      '/cards',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Pikachu' }),
      },
      tokens,
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.cardId).toBeDefined();
  });
});
```

### Best Practices

1. **Cleanup**: Always clean up test data in `afterAll` hooks
2. **Isolation**: Each test should be independent
3. **Idempotency**: Tests should be rerunnable without manual cleanup
4. **Timeouts**: Use appropriate timeouts for async operations
5. **Error Handling**: Test both success and error scenarios
6. **Real Data**: Don't mock AWS services - test against real infrastructure

## Test Data Management

### User Data

- Test users are created automatically if they don't exist
- Users can be reused across test runs for faster execution
- Clean up user data after each test run

### S3 Uploads

- Upload test images to S3 during tests
- Clean up uploads in `afterAll` hooks
- Use minimal test images (1x1 pixel) for speed

### DynamoDB Records

- Create cards and other records during tests
- Query and verify data persistence
- Clean up all records after tests complete

## Troubleshooting

### Authentication Errors

- Verify USER_PASSWORD_AUTH is enabled on the app client
- Check that test user credentials are correct
- Ensure user pool ID and client ID match your environment

### Permission Errors

- Verify your AWS credentials have required permissions
- Check IAM policies for Cognito, DynamoDB, and S3 access
- Ensure API Gateway authorizer is configured correctly

### Timeout Errors

- Increase test timeout in vitest.e2e.config.ts
- Check that AWS services are responding
- Verify network connectivity to AWS

### Data Cleanup Issues

- Manually verify DynamoDB and S3 are cleaned up
- Check for orphaned test data
- Use AWS Console to inspect test resources

## CI/CD Integration

For GitHub Actions or other CI systems:

```yaml
- name: Run E2E Tests
  env:
    AWS_REGION: ${{ secrets.AWS_REGION }}
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

- Cognito: User operations (minimal cost)
- DynamoDB: Read/write operations
- S3: Storage and data transfer
- API Gateway: Request charges
- Lambda: Invocation and compute time
- Rekognition: Image analysis (if tested)
- Bedrock: Token usage (if tested)

To minimize costs:

- Run E2E tests selectively (not on every commit)
- Use small test images
- Clean up resources promptly
- Consider using LocalStack for some services
