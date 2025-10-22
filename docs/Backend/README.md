# CollectIQ Backend

Serverless AWS-based backend for CollectIQ - AI-powered Pokémon TCG card identification, authentication, and valuation platform.

## Documentation

- **[Environment Variables](./ENVIRONMENT_VARIABLES.md)**: Complete list of required environment variables, secrets management approach, and configuration examples
- **[IAM Requirements](./IAM_REQUIREMENTS.md)**: Detailed IAM permissions for each Lambda function, following least-privilege principles
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)**: Step-by-step deployment instructions, build process, Terraform integration, and troubleshooting
- **[OCR Reasoning Troubleshooting](./OCR_REASONING_TROUBLESHOOTING.md)**: Comprehensive troubleshooting guide for Bedrock OCR reasoning issues
- **[Card Metadata API](./API_CARD_METADATA.md)**: Complete API documentation for CardMetadata schema with usage examples

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

## AI Pipeline Architecture

CollectIQ uses a multi-agent AI pipeline orchestrated by AWS Step Functions:

```
Card Upload → Rekognition Extract → OCR Reasoning Agent → [Pricing Agent, Authenticity Agent] → Aggregator
```

### OCR Reasoning Agent

The OCR Reasoning Agent uses Amazon Bedrock (Claude Sonnet 4.0) to intelligently interpret raw OCR outputs from AWS Rekognition. This agent corrects OCR errors, infers missing metadata, and provides confidence-scored structured outputs.

**Key Features:**

- **Error Correction**: Fixes OCR mistakes using fuzzy matching (e.g., "Yenusaur" → "Venusaur")
- **Metadata Inference**: Extracts card name, rarity, set, collector number, illustrator, and copyright
- **Confidence Scoring**: Provides 0.0-1.0 confidence scores for each extracted field
- **Multi-Candidate Support**: Returns multiple candidates when metadata is ambiguous
- **Fallback Logic**: Gracefully handles Bedrock failures with reduced-confidence fallback

**Location**: `src/agents/ocr-reasoning-agent.ts`

**Input**:

```typescript
interface OcrReasoningAgentInput {
  userId: string;
  cardId: string;
  features: FeatureEnvelope; // From Rekognition Extract
  requestId: string;
}
```

**Output**:

```typescript
interface CardMetadata {
  name: FieldResult<string>;
  rarity: FieldResult<string>;
  set: FieldResult<string> | MultiCandidateResult<string>;
  setSymbol: FieldResult<string>;
  collectorNumber: FieldResult<string>;
  copyrightRun: FieldResult<string>;
  illustrator: FieldResult<string>;
  overallConfidence: number;
  reasoningTrail: string;
}
```

**Configuration**:

```bash
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
BEDROCK_MAX_TOKENS=4096
BEDROCK_TEMPERATURE=0.15
BEDROCK_MAX_RETRIES=3
```

**Example Output**:

```json
{
  "name": {
    "value": "Venusaur",
    "confidence": 0.92,
    "rationale": "Corrected OCR text 'Yenusaur' to 'Venusaur' using fuzzy matching"
  },
  "rarity": {
    "value": "Holo Rare",
    "confidence": 0.88,
    "rationale": "Inferred from holographic variance (85%) and card template"
  },
  "set": {
    "value": "Base Set",
    "candidates": [
      { "value": "Base Set", "confidence": 0.85 },
      { "value": "Base Set 2", "confidence": 0.45 }
    ],
    "rationale": "Copyright text '©1999 Wizards' indicates WOTC era, likely Base Set"
  },
  "collectorNumber": {
    "value": "15/102",
    "confidence": 0.95,
    "rationale": "Extracted from bottom-right text pattern"
  },
  "illustrator": {
    "value": "Mitsuhiro Arita",
    "confidence": 0.9,
    "rationale": "Extracted from 'Illus. Mitsuhiro Arita' text"
  },
  "overallConfidence": 0.88,
  "reasoningTrail": "High-quality OCR with clear text. Applied fuzzy matching for name correction. Inferred rarity from visual features."
}
```

### Bedrock OCR Reasoning Service

**Location**: `src/adapters/bedrock-ocr-reasoning.ts`

Encapsulates Bedrock API calls for OCR interpretation with retry logic and error handling.

**Key Methods**:

- `interpretOcr(context)`: Main entry point for OCR reasoning
- `createSystemPrompt()`: Generates expert system prompt for Claude
- `createUserPrompt(context)`: Formats OCR blocks and visual context
- `parseResponse(response)`: Validates and parses Bedrock JSON response
- `invokeWithRetry()`: Handles retries with exponential backoff

**Retry Strategy**:

- Up to 3 attempts with exponential backoff (1s, 2s, 4s)
- Handles throttling, timeouts, and transient errors
- Falls back to basic OCR extraction after max retries

### Fuzzy Matching Utility

**Location**: `src/utils/fuzzy-matching.ts`

Provides Levenshtein distance calculation for OCR error correction.

```typescript
import {
  levenshteinDistance,
  findBestMatch,
  normalizeForComparison,
} from './utils/fuzzy-matching.js';

// Calculate edit distance
const distance = levenshteinDistance('Yenusaur', 'Venusaur'); // 1

// Find best match from candidates
const match = findBestMatch('Yenusaur', ['Venusaur', 'Ivysaur', 'Bulbasaur'], 0.7);
// { match: 'Venusaur', confidence: 0.89 }

// Normalize for comparison
const normalized = normalizeForComparison('  Pikachu! '); // 'pikachu'
```

### Pokémon TCG Knowledge Base

**Location**: `src/utils/pokemon-knowledge.ts`

Reference data for validation and fallback logic:

```typescript
import { POKEMON_SETS, RARITY_PATTERNS, COPYRIGHT_PATTERNS } from './utils/pokemon-knowledge.js';

// Check if set exists
const isValidSet = POKEMON_SETS['Base Set'] !== undefined;

// Match rarity patterns
const rarityIndicators = RARITY_PATTERNS['Holo Rare']; // ['holographic', 'holo', 'shiny']

// Identify era from copyright
const isWOTC = COPYRIGHT_PATTERNS['WOTC Era (1999-2003)'].test(copyrightText);
```

### Monitoring and Observability

**CloudWatch Metrics**:

- `BedrockOcrInvocation.Latency`: Response time in milliseconds
- `BedrockOcrInvocation.InputTokens`: Tokens sent to Bedrock
- `BedrockOcrInvocation.OutputTokens`: Tokens received from Bedrock
- `BedrockOcrInvocation.OverallConfidence`: Average confidence score
- `BedrockOcrInvocation.FallbackUsed`: Boolean indicating fallback activation

**CloudWatch Alarms**:

- High fallback rate (>10%)
- High latency (P95 >5 seconds)
- Low confidence scores (average <0.6)
- High token usage (average >3000 output tokens)

**Logs**:

```typescript
// INFO: OCR reasoning started
logger.info('OCR reasoning started', { cardId, ocrBlockCount });

// INFO: Bedrock response received
logger.info('Bedrock response received', { latency, tokenCount, overallConfidence });

// WARN: Fallback activated
logger.warn('Fallback metadata used', { reason: error.message });

// ERROR: OCR reasoning failed
logger.error('OCR reasoning failed', error, { cardId, retryCount });
```

### Troubleshooting

#### Issue: Low Confidence Scores

**Symptoms**: `overallConfidence < 0.6` consistently

**Possible Causes**:

- Poor image quality (blurry, glare, low resolution)
- Unusual card layout (foreign language, promotional cards)
- OCR errors not correctable by fuzzy matching

**Solutions**:

1. Check image quality metrics in `FeatureEnvelope.imageQuality`
2. Review `reasoningTrail` for specific issues
3. Verify OCR blocks contain expected text patterns
4. Consider manual review for confidence <0.5

#### Issue: High Fallback Rate

**Symptoms**: `FallbackUsed` metric >10%

**Possible Causes**:

- Bedrock throttling (exceeded quota)
- Network timeouts
- Invalid JSON responses from Bedrock

**Solutions**:

1. Check CloudWatch logs for error patterns
2. Verify Bedrock service quotas in AWS Console
3. Review IAM permissions for `bedrock:InvokeModel`
4. Increase Lambda timeout if needed (current: 30s)

#### Issue: Incorrect Name Extraction

**Symptoms**: Card name doesn't match expected value

**Possible Causes**:

- OCR misread card name
- Fuzzy matching threshold too low
- Card name not in Claude's knowledge base

**Solutions**:

1. Review OCR blocks in `FeatureEnvelope.ocrBlocks`
2. Check `name.rationale` for correction details
3. Verify `name.confidence` score
4. Consider adding custom name mappings for edge cases

#### Issue: Ambiguous Set Detection

**Symptoms**: Multiple set candidates with similar confidence

**Possible Causes**:

- Copyright text unclear or damaged
- Set symbol not visible in image
- Card from reprint set

**Solutions**:

1. Review `set.candidates` array for all possibilities
2. Check `set.rationale` for reasoning
3. Use collector number to disambiguate if available
4. Consider user feedback to improve future extractions

#### Issue: Bedrock Invocation Timeout

**Symptoms**: Lambda timeout after 30 seconds

**Possible Causes**:

- Large OCR block count (>100 blocks)
- Bedrock service latency spike
- Network issues

**Solutions**:

1. Check `ocrBlockCount` in logs
2. Filter OCR blocks by confidence before sending to Bedrock
3. Increase Lambda timeout to 60s if needed
4. Review Bedrock service health in AWS Console

### Performance Optimization

**Latency Targets**:

- Rekognition OCR: ~1-2 seconds
- Bedrock Reasoning: ~2-3 seconds
- Total OCR Pipeline: <5 seconds (95th percentile)

**Cost Optimization**:

- Input tokens: ~1500 per card
- Output tokens: ~800 per card
- Cost per card: ~$0.016
- Monthly cost (10,000 cards): ~$160

**Optimization Strategies**:

1. **Prompt Optimization**: Keep prompts concise (<2000 tokens)
2. **Response Caching**: Cache Bedrock responses by OCR text hash (7-day TTL)
3. **Parallel Processing**: Run Pricing and Authenticity agents in parallel
4. **Token Management**: Monitor token usage and adjust `max_tokens` if needed

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
# AWS Configuration
AWS_REGION=us-east-1

# DynamoDB
DDB_TABLE={stage}-CollectIQ
CARD_ID_INDEX_NAME=CardIdIndex # optional GSI for cardId lookups; falls back to scan if unset

# S3 Storage
BUCKET_UPLOADS={stage}-collectiq-uploads-{accountId}
ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic
MAX_UPLOAD_MB=12

# Cognito Authentication
COGNITO_USER_POOL_ID={poolId}
COGNITO_CLIENT_ID={clientId}

# Caching and Idempotency
CACHE_TTL_SECONDS=300
IDEMPOTENCY_TTL_SECONDS=600

# Bedrock OCR Reasoning (Claude Sonnet 4.0)
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
BEDROCK_MAX_TOKENS=4096          # Maximum tokens for Bedrock response
BEDROCK_TEMPERATURE=0.15         # Low temperature for deterministic outputs
BEDROCK_MAX_RETRIES=3            # Maximum retry attempts for Bedrock invocations
BEDROCK_RETRY_DELAY_MS=1000      # Initial retry delay in milliseconds
```

**Bedrock Configuration Details**:

- `BEDROCK_MODEL_ID`: Claude Sonnet 4.0 model identifier. Do not change unless upgrading to a newer model version.
- `BEDROCK_MAX_TOKENS`: Controls the maximum length of Bedrock responses. 4096 is sufficient for detailed reasoning with rationales.
- `BEDROCK_TEMPERATURE`: Controls randomness in responses. 0.15 provides deterministic outputs while allowing some flexibility.
- `BEDROCK_MAX_RETRIES`: Number of retry attempts for transient errors (throttling, timeouts). Recommended: 3.
- `BEDROCK_RETRY_DELAY_MS`: Initial delay before first retry. Uses exponential backoff (1s, 2s, 4s).

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

## Operations & Infrastructure

Complete operations documentation for deployment, monitoring, and cost management:

- **[Operations Overview](./operations/)**: Infrastructure, deployment, monitoring, and troubleshooting
- **[Operations Specification](./operations/Operations-Specification.md)**: Complete operations architecture and procedures
- **[AWS Cost Model & Optimization](./operations/AWS-Cost-Model-Optimization.md)**: Cost analysis and optimization strategies

See also:

- [Infrastructure Documentation](../infrastructure/README.md) - Terraform modules and deployment
- [Configuration Reference](../configuration/README.md) - Environment variables
