# E2E Tests Quick Start

## 1. Setup (One-time)

```bash
# Copy environment template
cp .env.test.example .env.test

# Edit with your test environment values
# Required: AWS_REGION, DDB_TABLE, BUCKET_UPLOADS, COGNITO_USER_POOL_ID,
#           COGNITO_CLIENT_ID, TEST_USER_EMAIL, TEST_USER_PASSWORD, API_GATEWAY_URL
vim .env.test

# Install dependencies
pnpm install
```

## 2. Enable USER_PASSWORD_AUTH on Cognito

```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id YOUR_POOL_ID \
  --client-id YOUR_CLIENT_ID \
  --explicit-auth-flows USER_PASSWORD_AUTH
```

## 3. Run Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test
pnpm test:e2e src/tests/e2e/auth.e2e.test.ts

# Watch mode
pnpm test:e2e:watch
```

## 4. Write Your First Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getOrCreateTestUser } from './cognito-auth.js';
import { apiRequest, cleanupUserData } from './test-helpers.js';

describe('My Feature E2E', () => {
  let tokens, userId;

  beforeAll(async () => {
    const { tokens: t, user } = await getOrCreateTestUser();
    tokens = t;
    userId = user.sub;
  });

  afterAll(async () => {
    await cleanupUserData(userId);
  });

  it('should work', async () => {
    const response = await apiRequest('/cards', { method: 'GET' }, tokens);
    expect(response.status).toBe(200);
  });
});
```

## Common Issues

### "Missing required environment variables"

→ Copy `.env.test.example` to `.env.test` and fill in values

### "NotAuthorizedException"

→ Enable USER_PASSWORD_AUTH on your Cognito app client

### "AccessDeniedException"

→ Verify your AWS credentials have required IAM permissions

## Documentation

- **Setup Guide**: `../../E2E_TEST_SETUP.md`
- **Detailed Docs**: `README.md`
- **Example Test**: `auth.e2e.test.ts`
