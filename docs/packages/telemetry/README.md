# @collectiq/telemetry

Logging and metrics utilities for CollectIQ services.

## Features

- **Structured JSON Logger**: Consistent logging format with requestId, userId, and operation context
- **CloudWatch Metrics**: Custom metrics emission for API latency, errors, and business metrics
- **PII Protection**: Ensures no personally identifiable information is logged
- **Log Level Filtering**: DEBUG, INFO, WARN, ERROR levels with environment-based configuration

## Usage

### Logger

```typescript
import { logger } from '@collectiq/telemetry';

// Basic logging
logger.info('Card created successfully', {
  requestId: 'req-123',
  userId: 'user-456',
  operation: 'cards_create',
});

// Error logging
logger.error('Failed to fetch pricing data', error, {
  requestId: 'req-123',
  operation: 'pricing_fetch',
});
```

### Metrics

```typescript
import { metrics } from '@collectiq/telemetry';

// Emit custom metric
await metrics.putMetric('ApiLatency', 250, 'Milliseconds', {
  endpoint: '/cards',
  method: 'POST',
});

// Emit authenticity score
await metrics.putMetric('AuthenticityScore', 0.92, 'None', {
  cardId: 'card-123',
});
```
