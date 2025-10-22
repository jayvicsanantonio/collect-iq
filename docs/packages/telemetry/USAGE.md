# Telemetry Usage Guide

This guide demonstrates how to use the observability features in CollectIQ backend services.

## Logger

The structured JSON logger ensures consistent logging format with automatic PII filtering.

### Basic Usage

```typescript
import { logger } from '@collectiq/telemetry';

// Info logging
logger.info('Card created successfully', {
  requestId: 'req-123',
  userId: 'user-456',
  operation: 'cards_create',
  cardId: 'card-789',
});

// Error logging
try {
  await someOperation();
} catch (error) {
  logger.error('Operation failed', error, {
    requestId: 'req-123',
    operation: 'some_operation',
  });
}

// Debug logging (only shown when LOG_LEVEL=DEBUG)
logger.debug('Processing request', {
  requestId: 'req-123',
  details: { foo: 'bar' },
});

// Warning logging
logger.warn('Rate limit approaching', {
  requestId: 'req-123',
  currentRate: 95,
  threshold: 100,
});
```

### Log Levels

Set the `LOG_LEVEL` environment variable to control verbosity:

- `DEBUG`: All logs (verbose)
- `INFO`: Info, warn, and error logs (default)
- `WARN`: Warn and error logs only
- `ERROR`: Error logs only

### PII Protection

The logger automatically removes common PII fields:

- email
- phone / phoneNumber
- address
- ssn
- creditCard

Note: `userId` is safe to log as it's a Cognito sub (UUID), not an email.

## Metrics

CloudWatch metrics provide visibility into system performance and business metrics.

### API Latency

```typescript
import { metrics } from '@collectiq/telemetry';

const startTime = Date.now();
try {
  // Your API logic
  await processRequest();

  const latency = Date.now() - startTime;
  await metrics.recordApiLatency('/cards', 'POST', latency);
} catch (error) {
  const latency = Date.now() - startTime;
  await metrics.recordApiLatency('/cards', 'POST', latency);
  throw error;
}
```

### Authentication Failures

```typescript
try {
  validateToken(token);
} catch (error) {
  await metrics.recordAuthFailure('invalid_token');
  throw error;
}
```

### Pricing Source Errors

```typescript
try {
  const comps = await ebayAdapter.fetchComps(query);
} catch (error) {
  await metrics.recordPricingSourceError('ebay', 'api_timeout');
  // Continue with other sources
}
```

### Authenticity Scores

```typescript
const result = await authenticityAgent.analyze(features, cardMeta);
await metrics.recordAuthenticityScore(result.authenticityScore, cardId);
```

### Custom Metrics

```typescript
import { StandardUnit } from '@aws-sdk/client-cloudwatch';

// Emit custom metric
await metrics.putMetric('CustomMetric', 42, StandardUnit.Count, {
  dimension1: 'value1',
  dimension2: 'value2',
});
```

### Available Metric Methods

- `recordApiLatency(endpoint, method, latencyMs)`
- `recordAuthFailure(reason)`
- `recordPricingSourceError(source, errorType)`
- `recordAuthenticityScore(score, cardId)`
- `recordPricingConfidence(confidence, source)`
- `recordStepFunctionExecution(status, durationMs)`
- `recordDynamoDBOperation(operation, latencyMs)`
- `recordS3Operation(operation, latencyMs)`
- `recordBedrockInvocation(agent, latencyMs, tokenCount?)`
- `recordRekognitionInvocation(operation, latencyMs)`
- `recordCircuitBreakerStateChange(source, state)`
- `recordCacheOperation(operation, cacheType)`

## X-Ray Tracing

X-Ray tracing provides distributed tracing across AWS services and custom business logic.

### Basic Subsegments

```typescript
import { tracing } from '@collectiq/telemetry';

// Start a subsegment
tracing.startSubsegment('business_logic', {
  userId: 'user-123',
  operation: 'process_card',
});

try {
  // Your business logic
  await processCard();

  tracing.endSubsegment('business_logic', { success: true });
} catch (error) {
  tracing.endSubsegment('business_logic', {
    success: false,
    error: error.message,
  });
  throw error;
}
```

### Trace Wrapper (Recommended)

```typescript
import { tracing } from '@collectiq/telemetry';

// Automatically handles start/end and error cases
const result = await tracing.trace(
  'fetch_pricing_data',
  async () => {
    return await pricingService.fetchAllComps(query);
  },
  { userId: 'user-123', cardId: 'card-456' },
);
```

### Annotations and Metadata

```typescript
// Annotations are indexed and searchable in X-Ray console
tracing.addAnnotation('userId', 'user-123');
tracing.addAnnotation('cardType', 'pokemon');
tracing.addAnnotation('authenticated', true);

// Metadata provides additional context (not indexed)
tracing.addMetadata('requestBody', { name: 'Charizard', set: 'Base Set' });
```

### Decorator Pattern

```typescript
import { traced } from '@collectiq/telemetry';

class CardService {
  @traced('create_card', { service: 'card-service' })
  async createCard(userId: string, data: CardData): Promise<Card> {
    // Method automatically traced
    return await this.store.create(userId, data);
  }
}
```

## Complete Lambda Handler Example

```typescript
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { logger, metrics, tracing } from '@collectiq/telemetry';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const requestId = event.requestContext.requestId;
  const startTime = Date.now();

  // Start X-Ray subsegment
  tracing.startSubsegment('my_handler', { requestId });

  try {
    const userId = extractUserId(event);

    // Add searchable annotations
    tracing.addAnnotation('userId', userId);
    tracing.addAnnotation('operation', 'my_operation');

    logger.info('Processing request', {
      operation: 'my_operation',
      userId,
      requestId,
    });

    // Trace business logic
    const result = await tracing.trace('business_logic', () => processRequest(userId), {
      userId,
      requestId,
    });

    logger.info('Request processed successfully', {
      operation: 'my_operation',
      userId,
      requestId,
    });

    // Emit success metrics
    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/my-endpoint', 'POST', latency);

    tracing.endSubsegment('my_handler', { success: true });

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Request failed', error, {
      operation: 'my_operation',
      requestId,
    });

    // Emit error metrics
    const latency = Date.now() - startTime;
    await metrics.recordApiLatency('/my-endpoint', 'POST', latency);

    tracing.endSubsegment('my_handler', {
      success: false,
      error: error.message,
    });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
```

## Environment Variables

### Logger

- `LOG_LEVEL`: Set to `DEBUG`, `INFO`, `WARN`, or `ERROR` (default: `INFO`)

### Metrics

- `AWS_REGION`: AWS region for CloudWatch (default: `us-east-1`)
- `STAGE`: Deployment stage for metric namespace (default: `dev`)

### Tracing

- `XRAY_ENABLED`: Set to `false` to disable tracing (default: enabled)

## CloudWatch Dashboard

Metrics are emitted to the namespace `CollectIQ/{stage}` with the following metric names:

- `ApiLatency` (Milliseconds) - Dimensions: endpoint, method
- `AuthFailures` (Count) - Dimensions: reason
- `PricingSourceErrors` (Count) - Dimensions: source, errorType
- `AuthenticityScore` (None) - Dimensions: cardId, scoreRange
- `PricingConfidence` (None) - Dimensions: source
- `StepFunctionsExecutions` (Count) - Dimensions: status
- `StepFunctionsDuration` (Milliseconds) - Dimensions: status
- `DynamoDBLatency` (Milliseconds) - Dimensions: operation
- `S3Latency` (Milliseconds) - Dimensions: operation
- `BedrockLatency` (Milliseconds) - Dimensions: agent
- `BedrockTokens` (Count) - Dimensions: agent
- `RekognitionLatency` (Milliseconds) - Dimensions: operation
- `CircuitBreakerStateChange` (Count) - Dimensions: source, state
- `CacheOperations` (Count) - Dimensions: operation, cacheType

## Best Practices

1. **Always log with context**: Include `requestId`, `userId`, and `operation` in all logs
2. **Emit metrics asynchronously**: Don't block on metric emission failures
3. **Use trace wrappers**: Prefer `tracing.trace()` over manual start/end
4. **Add meaningful annotations**: Use annotations for searchable dimensions
5. **Don't log PII**: The logger filters common PII fields, but be cautious
6. **Emit metrics for both success and failure**: Track latency in both paths
7. **Use appropriate log levels**: Reserve ERROR for actual errors, not expected conditions
8. **Keep subsegment names consistent**: Use the same names across invocations for aggregation
