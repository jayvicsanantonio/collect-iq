# CollectIQ Configuration Reference

## Overview

This document describes all environment variables and configuration options for CollectIQ services. Configuration is managed through environment variables for flexibility across deployment environments (local, hackathon, production).

---

## Backend Configuration

### Upload Service

#### Size & Type Constraints

```bash
# Maximum upload size in megabytes
MAX_UPLOAD_MB=12
# Default: 12
# Range: 1-50 (AWS Lambda payload limit is 6 MB synchronous, 256 KB async; S3 direct upload recommended)
# Description: Hard limit for card image uploads. Automatically converted to bytes (MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024)

# Allowed MIME types (comma-separated)
ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic
# Default: image/jpeg,image/png,image/heic
# Description: Strict allowlist enforced at presign and ingestion layers

# Presigned URL expiration
PRESIGN_TTL_SECONDS=300
# Default: 300 (5 minutes)
# Range: 60-3600
# Description: Time window for client to complete upload using presigned URL
```

#### AWS Resources

```bash
# S3 upload bucket
UPLOAD_BUCKET=collectiq-uploads-hackathon
# Description: Bucket for user-uploaded card images

# S3 key prefix for uploads
UPLOAD_KEY_PREFIX=uploads/
# Description: Prefix for all upload keys (pattern: uploads/{userId}/{uuid})

# S3 quarantine bucket (optional, future)
QUARANTINE_BUCKET=collectiq-quarantine-hackathon
# Description: Bucket for files flagged by AV scan or policy violations
```

### Database

```bash
# DynamoDB table name
TABLE_NAME=collectiq-hackathon
# Description: Single-table design for all entities (users, cards, prices, uploads)

# DynamoDB GSI names
GSI_USER_ID=GSI1
GSI_SET_RARITY=GSI2
# Description: Global secondary indexes for vault queries and analytics
```

### Authentication

```bash
# Cognito User Pool
COGNITO_USER_POOL_ID=us-east-1_ABC123DEF
COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
COGNITO_DOMAIN=collectiq-hackathon.auth.us-east-1.amazoncognito.com

# JWT validation
JWT_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123DEF
JWT_AUDIENCE=1a2b3c4d5e6f7g8h9i0j
```

### AI Services

```bash
# Amazon Bedrock
BEDROCK_MODEL_ID=anthropic.claude-4-sonnet-20250514
BEDROCK_REGION=us-east-1
# Description: Claude 4.0 Sonnet for valuation and authenticity agents

# Amazon Rekognition
REKOGNITION_REGION=us-east-1
# Description: Computer vision for feature extraction
```

### Orchestration

```bash
# Step Functions
INGESTION_STATE_MACHINE_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:collectiq-ingestion
VALUATION_STATE_MACHINE_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:collectiq-valuation

# EventBridge
EVENT_BUS_NAME=collectiq-events-hackathon
# Description: Custom event bus for inter-service communication
```

### Observability

```bash
# CloudWatch
CLOUDWATCH_NAMESPACE=CollectIQ/Uploads
LOG_LEVEL=INFO
# Options: DEBUG, INFO, WARN, ERROR
# Description: Structured logging level (AWS Lambda Powertools)

# X-Ray
XRAY_ENABLED=true
# Description: Distributed tracing for request flows
```

### External APIs

```bash
# TCGPlayer API
TCGPLAYER_API_KEY=your-api-key-here
TCGPLAYER_BASE_URL=https://api.tcgplayer.com/v1

# eBay API
EBAY_APP_ID=your-app-id-here
EBAY_CERT_ID=your-cert-id-here
EBAY_BASE_URL=https://api.ebay.com/buy/browse/v1

# PriceCharting API
PRICECHARTING_API_KEY=your-api-key-here
PRICECHARTING_BASE_URL=https://www.pricecharting.com/api
```

---

## Frontend Configuration

### Next.js Environment Variables

#### Public Variables (Exposed to Browser)

```bash
# API Gateway endpoint
NEXT_PUBLIC_API_URL=https://api.collectiq.com
# Description: Backend API base URL

# Cognito configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_ABC123DEF
NEXT_PUBLIC_COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
NEXT_PUBLIC_COGNITO_DOMAIN=collectiq-hackathon.auth.us-east-1.amazoncognito.com
NEXT_PUBLIC_COGNITO_REDIRECT_URI=https://collectiq.com/auth/callback

# Upload constraints (synced from backend /config endpoint)
NEXT_PUBLIC_MAX_UPLOAD_MB=12
NEXT_PUBLIC_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/heic
```

#### Server-Side Variables

```bash
# Session secret
SESSION_SECRET=your-secret-key-here
# Description: Used for encrypting session cookies (generate with `openssl rand -base64 32`)

# Feature flags
FEATURE_HEIC_SUPPORT=true
FEATURE_CLIENT_COMPRESSION=true
FEATURE_BULK_UPLOAD=false
# Description: Toggle features without code changes
```

### SWR Configuration

```typescript
// apps/web/lib/swr-config.ts
export const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  fetcher: (url: string) => fetch(url).then((res) => res.json()),
};
```

---

## Infrastructure Configuration

### Terraform Variables

```hcl
# infra/terraform/envs/hackathon/terraform.tfvars

# Environment
environment = "hackathon"
aws_region  = "us-east-1"

# Upload constraints
max_upload_mb         = 12
allowed_upload_mimes  = ["image/jpeg", "image/png", "image/heic"]
presign_ttl_seconds   = 300

# DynamoDB
dynamodb_billing_mode = "PAY_PER_REQUEST"
dynamodb_point_in_time_recovery = true

# Lambda
lambda_runtime        = "nodejs20.x"
lambda_memory_size    = 1024
lambda_timeout        = 30

# Cognito
cognito_password_policy = {
  minimum_length    = 12
  require_lowercase = true
  require_uppercase = true
  require_numbers   = true
  require_symbols   = true
}

# S3 lifecycle
upload_expiration_days = 1  # Delete unprocessed uploads after 24h

# Monitoring
enable_xray           = true
log_retention_days    = 7
alarm_email           = "alerts@collectiq.com"
```

---

## Configuration Bootstrap

### Backend: /config Endpoint

Exposes runtime configuration to frontend:

```typescript
// services/backend/src/handlers/config.ts
export async function handler() {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      upload: {
        maxSizeBytes: parseInt(process.env.MAX_UPLOAD_MB || '12') * 1024 * 1024,
        maxSizeMB: parseInt(process.env.MAX_UPLOAD_MB || '12'),
        allowedMimeTypes: (
          process.env.ALLOWED_UPLOAD_MIME || 'image/jpeg,image/png,image/heic'
        ).split(','),
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.heic'],
        presignTTL: parseInt(process.env.PRESIGN_TTL_SECONDS || '300'),
      },
      features: {
        heicSupport: process.env.FEATURE_HEIC_SUPPORT === 'true',
        clientCompression: process.env.FEATURE_CLIENT_COMPRESSION === 'true',
        bulkUpload: process.env.FEATURE_BULK_UPLOAD === 'true',
      },
      version: process.env.APP_VERSION || '1.0.0',
    }),
  };
}
```

### Frontend: Configuration Hook

```typescript
// apps/web/lib/hooks/use-config.ts
import useSWR from 'swr';

export function useConfig() {
  const { data, error } = useSWR('/api/v1/config', {
    revalidateOnMount: true,
    revalidateOnFocus: false,
  });

  return {
    config: data,
    isLoading: !error && !data,
    isError: error,
  };
}
```

---

## Environment-Specific Overrides

### Local Development (.env.local)

```bash
# Backend (services/backend/.env.local)
MAX_UPLOAD_MB=5                    # Smaller limit for local testing
LOG_LEVEL=DEBUG                    # Verbose logging
XRAY_ENABLED=false                 # Disable X-Ray locally
UPLOAD_BUCKET=collectiq-uploads-local

# Frontend (apps/web/.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_MAX_UPLOAD_MB=5
```

### Hackathon Environment

```bash
# Deployed via Terraform + GitHub Actions
MAX_UPLOAD_MB=12
LOG_LEVEL=INFO
XRAY_ENABLED=true
UPLOAD_BUCKET=collectiq-uploads-hackathon
```

### Production Environment (Future)

```bash
MAX_UPLOAD_MB=20                   # Higher limit for production
LOG_LEVEL=WARN                     # Reduce log volume
DYNAMODB_BILLING_MODE=PROVISIONED  # Cost optimization
ENABLE_WAF=true                    # Web Application Firewall
```

---

## Secrets Management

### AWS Secrets Manager

Sensitive credentials stored in Secrets Manager with automatic rotation:

```json
{
  "tcgplayer": {
    "apiKey": "...",
    "secretKey": "..."
  },
  "ebay": {
    "appId": "...",
    "certId": "...",
    "devId": "..."
  },
  "pricecharting": {
    "apiKey": "..."
  }
}
```

### Lambda Environment Variables

Secrets injected at runtime:

```hcl
# infra/terraform/modules/lambda_fn/main.tf
resource "aws_lambda_function" "handler" {
  environment {
    variables = {
      TCGPLAYER_API_KEY = data.aws_secretsmanager_secret_version.tcgplayer.secret_string
      EBAY_APP_ID       = data.aws_secretsmanager_secret_version.ebay.secret_string
    }
  }
}
```

---

## Validation

### Configuration Schema (Zod)

```typescript
// packages/shared/src/config-schema.ts
import { z } from 'zod';

export const ConfigSchema = z.object({
  upload: z.object({
    maxSizeBytes: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024),
    maxSizeMB: z.number().int().positive().max(50),
    allowedMimeTypes: z.array(z.enum(['image/jpeg', 'image/png', 'image/heic'])),
    allowedExtensions: z.array(z.string().regex(/^\.[a-z]+$/)),
    presignTTL: z.number().int().min(60).max(3600),
  }),
  features: z.object({
    heicSupport: z.boolean(),
    clientCompression: z.boolean(),
    bulkUpload: z.boolean(),
  }),
  version: z.string(),
});

export type Config = z.infer<typeof ConfigSchema>;
```

### Runtime Validation

```typescript
// Validate on startup
const config = ConfigSchema.parse(process.env);
```

---

## Configuration Precedence

1. **Environment Variables** (highest priority)
2. **Terraform Variables** (infrastructure defaults)
3. **Application Defaults** (hardcoded fallbacks)

Example:

```typescript
const maxUploadMB =
  parseInt(process.env.MAX_UPLOAD_MB) || // 1. Env var
  parseInt(terraformOutputs.maxUploadMB) || // 2. Terraform
  12; // 3. Default
```

---

## Monitoring Configuration Changes

### CloudWatch Alarms

```hcl
resource "aws_cloudwatch_metric_alarm" "config_change" {
  alarm_name          = "collectiq-config-change"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ConfigurationChange"
  namespace           = "CollectIQ/Config"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Alert when configuration changes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
```

### Audit Logging

```typescript
logger.info('Configuration loaded', {
  maxUploadMB: config.upload.maxSizeMB,
  allowedMimeTypes: config.upload.allowedMimeTypes,
  presignTTL: config.upload.presignTTL,
  source: 'environment',
});
```

---

## References

- [AWS Lambda Environment Variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Terraform Variables](https://developer.hashicorp.com/terraform/language/values/variables)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
