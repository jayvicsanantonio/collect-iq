# CollectIQ Backend

Serverless AWS-based backend for CollectIQ - AI-powered Pokémon TCG card identification, authentication, and valuation platform.

## Documentation

- **[Environment Variables](./ENVIRONMENT_VARIABLES.md)**: Complete list of required environment variables, secrets management approach, and configuration examples
- **[IAM Requirements](./IAM_REQUIREMENTS.md)**: Detailed IAM permissions for each Lambda function, following least-privilege principles
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)**: Step-by-step deployment instructions, build process, Terraform integration, and troubleshooting

## Project Structure

```
services/backend/
├── src/
│   ├── handlers/          # API Gateway Lambda handlers
│   ├── agents/            # AI agent Lambda functions
│   ├── orchestration/     # Step Functions task handlers
│   ├── adapters/          # External service integrations
│   ├── store/             # DynamoDB data access layer
│   ├── auth/              # Authentication and authorization
│   ├── utils/             # Shared utilities
│   └── tests/             # Test files
├── esbuild.mjs            # Lambda bundling configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

## Technology Stack

- **Runtime**: Node.js 20 (AWS Lambda)
- **Language**: TypeScript 5.x (non-strict mode)
- **Build**: esbuild with tree-shaking
- **Validation**: Zod schemas
- **AWS Services**: Lambda, Step Functions, DynamoDB, S3, Rekognition, Bedrock, EventBridge

## Available Scripts

```bash
# Build Lambda functions
pnpm build

# Build for production (minified)
pnpm build:prod

# Type checking
pnpm typecheck

# Run unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run E2E tests in watch mode
pnpm test:e2e:watch

# Lint code
pnpm lint

# Clean build artifacts
pnpm clean
```

## Shared Utilities

### Logger (`src/utils/logger.ts`)

Structured JSON logger for CloudWatch integration:

```typescript
import { logger } from './utils/logger.js';

logger.info('Processing card', { cardId, userId });
logger.error('Failed to fetch pricing', error, { source: 'eBay' });
```

### Error Handling (`src/utils/errors.ts`)

RFC 7807 Problem Details for standardized error responses:

```typescript
import { BadRequestError, NotFoundError, formatErrorResponse } from './utils/errors.js';

throw new BadRequestError('Invalid card ID', '/api/cards/123');
throw new NotFoundError('Card not found');

// Format for API Gateway response
return formatErrorResponse(error, requestId);
```

### Validation (`src/utils/validation.ts`)

Zod-based validation helpers:

```typescript
import { validate, sanitizeFilename, getEnvVar } from './utils/validation.js';
import { CardSchema } from '@collectiq/shared';

const card = validate(CardSchema, data);
const cleanName = sanitizeFilename(filename);
const tableName = getEnvVar('DDB_TABLE');
```

## Shared Schemas

Common types and Zod schemas are defined in `packages/shared` and can be imported:

```typescript
import { Card, CardSchema, PricingResult, AuthContext, FeatureEnvelope } from '@collectiq/shared';
```

## Authentication

- API Gateway JWT authorizers should validate Cognito **access tokens** produced by the Hosted UI; the backend derives the authenticated user from those claims.
- Cognito access tokens do not always include an `email` claim, so `AuthContext.email` is optional. When present, the backend also exposes `AuthContext.username` (typically `cognito:username`) for auditing.
- Downstream handlers should guard on the presence of `authContext.email` instead of assuming it is defined.

## Environment Variables

Required environment variables for Lambda functions:

```bash
AWS_REGION=us-east-1
DDB_TABLE={stage}-CollectIQ
BUCKET_UPLOADS={stage}-collectiq-uploads-{accountId}
COGNITO_USER_POOL_ID={poolId}
COGNITO_CLIENT_ID={clientId}
ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic
MAX_UPLOAD_MB=12
CACHE_TTL_SECONDS=300
IDEMPOTENCY_TTL_SECONDS=600
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
CARD_ID_INDEX_NAME=CardIdIndex # optional GSI for cardId lookups; falls back to scan if unset
```

## Development Workflow

1. Create handler/agent/orchestration function in appropriate directory
2. Import shared utilities and schemas
3. Implement business logic
4. Add tests in `src/tests/`
5. Run `pnpm typecheck` to verify types
6. Run `pnpm test` to verify functionality
7. Build with `pnpm build`

## Lambda Bundling

The `esbuild.mjs` configuration:

- Bundles all handlers, agents, and orchestration functions
- Enables tree-shaking for minimal bundle size
- Externalizes AWS SDK (provided by Lambda runtime)
- Generates sourcemaps for debugging
- Outputs ESM format (`.mjs`)

## Testing

### Unit Tests

Unit tests use Vitest with AWS SDK mocks. Example:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { logger } from '../utils/logger.js';

describe('Logger', () => {
  it('should log structured JSON', () => {
    const spy = vi.spyOn(console, 'log');
    logger.info('test message', { key: 'value' });
    expect(spy).toHaveBeenCalled();
  });
});
```

### End-to-End Tests

E2E tests validate complete workflows against real AWS services in a test environment.

**Setup**: See [E2E_TEST_SETUP.md](./E2E_TEST_SETUP.md) for detailed setup instructions.

**Quick Start**:

1. Copy `.env.test.example` to `.env.test`
2. Fill in your test environment configuration
3. Run `pnpm test:e2e`

**Documentation**: See [src/tests/e2e/README.md](./src/tests/e2e/README.md) for detailed E2E test documentation.

## Next Steps

Refer to `.kiro/specs/collectiq-backend/tasks.md` for implementation tasks.
