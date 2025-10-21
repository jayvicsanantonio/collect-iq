# Design Document

## Overview

The CollectIQ DevOps infrastructure is a fully serverless AWS architecture designed to support an AI-powered Pokémon TCG card identification, authentication, and valuation platform. The infrastructure is provisioned entirely through Terraform infrastructure-as-code, enabling reproducible deployments for the hackathon environment.

The architecture follows AWS Well-Architected Framework principles with emphasis on operational excellence, security, reliability, performance efficiency, and cost optimization. As a hackathon project, the system is designed for a single environment with a target budget of ~$50/month and support for 100k API calls/month.

The infrastructure supports a pnpm workspace monorepo with backend services in `services/backend/`, frontend in `apps/web/`, and shared packages in `packages/` (shared types/schemas, config, telemetry). Lambda functions are built from the backend service code and deployed with esbuild bundling.

Key design principles:

- **Infrastructure as Code**: All resources defined in Terraform with modular, reusable components
- **Serverless-First**: Leverage Lambda, API Gateway, Step Functions, DynamoDB for automatic scaling
- **Security by Default**: Least-privilege IAM, encryption at rest/transit, JWT authentication
- **Multi-Agent AI**: Rekognition extracts features → Bedrock performs reasoning → Step Functions orchestrates
- **Cost-Optimized**: Free tier maximization, on-demand billing, Express workflows, log verbosity control
- **Observable**: CloudWatch dashboards, X-Ray tracing, structured logging, custom metrics
- **Automated CI/CD**: Terraform validation, Lambda canary deployments, Amplify auto-build

## Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Cloud (us-east-1)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              AWS Amplify Hosting (Frontend)                 │ │
│  │  Next.js 14 SSR/ISR + Custom Domain (app.collectiq.com)   │ │
│  └────────────────┬───────────────────────────────────────────┘ │
│                   │ HTTPS + JWT                                  │
│                   ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         Amazon API Gateway (HTTP API)                       │ │
│  │         + Cognito JWT Authorizer                           │ │
│  └────────────────┬───────────────────────────────────────────┘ │
│                   │                                              │
│       ┌───────────┼───────────┬──────────────┬─────────────┐   │
│       │           │           │              │             │   │
│       ▼           ▼           ▼              ▼             ▼   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│  │Presign │ │ Cards  │ │ Cards  │ │ Cards  │ │Revalue │      │
│  │ Lambda │ │ Create │ │  List  │ │  Get   │ │ Lambda │      │
│  └────────┘ └────────┘ └────────┘ └────────┘ └───┬────┘      │
│                                                     │           │
│                                                     ▼           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           AWS Step Functions (Multi-Agent)               │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  Task 1: RekognitionExtract Lambda                 │ │  │
│  │  │  (Rekognition DetectText + DetectLabels)           │ │  │
│  │  └──────────────────┬─────────────────────────────────┘ │  │
│  │                     │ FeatureEnvelope                    │  │
│  │                     ▼                                    │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │         Parallel Execution                         │ │  │
│  │  │  ┌──────────────────┐  ┌──────────────────────┐   │ │  │
│  │  │  │  PricingAgent    │  │  AuthenticityAgent   │   │ │  │
│  │  │  │  Lambda          │  │  Lambda              │   │ │  │
│  │  │  │  (eBay, TCG,     │  │  (Bedrock + pHash)   │   │ │  │
│  │  │  │   PriceCharting) │  │                      │   │ │  │
│  │  │  └──────────────────┘  └──────────────────────┘   │ │  │
│  │  └────────────────┬───────────────────────────────────┘ │  │
│  │                   │                                      │  │
│  │                   ▼                                      │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │  Task 3: Aggregator Lambda                         │ │  │
│  │  │  (Merge + Persist + EventBridge)                   │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  DynamoDB    │  │  S3 Uploads  │  │  EventBridge │         │
│  │  (Cards +    │  │  (Images +   │  │  (Domain     │         │
│  │   Pricing)   │  │   Samples)   │  │   Events)    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Cognito    │  │   Secrets    │  │  CloudWatch  │         │
│  │  User Pool   │  │   Manager    │  │  + X-Ray     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Terraform Module Structure

```
infra/terraform/
├── modules/
│   ├── amplify_hosting/          # Next.js app deployment
│   ├── api_gateway_http/         # HTTP API + routes + authorizer
│   ├── cognito_user_pool/        # User pool + Hosted UI
│   ├── s3_uploads/               # Upload bucket + CORS
│   ├── dynamodb_collectiq/       # Single-table + GSIs
│   ├── lambda_fn/                # Generic Lambda module
│   ├── step_functions/           # State machine orchestration
│   ├── eventbridge_bus/          # Domain events + rules
│   ├── rekognition_access/       # IAM policies for Rekognition
│   ├── bedrock_access/           # IAM policies for Bedrock
│   ├── cloudwatch_dashboards/    # Monitoring dashboards
│   ├── ssm_secrets/              # External API keys
│   └── xray/                     # Distributed tracing
├── envs/
│   └── hackathon/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── terraform.tfvars
└── backend.tf                    # S3 + DynamoDB state backend
```

### Monorepo Integration

The infrastructure integrates with the pnpm workspace monorepo structure:

- **Backend Services** (`services/backend/`): Lambda function source code organized by handlers, agents, orchestration, adapters, store, auth, and utils
- **Frontend Application** (`apps/web/`): Next.js application deployed via AWS Amplify
- **Shared Packages** (`packages/`):
  - `packages/shared/`: Shared TypeScript types and Zod schemas used across frontend and backend
  - `packages/config/`: Build, lint, and test configuration shared across workspace
  - `packages/telemetry/`: Logging and metrics utilities that may be bundled into Lambda functions

Lambda functions built with esbuild will automatically bundle dependencies from `packages/shared/` and `packages/telemetry/` as needed, ensuring consistent types and utilities across the application.

### 1. AWS Amplify Hosting Module

**Purpose:** Deploy Next.js 14 frontend with SSR/ISR support

**Terraform Resources:**

- `aws_amplify_app`: Main application
- `aws_amplify_branch`: Main and PR preview branches
- `aws_amplify_domain_association`: Custom domain (app.collectiq.com)
- `aws_amplify_webhook`: GitHub integration

**Configuration:**

```hcl
module "amplify_hosting" {
  source = "../../modules/amplify_hosting"

  app_name          = "collectiq-hackathon"
  repository        = var.github_repo_url
  branch_name       = "main"

  environment_variables = {
    NEXT_PUBLIC_REGION                    = var.aws_region
    NEXT_PUBLIC_COGNITO_USER_POOL_ID      = module.cognito.user_pool_id
    NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID = module.cognito.client_id
    NEXT_PUBLIC_COGNITO_DOMAIN            = module.cognito.hosted_ui_domain
    NEXT_PUBLIC_OAUTH_REDIRECT_URI        = "https://${module.amplify_hosting.default_domain}/auth/callback"
    NEXT_PUBLIC_OAUTH_LOGOUT_URI          = "https://${module.amplify_hosting.default_domain}"
    NEXT_PUBLIC_API_BASE                  = module.api_gateway.api_endpoint
  }

  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
  EOT
}
```

### 2. Amazon Cognito User Pool Module

**Purpose:** Manage user authentication with Hosted UI and OAuth 2.0

**Terraform Resources:**

- `aws_cognito_user_pool`: User pool with email sign-up
- `aws_cognito_user_pool_client`: App client for OAuth
- `aws_cognito_user_pool_domain`: Hosted UI domain
- `aws_cognito_identity_provider`: Optional social providers

**Configuration:**

```hcl
module "cognito" {
  source = "../../modules/cognito_user_pool"

  user_pool_name = "collectiq-hackathon"

  password_policy = {
    minimum_length    = 8
    require_uppercase = true
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
  }

  auto_verified_attributes = ["email"]
  mfa_configuration        = "OPTIONAL"

  app_client_name = "collectiq-web-hackathon"
  callback_urls   = [
    "https://${module.amplify_hosting.default_domain}/auth/callback"
  ]
  logout_urls = [
    "https://${module.amplify_hosting.default_domain}"
  ]

  allowed_oauth_flows  = ["code"]
  allowed_oauth_scopes = ["openid", "email", "profile"]

  hosted_ui_domain_prefix = "collectiq-hackathon"
}
```

**Outputs:**

- `user_pool_id`: For API Gateway authorizer
- `client_id`: For frontend OAuth configuration
- `hosted_ui_domain`: For OAuth redirects
- `jwks_url`: For JWT validation

### 3. API Gateway HTTP API Module

**Purpose:** Route requests to Lambda functions with JWT authorization

**Key Resources:** `aws_apigatewayv2_api`, `aws_apigatewayv2_authorizer`, `aws_apigatewayv2_route`, `aws_apigatewayv2_integration`

**Routes:**

- POST /upload/presign → upload_presign Lambda
- POST /cards → cards_create Lambda
- GET /cards → cards_list Lambda
- GET /cards/{id} → cards_get Lambda
- DELETE /cards/{id} → cards_delete Lambda
- POST /cards/{id}/revalue → cards_revalue Lambda
- GET /healthz → healthz Lambda (no auth)

**JWT Authorizer:** Validates Cognito tokens using JWKS URL

### 4. DynamoDB Module

**Purpose:** Single-table design for user-scoped card data

**Key Resources:** `aws_dynamodb_table` with GSIs

**Schema:**

- PK: USER#{sub}, SK: CARD#{cardId} | PRICE#{iso8601}
- GSI1: userId + createdAt (vault listings)
- GSI2: set#rarity + valueMedian (analytics)
- Billing: On-demand, PITR enabled, TTL enabled

### 5. S3 Uploads Module

**Purpose:** Secure image storage with presigned URLs

**Key Resources:** `aws_s3_bucket`, `aws_s3_bucket_public_access_block`, `aws_s3_bucket_lifecycle_configuration`

**Security:** Block public access, SSE-S3, enforce HTTPS, CORS for presigned PUT

### 6. Lambda Function Module

**Purpose:** Reusable module for deploying Lambda functions

**Key Resources:** `aws_lambda_function`, `aws_iam_role`, `aws_lambda_alias`, `aws_cloudwatch_log_group`

**Features:** esbuild packaging, X-Ray tracing, environment variables, least-privilege IAM

**Source Code:** Lambda functions are built from `services/backend/src/handlers/` and `services/backend/src/agents/` directories. Shared code from `packages/shared/` may be bundled into Lambda functions during the esbuild process.

### 7. Step Functions Module

**Purpose:** Multi-agent orchestration workflow

**State Machine Flow:**

1. RekognitionExtract → FeatureEnvelope
2. Parallel: PricingAgent + AuthenticityAgent
3. Aggregator → DynamoDB + EventBridge

**Error Handling:** Retry with exponential backoff, DLQ for persistent failures

### 8. EventBridge Module

**Purpose:** Domain event bus for asynchronous communication

**Events:** CardValuationUpdated, AuthenticityFlagged

**Targets:** Lambda functions, SQS queues, DLQ for failed deliveries

## Data Models

### Terraform State Management

**Backend Configuration:**

```hcl
terraform {
  backend "s3" {
    bucket         = "collectiq-terraform-state-${account_id}"
    key            = "hackathon/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "collectiq-terraform-locks"
  }
}
```

**State Locking:** DynamoDB table prevents concurrent modifications

**Versioning:** S3 versioning enabled for state file recovery

### Resource Tagging Strategy

All resources tagged with:

```hcl
tags = {
  Project     = "CollectIQ"
  Environment = "hackathon"
  Owner       = "DevOps"
  ManagedBy   = "Terraform"
  CostCenter  = "Engineering"
}
```

## Error Handling

### Terraform Validation Pipeline

**Pre-commit Checks:**

1. `terraform fmt -check` - Enforce formatting
2. `terraform validate` - Syntax validation
3. `tflint` - Linting for best practices
4. `checkov` - Security scanning

**CI/CD Gates:**

- All checks must pass before merge
- Manual approval required for `terraform apply`
- Drift detection runs daily

### Lambda Deployment Rollback

**Canary Deployment:**

- Deploy to alias with 10% traffic
- Monitor CloudWatch alarms for 10 minutes
- Auto-rollback if error rate > 5%

**Linear Deployment:**

- Increase traffic by 10% every 10 minutes
- Full rollout in 100 minutes
- Rollback on alarm breach

### Step Functions Error Handling

**Retry Configuration:**

```json
{
  "Retry": [
    {
      "ErrorEquals": ["States.TaskFailed"],
      "IntervalSeconds": 2,
      "MaxAttempts": 3,
      "BackoffRate": 2.0
    }
  ]
}
```

**Catch and DLQ:**

```json
{
  "Catch": [
    {
      "ErrorEquals": ["States.ALL"],
      "ResultPath": "$.error",
      "Next": "ErrorHandler"
    }
  ]
}
```

## Testing Strategy

### Infrastructure Testing

**Unit Tests:** Terraform module validation with `terraform-compliance`

**Integration Tests:** Deploy to ephemeral environment, run smoke tests, destroy

**Security Tests:** `checkov` scans for misconfigurations (public S3, missing encryption, overly permissive IAM)

**Cost Tests:** `infracost` estimates cost changes before apply

### Smoke Tests Post-Deployment

1. GET /healthz → 200 OK
2. POST /upload/presign with valid JWT → 200 with presigned URL
3. GET /cards with valid JWT → 200 with empty array (new user)
4. Verify Amplify deployment status
5. Verify Cognito Hosted UI accessibility

## Security Considerations

### IAM Least Privilege

**Lambda Execution Roles:**

- upload_presign: s3:PutObject (scoped to uploads/ prefix)
- cards_create: dynamodb:PutItem (scoped to table ARN)
- cards_list: dynamodb:Query (scoped to GSI1)
- rekognition_extract: rekognition:DetectText, rekognition:DetectLabels, s3:GetObject
- authenticity_agent: bedrock:InvokeModel, s3:GetObject
- pricing_agent: secretsmanager:GetSecretValue (scoped to API key secrets)

**API Gateway Authorizer:**

- Validates JWT signature using Cognito JWKS
- Extracts `sub` claim for user scoping
- Returns 401 for invalid/expired tokens

### Encryption

**At Rest:**

- S3: SSE-S3 (AES-256)
- DynamoDB: AWS managed keys
- Secrets Manager: AWS managed KMS keys
- CloudWatch Logs: KMS encryption

**In Transit:**

- API Gateway: HTTPS only
- S3 presigned URLs: HTTPS enforced via bucket policy
- Lambda to AWS services: TLS 1.2+

### Network Security

**VPC:** Not required (serverless services use AWS PrivateLink)

**Optional VPC Endpoints:** For Bedrock/Rekognition if private networking needed

**Security Groups:** N/A (no EC2 instances)

## Performance Optimization

### Lambda Optimization

**Memory Allocation:**

- Lightweight APIs (presign, list, get): 512MB
- Heavy processing (rekognition_extract, pricing_agent): 1024MB
- Bedrock inference (authenticity_agent): 1024MB

**Cold Start Mitigation:**

- Provisioned concurrency for critical functions (optional, cost vs latency tradeoff)
- Minimize dependencies in Lambda packages
- Use esbuild for tree-shaking and minification

### DynamoDB Optimization

**Access Patterns:**

- Single-item reads: GetItem with PK+SK
- Vault listings: Query GSI1 with userId
- Analytics: Query GSI2 with set#rarity

**Caching:**

- Pricing data cached with TTL (300 seconds)
- Application-level caching in Lambda memory

### Step Functions Optimization

**Express vs Standard:**

- Use Express workflows for high-volume, short-duration tasks (< 5 minutes)
- Use Standard workflows for long-running, auditable processes

**Parallel Execution:**

- PricingAgent and AuthenticityAgent run concurrently
- Reduces total workflow time by ~50%

## Cost Optimization

### Free Tier Maximization

**Lambda:** 1M requests + 400k GB-seconds/month free
**DynamoDB:** 25 GB storage + 25 WCU + 25 RCU free
**S3:** 5 GB storage + 20k GET + 2k PUT free
**CloudWatch:** 5 GB logs + 10 custom metrics free

### Cost Reduction Strategies

**Hackathon Phase ($20-50/month):**

1. Use 256-512MB Lambda memory
2. Use info-level logging
3. Use Express Step Functions
4. Set AWS Budget alert at $50
5. Maximize free tier usage

### Cost Monitoring

**AWS Budgets:**

- Hackathon: $50/month (alert at 80% and 100%)

**Cost Allocation Tags:**

- Environment (hackathon)
- Service (lambda, dynamodb, s3, etc.)
- Feature (upload, valuation, authenticity)

## Deployment Architecture

### CI/CD Pipeline

**Backend Pipeline (GitHub Actions):**

```yaml
name: Backend CI/CD
on:
  push:
    branches: [main, develop]
    paths: ['services/backend/**', 'packages/shared/**', 'packages/telemetry/**']

jobs:
  test:
    - Lint (ESLint)
    - Typecheck (tsc)
    - Unit tests (Vitest)
    - Integration tests (LocalStack)

  package:
    - Build Lambda functions with esbuild from services/backend/src
    - Bundle dependencies from packages/shared and packages/telemetry
    - Upload artifacts to S3

  deploy:
    - Terraform plan
    - Manual approval (prod only)
    - Terraform apply
    - Smoke tests
```

**Infrastructure Pipeline:**

```yaml
name: Infrastructure CI/CD
on:
  push:
    paths: ['infra/terraform/**']

jobs:
  validate:
    - terraform fmt -check
    - terraform validate
    - tflint
    - checkov
    - infracost

  plan:
    - terraform plan
    - Post plan as PR comment

  apply:
    - Manual approval
    - terraform apply
    - Verify outputs
```

**Frontend Pipeline (Amplify):**

- Auto-triggered on git push to main branch
- Build Next.js app from apps/web/
- Deploy to Amplify
- PR previews for feature branches

### Deployment Strategies

**Blue/Green Deployment (Lambda):**

- Deploy new version to alias
- Shift traffic gradually (canary or linear)
- Monitor CloudWatch alarms
- Rollback on error threshold breach

**Immutable Infrastructure:**

- Never modify existing resources
- Always create new versions
- Use Terraform to manage state

### Rollback Procedures

**Lambda Rollback:**

```bash
aws lambda update-alias \
  --function-name cards_create \
  --name prod \
  --function-version $PREVIOUS_VERSION
```

**Terraform Rollback:**

```bash
# Revert to previous state
terraform state pull > current.tfstate
aws s3 cp s3://terraform-state/prod/terraform.tfstate.backup .
terraform state push terraform.tfstate.backup

# Re-apply previous configuration
git checkout $PREVIOUS_COMMIT
terraform apply
```

## Observability and Monitoring

### CloudWatch Dashboards

**API Performance Dashboard:**

- API Gateway 4xx/5xx rates
- API Gateway latency (P50, P95, P99)
- Request count by endpoint
- JWT authorization failures

**Lambda Performance Dashboard:**

- Invocation count by function
- Error rate by function
- Duration (P50, P95, P99)
- Throttles and concurrent executions
- Cold start frequency

**Step Functions Dashboard:**

- Execution count (success, failed, timed out)
- Execution duration
- Task-level metrics
- DLQ depth

**Data Layer Dashboard:**

- DynamoDB read/write capacity
- DynamoDB throttles
- S3 upload volume
- S3 GET/PUT request count

**AI Services Dashboard:**

- Rekognition API calls
- Bedrock invocations
- Bedrock token consumption
- Authenticity score distribution

### CloudWatch Alarms

**Critical Alarms:**

- API 5xx rate > 5% for 5 minutes → Page on-call
- Lambda error rate > 10% for 5 minutes → Page on-call
- Step Functions failed executions > 10 in 15 minutes → Page on-call
- DLQ depth > 10 messages → Page on-call

**Warning Alarms:**

- API P95 latency > 1000ms for 10 minutes → Slack notification
- Lambda duration approaching timeout → Slack notification
- DynamoDB throttles detected → Slack notification
- AWS Budget 80% threshold → Email notification

### X-Ray Tracing

**Service Map:**

- Visualize request flow: API Gateway → Lambda → DynamoDB/S3/Rekognition/Bedrock
- Identify bottlenecks and latency sources

**Trace Analysis:**

- Filter by error status
- Analyze slow requests
- Correlate with CloudWatch Logs

### Structured Logging

**Log Format:**

```json
{
  "timestamp": "2025-10-14T12:34:56.789Z",
  "level": "INFO",
  "requestId": "abc-123",
  "userId": "user-456",
  "operation": "cards_create",
  "duration": 234,
  "status": "success"
}
```

**Log Retention:**

- Hackathon: 30 days

**Log Insights Queries:**

- Error rate by operation
- P95 latency by endpoint
- User activity patterns

## Runbooks

### Alarm Response Procedures

**API 5xx Rate High:**

1. Check CloudWatch Logs for error patterns
2. Review X-Ray traces for failing requests
3. Check Lambda function metrics (errors, throttles)
4. Verify DynamoDB/S3 availability
5. If Lambda issue: rollback to previous version
6. If downstream service issue: check AWS Service Health Dashboard

**Lambda Error Rate High:**

1. Identify failing function from CloudWatch metrics
2. Review function logs for error messages
3. Check X-Ray traces for root cause
4. Verify IAM permissions
5. Check environment variables and secrets
6. Rollback to previous version if recent deployment

**Step Functions Failed Executions:**

1. Review execution history in Step Functions console
2. Identify failing task
3. Check task Lambda logs
4. Review DLQ messages for correlation IDs
5. Fix root cause (code bug, permission issue, quota limit)
6. Replay failed executions if idempotent

**DLQ Depth Increasing:**

1. Sample messages from DLQ
2. Identify error pattern
3. Check if transient (service outage) or persistent (code bug)
4. If transient: wait for recovery, messages will be retried
5. If persistent: fix root cause, redrive messages

### Quota Increase Procedures

**Rekognition Quota Exceeded:**

1. Navigate to AWS Service Quotas console
2. Select Amazon Rekognition
3. Request increase for "DetectText API TPS" or "DetectLabels API TPS"
4. Provide justification and expected usage
5. Wait for approval (typically 24-48 hours)
6. Implement caching to reduce API calls

**Bedrock Quota Exceeded:**

1. Navigate to AWS Service Quotas console
2. Select Amazon Bedrock
3. Request increase for model-specific quotas
4. Provide use case and expected token consumption
5. Consider using smaller models or prompt optimization

### Secrets Rotation

**External API Keys (eBay, TCGPlayer, PriceCharting):**

1. Generate new API key from provider
2. Store new key in Secrets Manager with version
3. Update Lambda environment to use new version
4. Test with new key
5. Deprecate old key after 24 hours
6. Delete old key from Secrets Manager

### Disaster Recovery

**DynamoDB Table Recovery:**

1. Navigate to DynamoDB console
2. Select table → Backups → Point-in-time recovery
3. Choose recovery time (up to 35 days)
4. Restore to new table
5. Update Terraform to point to new table
6. Verify data integrity

**S3 Bucket Recovery:**

1. Enable S3 versioning (should already be enabled)
2. List object versions
3. Restore deleted objects from previous versions
4. If bucket deleted: restore from backup or recreate

**Terraform State Recovery:**

1. List S3 state file versions
2. Download previous version
3. Restore using `terraform state push`
4. Verify state matches actual infrastructure

## Environment Configuration

### Hackathon Environment

**Purpose:** Hackathon demonstration and testing

**Configuration:**

- AWS Account: Single account
- Domain: Amplify default domain
- Budget: $50/month
- Cognito: hackathon-collectiq user pool
- DynamoDB: hackathon-CollectIQ table (on-demand)
- Lambda: 512MB memory, info logging
- Step Functions: Express workflows for cost efficiency
- Amplify: Auto-deploy from main branch

**Access Control:**

- Team members have full access
- Optional manual approval for deployments
- Terraform state in hackathon/ folder

### Environment Outputs

**To Backend:**

```hcl
output "api_base_url" {
  value = module.api_gateway.api_endpoint
}

output "dynamodb_table_name" {
  value = module.dynamodb.table_name
}

output "s3_uploads_bucket" {
  value = module.s3_uploads.bucket_name
}

output "step_functions_arn" {
  value = module.step_functions.state_machine_arn
}

output "eventbridge_bus_name" {
  value = module.eventbridge.bus_name
}
```

**To Frontend:**

```hcl
output "amplify_app_id" {
  value = module.amplify.app_id
}

output "amplify_default_domain" {
  value = module.amplify.default_domain
}

output "cognito_user_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_client_id" {
  value = module.cognito.client_id
}
```

## Conclusion

The CollectIQ DevOps infrastructure provides a hackathon-ready, scalable, and cost-optimized foundation for an AI-powered TCG card platform. Through Terraform infrastructure-as-code, automated CI/CD pipelines, comprehensive observability, and security best practices, the system delivers a functional prototype within budget constraints.

Key achievements:

- **Fully Serverless**: Automatic scaling with zero server management
- **Cost-Optimized**: $20-50/month for hackathon demonstration
- **Secure by Default**: Least-privilege IAM, encryption, JWT authentication
- **Observable**: CloudWatch dashboards, X-Ray tracing, structured logging
- **Automated**: CI/CD pipelines, canary deployments, automatic rollback
- **Multi-Agent AI**: Rekognition → Bedrock orchestration via Step Functions
- **Hackathon-Ready**: Single environment, simplified deployment, monitoring, cost controls
