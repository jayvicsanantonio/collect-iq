# Idempotency Implementation Examples

## Overview

The idempotency system provides two main components:

1. **Token Storage** (`idempotency.ts`): Low-level functions for storing and retrieving idempotency tokens in DynamoDB
2. **Middleware** (`idempotency-middleware.ts`): High-level wrapper for Lambda handlers

## Basic Usage

### Using the Middleware Wrapper

The simplest way to add idempotency to a handler:

```typescript
import { withIdempotency } from '../utils/idempotency-middleware.js';

export const handler = withIdempotency(
  async (event) => {
    // Your handler logic here
    const result = await createCard(userId, cardData);
    return {
      statusCode: 201,
      body: JSON.stringify(result),
    };
  },
  { operation: 'cards_create' },
);
```

### Using the Helper Function

For even simpler syntax:

```typescript
import { createIdempotentHandler } from '../utils/idempotency-middleware.js';

export const handler = createIdempotentHandler('cards_create', async (event) => {
  // Your handler logic
  return { statusCode: 201, body: JSON.stringify(result) };
});
```

### Required Idempotency

To make idempotency mandatory (returns 400 if header missing):

```typescript
export const handler = withIdempotency(
  async (event) => {
    // Handler logic
  },
  {
    operation: 'cards_revalue',
    required: true, // Idempotency-Key header is mandatory
  },
);
```

### Custom User ID Extraction

If you need custom logic to extract the user ID:

```typescript
export const handler = withIdempotency(
  async (event) => {
    // Handler logic
  },
  {
    operation: 'admin_operation',
    getUserId: (event) => {
      // Custom extraction logic
      return event.headers['x-admin-id'] || 'system';
    },
  },
);
```

### Custom TTL

To override the default 600-second TTL:

```typescript
export const handler = withIdempotency(
  async (event) => {
    // Handler logic
  },
  {
    operation: 'cards_create',
    ttlSeconds: 300, // 5 minutes instead of 10
  },
);
```

## Client Usage

### Making an Idempotent Request

Clients should include the `Idempotency-Key` header:

```typescript
// Generate a unique key (typically a UUID)
const idempotencyKey = crypto.randomUUID();

const response = await fetch('/cards', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Idempotency-Key': idempotencyKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(cardData),
});
```

### Retry Logic

If a request fails due to network issues, retry with the same key:

```typescript
async function createCardWithRetry(cardData, maxRetries = 3) {
  const idempotencyKey = crypto.randomUUID();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('/cards', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey, // Same key for all retries
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cardData),
      });

      if (response.ok) {
        return await response.json();
      }

      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }

      // Retry on server errors (5xx)
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
        continue;
      }
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      throw error;
    }
  }
}
```

## Low-Level API Usage

If you need more control, use the low-level functions directly:

```typescript
import {
  saveIdempotencyToken,
  getIdempotencyToken,
  extractIdempotencyKey,
} from '../utils/idempotency.js';

export async function handler(event: APIGatewayProxyEventV2) {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);
  const idempotencyKey = extractIdempotencyKey(event.headers);

  if (idempotencyKey) {
    // Check for existing result
    const cachedResult = await getIdempotencyToken(userId, idempotencyKey, requestId);
    if (cachedResult) {
      return cachedResult as APIGatewayProxyResultV2;
    }
  }

  // Execute operation
  const result = await performOperation();

  // Cache result
  if (idempotencyKey) {
    const response = {
      statusCode: 201,
      body: JSON.stringify(result),
    };

    try {
      await saveIdempotencyToken(userId, idempotencyKey, 'my_operation', response, requestId);
    } catch (error) {
      // Log but don't fail - operation succeeded
      logger.error('Failed to cache result', error);
    }

    return response;
  }

  return {
    statusCode: 201,
    body: JSON.stringify(result),
  };
}
```

## DynamoDB Schema

Idempotency tokens are stored with the following structure:

```typescript
{
  PK: "USER#{userId}",              // Partition key
  SK: "IDEMPOTENCY#{idempotencyKey}", // Sort key
  entityType: "IDEMPOTENCY",
  idempotencyKey: "abc-123-def",
  userId: "user-456",
  operation: "cards_create",
  result: {                          // Cached response
    statusCode: 201,
    body: "{...}"
  },
  createdAt: "2025-10-15T10:30:00Z",
  ttl: 1729000000                    // Unix timestamp for auto-deletion
}
```

## Behavior

### Race Conditions

When multiple requests arrive with the same idempotency key:

1. First request: Stores token and executes operation
2. Concurrent requests: Fail to store token (ConflictError) and return cached result
3. Subsequent requests: Find existing token and return cached result

### TTL Expiration

- Default TTL: 600 seconds (10 minutes)
- Configurable via `IDEMPOTENCY_TTL_SECONDS` environment variable
- DynamoDB automatically deletes expired tokens
- Manual expiration check prevents returning stale data

### Error Handling

- Middleware errors: System degrades gracefully, executes handler anyway
- Storage errors: Logged but don't block the operation
- Retrieval errors: Return null, allow operation to proceed
- Only successful responses (2xx) are cached

## Best Practices

1. **Generate Keys Client-Side**: Use UUIDs or similar unique identifiers
2. **Reuse Keys on Retry**: Same key for all retry attempts of the same operation
3. **Don't Reuse Keys**: Each unique operation should have a unique key
4. **Set Appropriate TTL**: Balance between safety and storage costs
5. **Monitor Conflicts**: Track ConflictError metrics to detect duplicate requests
6. **Optional by Default**: Make idempotency optional unless specifically required
7. **Document Requirements**: Clearly document which endpoints support/require idempotency

## Testing

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { saveIdempotencyToken, getIdempotencyToken } from './idempotency.js';

describe('Idempotency', () => {
  it('should store and retrieve token', async () => {
    const userId = 'test-user';
    const key = 'test-key-123';
    const result = { data: 'test' };

    await saveIdempotencyToken(userId, key, 'test_op', result);
    const retrieved = await getIdempotencyToken(userId, key);

    expect(retrieved).toEqual(result);
  });

  it('should prevent duplicate storage', async () => {
    const userId = 'test-user';
    const key = 'duplicate-key';
    const result = { data: 'test' };

    await saveIdempotencyToken(userId, key, 'test_op', result);

    await expect(saveIdempotencyToken(userId, key, 'test_op', result)).rejects.toThrow(
      'Duplicate request detected',
    );
  });
});
```

## Environment Variables

- `IDEMPOTENCY_TTL_SECONDS`: TTL for idempotency tokens (default: 600)
- `DDB_TABLE`: DynamoDB table name (required)
- `AWS_REGION`: AWS region (required)
