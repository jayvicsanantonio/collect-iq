# Environment Variables

This document lists all required environment variables for the CollectIQ backend Lambda functions.

## Core AWS Configuration

### AWS_REGION

- **Required**: Yes
- **Description**: AWS region where resources are deployed
- **Example**: `us-east-1`
- **Used by**: All Lambda functions

## DynamoDB Configuration

### DDB_TABLE

- **Required**: Yes
- **Description**: Name of the DynamoDB table for card and pricing data
- **Example**: `dev-CollectIQ`, `prod-CollectIQ`
- **Used by**: All handlers, store layer, orchestration functions
- **Format**: `{stage}-CollectIQ`

## S3 Configuration

### BUCKET_UPLOADS

- **Required**: Yes
- **Description**: S3 bucket name for card image uploads
- **Example**: `dev-collectiq-uploads-123456789012`
- **Used by**: upload_presign handler, rekognition_extract, authenticity_agent
- **Format**: `{stage}-collectiq-uploads-{accountId}`

### BUCKET_AUTHENTIC_SAMPLES

- **Required**: Yes (for authenticity agent)
- **Description**: S3 bucket containing reference hashes for authentic cards
- **Example**: `prod-collectiq-authentic-samples`
- **Used by**: authenticity_agent
- **Format**: `{stage}-collectiq-authentic-samples`

## Authentication Configuration

### COGNITO_USER_POOL_ID

- **Required**: Yes
- **Description**: Cognito User Pool ID for JWT validation
- **Example**: `us-east-1_AbCdEfGhI`
- **Used by**: API Gateway authorizer configuration
- **Format**: `{region}_{alphanumeric}`

### COGNITO_CLIENT_ID

- **Required**: Yes
- **Description**: Cognito App Client ID
- **Example**: `1a2b3c4d5e6f7g8h9i0j1k2l3m`
- **Used by**: Frontend authentication flow
- **Format**: 26-character alphanumeric string

### JWKS_URL

- **Required**: Yes
- **Description**: JSON Web Key Set URL for JWT signature verification
- **Example**: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_AbCdEfGhI/.well-known/jwks.json`
- **Used by**: API Gateway JWT authorizer
- **Format**: `https://cognito-idp.{region}.amazonaws.com/{userPoolId}/.well-known/jwks.json`

## Upload Configuration

### ALLOWED_UPLOAD_MIME

- **Required**: Yes
- **Description**: Comma-separated list of allowed MIME types for uploads
- **Example**: `image/jpeg,image/png,image/heic`
- **Used by**: upload_presign handler
- **Default**: `image/jpeg,image/png,image/heic`

### MAX_UPLOAD_MB

- **Required**: Yes
- **Description**: Maximum file size in megabytes for uploads
- **Example**: `12`
- **Used by**: upload_presign handler
- **Default**: `12`

## Pricing API Configuration

### EBAY_APP_ID

- **Required**: Yes (for pricing)
- **Description**: eBay API Application ID
- **Example**: `{{resolve:secretsmanager:ebay-api-key}}`
- **Used by**: ebay_adapter
- **Secret**: Store in AWS Secrets Manager
- **Secret Name**: `{stage}/collectiq/ebay-api-key`

### TCGPLAYER_PUBLIC_KEY

- **Required**: Yes (for pricing)
- **Description**: TCGPlayer API public key
- **Example**: `{{resolve:secretsmanager:tcgplayer-public}}`
- **Used by**: tcgplayer_adapter
- **Secret**: Store in AWS Secrets Manager
- **Secret Name**: `{stage}/collectiq/tcgplayer-public-key`

### TCGPLAYER_PRIVATE_KEY

- **Required**: Yes (for pricing)
- **Description**: TCGPlayer API private key
- **Example**: `{{resolve:secretsmanager:tcgplayer-private}}`
- **Used by**: tcgplayer_adapter
- **Secret**: Store in AWS Secrets Manager
- **Secret Name**: `{stage}/collectiq/tcgplayer-private-key`

### PRICECHARTING_KEY

- **Required**: Yes (for pricing)
- **Description**: PriceCharting API key
- **Example**: `{{resolve:secretsmanager:pricecharting-key}}`
- **Used by**: pricecharting_adapter
- **Secret**: Store in AWS Secrets Manager
- **Secret Name**: `{stage}/collectiq/pricecharting-api-key`

## Caching Configuration

### CACHE_TTL_SECONDS

- **Required**: No
- **Description**: Time-to-live for pricing cache in seconds
- **Example**: `300`
- **Used by**: pricing_cache, pricing_service
- **Default**: `300` (5 minutes)

### IDEMPOTENCY_TTL_SECONDS

- **Required**: No
- **Description**: Time-to-live for idempotency tokens in seconds
- **Example**: `600`
- **Used by**: idempotency middleware
- **Default**: `600` (10 minutes)

## Step Functions Configuration

### STEP_FUNCTIONS_ARN

- **Required**: Yes (for revalue handler)
- **Description**: ARN of the Step Functions state machine for card revaluation
- **Example**: `arn:aws:states:us-east-1:123456789012:stateMachine:dev-collectiq-revalue`
- **Used by**: cards_revalue handler
- **Format**: `arn:aws:states:{region}:{accountId}:stateMachine:{stage}-collectiq-revalue`

## EventBridge Configuration

### EVENT_BUS_NAME

- **Required**: Yes (for aggregator)
- **Description**: Name of the EventBridge event bus for card events
- **Example**: `dev-collectiq-events`
- **Used by**: aggregator
- **Format**: `{stage}-collectiq-events`

## Bedrock Configuration

### BEDROCK_MODEL_ID

- **Required**: Yes (for AI agents)
- **Description**: Amazon Bedrock model identifier
- **Example**: `anthropic.claude-3-sonnet-20240229-v1:0`
- **Used by**: bedrock_service, pricing_agent, authenticity_agent
- **Recommended**: `anthropic.claude-3-sonnet-20240229-v1:0` or `anthropic.claude-4-sonnet-20250514-v1:0`

### BEDROCK_MAX_TOKENS

- **Required**: No
- **Description**: Maximum tokens for Bedrock responses
- **Example**: `2048`
- **Used by**: bedrock_service
- **Default**: `2048`

### BEDROCK_TEMPERATURE

- **Required**: No
- **Description**: Temperature parameter for Bedrock model (0.0-1.0)
- **Example**: `0.2`
- **Used by**: bedrock_service
- **Default**: `0.2` (for consistency)

## Observability Configuration

### LOG_LEVEL

- **Required**: No
- **Description**: Logging level (DEBUG, INFO, WARN, ERROR)
- **Example**: `INFO`
- **Used by**: logger utility
- **Default**: `INFO`

### POWERTOOLS_SERVICE_NAME

- **Required**: No
- **Description**: Service name for AWS Lambda Powertools
- **Example**: `collectiq-backend`
- **Used by**: All Lambda functions (if using Powertools)
- **Default**: `collectiq-backend`

## Secrets Management Approach

### Overview

CollectIQ uses AWS Secrets Manager for storing sensitive API keys and credentials. Secrets are retrieved at runtime by Lambda functions using the `secrets.ts` utility, which implements in-memory caching for the duration of the Lambda execution context.

### Secret Naming Convention

All secrets follow the pattern: `{stage}/collectiq/{service}-{key-type}`

Examples:

- `dev/collectiq/ebay-api-key`
- `prod/collectiq/tcgplayer-public-key`
- `prod/collectiq/tcgplayer-private-key`
- `prod/collectiq/pricecharting-api-key`

### Secret Rotation

- **Automatic Rotation**: Enabled for all API keys with 90-day rotation period
- **Rotation Lambda**: Separate Lambda function handles rotation for each service
- **Zero-Downtime**: Secrets Manager supports both current and previous versions during rotation

### Accessing Secrets in Lambda

Secrets are accessed using the `getSecret()` function from `src/utils/secrets.ts`:

```typescript
import { getSecret } from '../utils/secrets';

// Retrieve secret (cached for Lambda execution lifetime)
const ebayAppId = await getSecret('ebay-api-key');
```

### Environment Variable Resolution

Terraform can inject secrets directly into Lambda environment variables using the `{{resolve:secretsmanager:...}}` syntax:

```hcl
environment {
  variables = {
    EBAY_APP_ID = "{{resolve:secretsmanager:${var.stage}/collectiq/ebay-api-key}}"
  }
}
```

However, for better security and rotation support, we recommend runtime retrieval using the secrets utility.

### IAM Permissions

Lambda execution roles must include permissions to read secrets:

```json
{
  "Effect": "Allow",
  "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
  "Resource": ["arn:aws:secretsmanager:${region}:${account}:secret:${stage}/collectiq/*"]
}
```

## Environment-Specific Configuration

### Development (dev)

```bash
AWS_REGION=us-east-1
DDB_TABLE=dev-CollectIQ
BUCKET_UPLOADS=dev-collectiq-uploads-123456789012
BUCKET_AUTHENTIC_SAMPLES=dev-collectiq-authentic-samples
COGNITO_USER_POOL_ID=us-east-1_DevPoolId
COGNITO_CLIENT_ID=devclientid123456789012
JWKS_URL=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_DevPoolId/.well-known/jwks.json
ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic
MAX_UPLOAD_MB=12
CACHE_TTL_SECONDS=300
IDEMPOTENCY_TTL_SECONDS=600
STEP_FUNCTIONS_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:dev-collectiq-revalue
EVENT_BUS_NAME=dev-collectiq-events
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_MAX_TOKENS=2048
BEDROCK_TEMPERATURE=0.2
LOG_LEVEL=DEBUG
```

### Production (prod)

```bash
AWS_REGION=us-east-1
DDB_TABLE=prod-CollectIQ
BUCKET_UPLOADS=prod-collectiq-uploads-123456789012
BUCKET_AUTHENTIC_SAMPLES=prod-collectiq-authentic-samples
COGNITO_USER_POOL_ID=us-east-1_ProdPoolId
COGNITO_CLIENT_ID=prodclientid123456789012
JWKS_URL=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ProdPoolId/.well-known/jwks.json
ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic
MAX_UPLOAD_MB=12
CACHE_TTL_SECONDS=300
IDEMPOTENCY_TTL_SECONDS=600
STEP_FUNCTIONS_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:prod-collectiq-revalue
EVENT_BUS_NAME=prod-collectiq-events
BEDROCK_MODEL_ID=anthropic.claude-4-sonnet-20250514-v1:0
BEDROCK_MAX_TOKENS=2048
BEDROCK_TEMPERATURE=0.2
LOG_LEVEL=INFO
```

## Validation

Before deploying, validate that all required environment variables are set:

```bash
# Check required variables
required_vars=(
  "AWS_REGION"
  "DDB_TABLE"
  "BUCKET_UPLOADS"
  "COGNITO_USER_POOL_ID"
  "COGNITO_CLIENT_ID"
  "JWKS_URL"
  "STEP_FUNCTIONS_ARN"
  "EVENT_BUS_NAME"
  "BEDROCK_MODEL_ID"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: $var is not set"
    exit 1
  fi
done

echo "All required environment variables are set"
```

## Troubleshooting

### Secret Not Found

**Error**: `ResourceNotFoundException: Secrets Manager can't find the specified secret`

**Solution**: Ensure the secret exists in Secrets Manager with the correct name pattern:

```bash
aws secretsmanager create-secret \
  --name dev/collectiq/ebay-api-key \
  --secret-string "your-api-key-here" \
  --region us-east-1
```

### Permission Denied

**Error**: `AccessDeniedException: User is not authorized to perform: secretsmanager:GetSecretValue`

**Solution**: Add the required IAM permissions to the Lambda execution role (see IAM Requirements document).

### Invalid JWT

**Error**: `401 Unauthorized: Invalid or expired JWT token`

**Solution**: Verify that `JWKS_URL` matches your Cognito User Pool configuration and that the JWT is not expired.
