# Deployment Guide

This guide covers the complete deployment process for the CollectIQ backend, including build configuration, Lambda packaging, Terraform integration, and deployment verification.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Build Process](#build-process)
- [Lambda Packaging](#lambda-packaging)
- [Terraform Integration](#terraform-integration)
- [Deployment Workflow](#deployment-workflow)
- [Deployment Checklist](#deployment-checklist)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Node.js**: v20+ (LTS)
- **pnpm**: v9+
- **AWS CLI**: v2.x
- **Terraform**: v1.5+
- **esbuild**: Installed via pnpm (dev dependency)

### AWS Account Setup

1. **AWS Credentials**: Configure AWS CLI with appropriate credentials

   ```bash
   aws configure
   # Or use environment variables:
   export AWS_ACCESS_KEY_ID=your-access-key
   export AWS_SECRET_ACCESS_KEY=your-secret-key
   export AWS_REGION=us-east-1
   ```

2. **Required AWS Services**:
   - Lambda
   - API Gateway (HTTP API)
   - DynamoDB
   - S3
   - Cognito
   - Step Functions
   - EventBridge
   - Rekognition
   - Bedrock
   - Secrets Manager
   - CloudWatch
   - X-Ray

3. **IAM Permissions**: Ensure your AWS user/role has permissions to:
   - Create and manage Lambda functions
   - Create and manage IAM roles and policies
   - Create and manage API Gateway resources
   - Create and manage DynamoDB tables
   - Create and manage S3 buckets
   - Create and manage Step Functions state machines
   - Access Bedrock models
   - Create and manage Secrets Manager secrets

### Repository Setup

```bash
# Clone repository
git clone https://github.com/your-org/collect-iq.git
cd collect-iq

# Install dependencies
pnpm install

# Verify backend dependencies
cd services/backend
pnpm install
```

---

## Build Process

### esbuild Configuration

The backend uses esbuild for fast, optimized Lambda bundling. Configuration is in `services/backend/esbuild.mjs`.

**Key Features**:

- **Tree-shaking**: Removes unused code
- **Minification**: Reduces bundle size
- **Source maps**: For debugging (dev only)
- **External modules**: AWS SDK v3 is marked external (provided by Lambda runtime)
- **Multiple entry points**: One bundle per Lambda function

**Configuration File** (`services/backend/esbuild.mjs`):

```javascript
import * as esbuild from 'esbuild';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

// Find all handler entry points
const handlers = glob.sync('src/handlers/*.ts', { cwd: __dirname });
const agents = glob.sync('src/agents/*.ts', { cwd: __dirname });
const orchestration = glob.sync('src/orchestration/*.ts', { cwd: __dirname });

const entryPoints = [...handlers, ...agents, ...orchestration].reduce((acc, file) => {
  const name = path.basename(file, '.ts');
  acc[name] = file;
  return acc;
}, {});

const buildOptions = {
  entryPoints,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  sourcemap: !isProduction,
  minify: isProduction,
  treeShaking: true,
  external: ['@aws-sdk/*', 'aws-sdk'],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
};

// Build
await esbuild.build(buildOptions);

console.log('✅ Build complete');
```

### Build Commands

```bash
# Development build (with source maps)
pnpm build

# Production build (minified, no source maps)
NODE_ENV=production pnpm build

# Clean build artifacts
pnpm clean
```

> ℹ️ Continuous rebuilds can be achieved by running `node esbuild.mjs` with a file watcher such as [`chokidar-cli`](https://github.com/open-cli-tools/chokidar-cli) if needed; a dedicated `pnpm build:watch` script is not yet provided.

### Build Output

After building, the `dist/` directory contains:

```
dist/
├── upload_presign.mjs
├── cards_create.mjs
├── cards_list.mjs
├── cards_get.mjs
├── cards_delete.mjs
├── cards_revalue.mjs
├── healthz.mjs
├── pricing_agent.mjs
├── authenticity_agent.mjs
├── rekognition_extract.mjs
├── aggregator.mjs
└── error_handler.mjs
```

Each `.mjs` file is a self-contained Lambda function bundle.

---

## Lambda Packaging

### Package Structure

Lambda functions are deployed as ZIP archives containing:

- Compiled JavaScript (`.mjs` files from `dist/`)
- `package.json` (for runtime dependencies)
- `node_modules/` (only production dependencies)

### Creating Lambda Packages

**Option 1: Manual Packaging**

```bash
# Work from the backend package
cd services/backend

# Build the code
pnpm build

# Install production dependencies only
pnpm install --prod --frozen-lockfile

# Create ZIP for each function
for file in dist/*.mjs; do
  name="$(basename "${file%.mjs}")"
  zip -r "dist/${name}.zip" "dist/${name}.mjs" node_modules package.json
done
```

Each archive bundles the compiled handler plus the runtime dependencies that esbuild marks as external (for example `@aws-sdk/*`). Configure the Lambda handler to point at `dist/<functionName>.handler`.

**Option 2: Terraform Archive Provider**

Terraform can automatically create ZIP archives:

```hcl
data "archive_file" "lambda_zip" {
  for_each = toset([
    "upload_presign",
    "cards_create",
    "cards_list",
    "cards_get",
    "cards_delete",
    "cards_revalue",
    "healthz",
    "pricing_agent",
    "authenticity_agent",
    "rekognition_extract",
    "aggregator",
    "error_handler"
  ])

  type       = "zip"
  source_dir = "${path.module}/../../services/backend/dist/${each.key}"
  output_path = "${path.module}/../../services/backend/dist/${each.key}.zip"
}
```

> Before using `archive_file`, ensure you stage a folder per function (for example `dist/upload_presign/`) that contains the compiled `.mjs` file, the `package.json`, and a trimmed `node_modules/`. You can adapt the packaging script above to create these folders so Terraform archives include all runtime dependencies.

**Option 3: CI/CD Pipeline**

GitHub Actions workflow (`.github/workflows/deploy-backend.yml`):

```yaml
name: Deploy Backend

on:
  push:
    branches: [main, develop]
    paths:
      - 'services/backend/**'
      - 'packages/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build backend
        run: |
          cd services/backend
          NODE_ENV=production pnpm build

      - name: Package Lambda functions
        run: |
          cd services/backend/dist
          for file in *.mjs; do
            name="${file%.mjs}"
            zip -r "${name}.zip" "${file}"
          done

      - name: Upload to S3
        run: |
          aws s3 sync services/backend/dist/ \
            s3://collectiq-lambda-artifacts-${{ github.sha }}/ \
            --exclude "*" --include "*.zip"

      - name: Deploy with Terraform
        run: |
          cd infra/terraform/envs/${{ github.ref_name == 'main' && 'prod' || 'dev' }}
          terraform init
          terraform apply -auto-approve \
            -var="lambda_artifacts_bucket=collectiq-lambda-artifacts-${{ github.sha }}"
```

### Lambda Layer (Optional)

For shared dependencies, create a Lambda Layer:

```bash
# Create layer directory
mkdir -p lambda-layer/nodejs

# Install shared dependencies
cd lambda-layer/nodejs
pnpm add @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb zod

# Create layer ZIP
cd ..
zip -r collectiq-shared-layer.zip nodejs/

# Upload to AWS
aws lambda publish-layer-version \
  --layer-name collectiq-shared-dependencies \
  --zip-file fileb://collectiq-shared-layer.zip \
  --compatible-runtimes nodejs20.x \
  --region us-east-1
```

---

## Terraform Integration

### Directory Structure

```
infra/terraform/
├── modules/
│   ├── lambda_fn/           # Lambda function module
│   ├── api_gateway_http/    # API Gateway module
│   ├── dynamodb_collectiq/  # DynamoDB module
│   ├── s3_uploads/          # S3 bucket module
│   ├── cognito_user_pool/   # Cognito module
│   ├── step_functions/      # Step Functions module
│   └── ...
└── envs/
    ├── dev/
    │   ├── main.tf
    │   ├── variables.tf
    │   ├── outputs.tf
    │   └── terraform.tfvars
    └── prod/
        ├── main.tf
        ├── variables.tf
        ├── outputs.tf
        └── terraform.tfvars
```

### Lambda Function Module

**Module** (`infra/terraform/modules/lambda_fn/main.tf`):

```hcl
variable "function_name" {
  description = "Name of the Lambda function"
  type        = string
}

variable "handler" {
  description = "Lambda handler (e.g., index.handler)"
  type        = string
  default     = "index.handler"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs20.x"
}

variable "memory_size" {
  description = "Memory allocation in MB"
  type        = number
  default     = 512
}

variable "timeout" {
  description = "Timeout in seconds"
  type        = number
  default     = 30
}

variable "environment_variables" {
  description = "Environment variables"
  type        = map(string)
  default     = {}
}

variable "source_code_path" {
  description = "Path to Lambda ZIP file"
  type        = string
}

variable "execution_role_arn" {
  description = "IAM role ARN for Lambda execution"
  type        = string
}

variable "layers" {
  description = "Lambda layer ARNs"
  type        = list(string)
  default     = []
}

variable "tracing_mode" {
  description = "X-Ray tracing mode (Active or PassThrough)"
  type        = string
  default     = "Active"
}

resource "aws_lambda_function" "this" {
  function_name = var.function_name
  role          = var.execution_role_arn
  handler       = var.handler
  runtime       = var.runtime
  memory_size   = var.memory_size
  timeout       = var.timeout
  layers        = var.layers

  filename         = var.source_code_path
  source_code_hash = filebase64sha256(var.source_code_path)

  environment {
    variables = var.environment_variables
  }

  tracing_config {
    mode = var.tracing_mode
  }

  tags = {
    Environment = var.stage
    Service     = "collectiq"
  }
}

output "function_arn" {
  value = aws_lambda_function.this.arn
}

output "function_name" {
  value = aws_lambda_function.this.function_name
}

output "invoke_arn" {
  value = aws_lambda_function.this.invoke_arn
}
```

### Environment Configuration

**Development** (`infra/terraform/envs/dev/main.tf`):

```hcl
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "collectiq-terraform-state"
    key            = "dev/backend/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "collectiq-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = "dev"
      Project     = "CollectIQ"
      ManagedBy   = "Terraform"
    }
  }
}

locals {
  stage = "dev"
  lambda_source_path = "${path.module}/../../../services/backend/dist"
}

# DynamoDB Table
module "dynamodb" {
  source = "../../modules/dynamodb_collectiq"

  stage = local.stage
}

# S3 Buckets
module "s3_uploads" {
  source = "../../modules/s3_uploads"

  stage      = local.stage
  kms_key_id = aws_kms_key.main.id
}

# Cognito User Pool
module "cognito" {
  source = "../../modules/cognito_user_pool"

  stage = local.stage
}

# Lambda Functions
module "lambda_upload_presign" {
  source = "../../modules/lambda_fn"

  function_name       = "${local.stage}-collectiq-upload-presign"
  source_code_path    = "${local.lambda_source_path}/upload_presign.zip"
  execution_role_arn  = aws_iam_role.upload_presign.arn
  memory_size         = 512
  timeout             = 10

  environment_variables = {
    AWS_REGION           = var.aws_region
    BUCKET_UPLOADS       = module.s3_uploads.bucket_name
    ALLOWED_UPLOAD_MIME  = "image/jpeg,image/png,image/heic"
    MAX_UPLOAD_MB        = "12"
  }
}

# API Gateway
module "api_gateway" {
  source = "../../modules/api_gateway_http"

  stage                = local.stage
  cognito_user_pool_id = module.cognito.user_pool_id
  cognito_client_id    = module.cognito.client_id

  lambda_integrations = {
    "POST /upload/presign"      = module.lambda_upload_presign.invoke_arn
    "POST /cards"               = module.lambda_cards_create.invoke_arn
    "GET /cards"                = module.lambda_cards_list.invoke_arn
    "GET /cards/{id}"           = module.lambda_cards_get.invoke_arn
    "DELETE /cards/{id}"        = module.lambda_cards_delete.invoke_arn
    "POST /cards/{id}/revalue"  = module.lambda_cards_revalue.invoke_arn
    "GET /healthz"              = module.lambda_healthz.invoke_arn
  }
}

# Step Functions
module "step_functions" {
  source = "../../modules/step_functions"

  stage                        = local.stage
  rekognition_extract_arn      = module.lambda_rekognition_extract.function_arn
  pricing_agent_arn            = module.lambda_pricing_agent.function_arn
  authenticity_agent_arn       = module.lambda_authenticity_agent.function_arn
  aggregator_arn               = module.lambda_aggregator.function_arn
  error_handler_arn            = module.lambda_error_handler.function_arn
}

# Outputs
output "api_endpoint" {
  value = module.api_gateway.api_endpoint
}

output "cognito_user_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_client_id" {
  value = module.cognito.client_id
}
```

**Variables** (`infra/terraform/envs/dev/terraform.tfvars`):

```hcl
aws_region = "us-east-1"
```

---

## Deployment Workflow

### Step-by-Step Deployment

#### 1. Build Backend

```bash
cd services/backend
NODE_ENV=production pnpm build
```

#### 2. Create Lambda Packages

```bash
cd dist
for file in *.mjs; do
  name="${file%.mjs}"
  zip "${name}.zip" "${file}"
done
cd ..
```

#### 3. Initialize Terraform

```bash
cd ../../infra/terraform/envs/dev
terraform init
```

#### 4. Plan Deployment

```bash
terraform plan -out=tfplan
```

Review the plan carefully to ensure:

- No unexpected resource deletions
- Correct environment variables
- Proper IAM permissions

#### 5. Apply Changes

```bash
terraform apply tfplan
```

#### 6. Verify Deployment

```bash
# Get API endpoint
API_ENDPOINT=$(terraform output -raw api_endpoint)

# Test health check
curl "${API_ENDPOINT}/healthz"

# Expected response: {"status":"ok","timestamp":"..."}
```

#### 7. Update Frontend Configuration

```bash
# Update frontend environment variables
cd ../../../../apps/web
cat > .env.local <<EOF
NEXT_PUBLIC_API_URL=${API_ENDPOINT}
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
NEXT_PUBLIC_COGNITO_CLIENT_ID=$(terraform output -raw cognito_client_id)
NEXT_PUBLIC_COGNITO_DOMAIN=$(terraform output -raw cognito_domain)
EOF
```

### Automated Deployment (CI/CD)

**GitHub Actions Workflow** (`.github/workflows/deploy-backend.yml`):

```yaml
name: Deploy Backend

on:
  push:
    branches: [main, develop]
    paths:
      - 'services/backend/**'
      - 'infra/terraform/**'

env:
  AWS_REGION: us-east-1

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.ref_name == 'main' && 'production' || 'development' }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build backend
        run: |
          cd services/backend
          NODE_ENV=production pnpm build

      - name: Run tests
        run: |
          cd services/backend
          pnpm test

      - name: Package Lambda functions
        run: |
          cd services/backend
          pnpm install --prod --frozen-lockfile
          for file in dist/*.mjs; do
            name="$(basename "${file%.mjs}")"
            zip -r "dist/${name}.zip" "dist/${name}.mjs" node_modules package.json
          done

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.5.0

      - name: Terraform Init
        run: |
          cd infra/terraform/envs/${{ github.ref_name == 'main' && 'prod' || 'dev' }}
          terraform init

      - name: Terraform Plan
        run: |
          cd infra/terraform/envs/${{ github.ref_name == 'main' && 'prod' || 'dev' }}
          terraform plan -out=tfplan

      - name: Terraform Apply
        run: |
          cd infra/terraform/envs/${{ github.ref_name == 'main' && 'prod' || 'dev' }}
          terraform apply -auto-approve tfplan

      - name: Verify Deployment
        run: |
          cd infra/terraform/envs/${{ github.ref_name == 'main' && 'prod' || 'dev' }}
          API_ENDPOINT=$(terraform output -raw api_endpoint)
          curl -f "${API_ENDPOINT}/healthz" || exit 1
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`pnpm test`)
- [ ] Code reviewed and approved
- [ ] Environment variables documented
- [ ] Secrets created in AWS Secrets Manager
- [ ] IAM roles and policies reviewed
- [ ] Terraform state backend configured
- [ ] DynamoDB lock table created
- [ ] KMS keys created for encryption
- [ ] CloudWatch log groups created (optional, auto-created by Lambda)

### Build Phase

- [ ] Clean build artifacts (`pnpm clean`)
- [ ] Production build completed (`NODE_ENV=production pnpm build`)
- [ ] No build errors or warnings
- [ ] Bundle sizes reasonable (< 50MB per function)
- [ ] Source maps excluded from production builds

### Terraform Phase

- [ ] Terraform initialized (`terraform init`)
- [ ] Terraform plan reviewed (`terraform plan`)
- [ ] No unexpected resource changes
- [ ] State file backed up
- [ ] Terraform apply completed successfully
- [ ] No errors in Terraform output

### Post-Deployment

- [ ] Health check endpoint responding (`/healthz`)
- [ ] API Gateway routes configured correctly
- [ ] JWT authorizer working (test with valid token)
- [ ] Lambda functions invocable
- [ ] CloudWatch logs streaming
- [ ] X-Ray traces appearing
- [ ] DynamoDB tables accessible
- [ ] S3 buckets accessible
- [ ] Step Functions state machine created
- [ ] EventBridge event bus created
- [ ] Secrets Manager secrets accessible
- [ ] Frontend environment variables updated
- [ ] End-to-end smoke tests passing

### Monitoring

- [ ] CloudWatch dashboards created
- [ ] CloudWatch alarms configured
- [ ] SNS topics for alerts created
- [ ] Error rates within acceptable range
- [ ] Latency metrics within SLA
- [ ] Cost monitoring enabled

---

## Rollback Procedures

### Immediate Rollback (Terraform)

If deployment fails or causes issues:

```bash
# Revert to previous Terraform state
cd infra/terraform/envs/dev
terraform apply -auto-approve -var="lambda_version=previous"

# Or use Terraform state rollback
terraform state pull > current-state.json
terraform state push previous-state.json
```

### Lambda Function Rollback

```bash
# List function versions
aws lambda list-versions-by-function \
  --function-name dev-collectiq-cards-create

# Update alias to previous version
aws lambda update-alias \
  --function-name dev-collectiq-cards-create \
  --name live \
  --function-version 42  # previous version number
```

### Database Rollback

DynamoDB schema changes are rare, but if needed:

```bash
# Restore from point-in-time backup
aws dynamodb restore-table-to-point-in-time \
  --source-table-name dev-CollectIQ \
  --target-table-name dev-CollectIQ-restored \
  --restore-date-time 2024-01-15T10:00:00Z

# Swap table names (requires downtime)
```

### Git Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or reset to specific commit (force push)
git reset --hard abc123
git push --force origin main
```

---

## Troubleshooting

### Build Failures

**Issue**: esbuild fails with module resolution errors

**Solution**:

```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Verify TypeScript configuration
pnpm typecheck
```

### Lambda Deployment Failures

**Issue**: Lambda function fails to deploy due to size limit

**Solution**:

```bash
# Check bundle size
ls -lh dist/*.zip

# If > 50MB, use Lambda layers or S3 upload
aws s3 cp dist/large-function.zip s3://lambda-artifacts/
aws lambda update-function-code \
  --function-name dev-collectiq-large-function \
  --s3-bucket lambda-artifacts \
  --s3-key large-function.zip
```

### Terraform State Lock

**Issue**: Terraform state locked by another process

**Solution**:

```bash
# Force unlock (use with caution)
terraform force-unlock <lock-id>

# Or delete lock from DynamoDB
aws dynamodb delete-item \
  --table-name collectiq-terraform-locks \
  --key '{"LockID":{"S":"collectiq-terraform-state/dev/backend/terraform.tfstate"}}'
```

### Permission Errors

**Issue**: Lambda function cannot access DynamoDB

**Solution**:

```bash
# Verify IAM role attached to Lambda
aws lambda get-function-configuration \
  --function-name dev-collectiq-cards-create \
  --query 'Role'

# Check IAM policies
aws iam list-attached-role-policies \
  --role-name dev-collectiq-cards-create

# Test IAM policy
aws iam simulate-principal-policy \
  --policy-source-arn <role-arn> \
  --action-names dynamodb:PutItem \
  --resource-arns <table-arn>
```

### API Gateway 502 Errors

**Issue**: API Gateway returns 502 Bad Gateway

**Solution**:

```bash
# Check Lambda logs
aws logs tail /aws/lambda/dev-collectiq-cards-create --follow

# Test Lambda directly
aws lambda invoke \
  --function-name dev-collectiq-cards-create \
  --payload '{"body":"{}"}' \
  response.json

# Check API Gateway integration
aws apigatewayv2 get-integration \
  --api-id <api-id> \
  --integration-id <integration-id>
```

### Cold Start Issues

**Issue**: First request takes > 5 seconds

**Solution**:

```bash
# Enable provisioned concurrency
aws lambda put-provisioned-concurrency-config \
  --function-name dev-collectiq-cards-create \
  --provisioned-concurrent-executions 2 \
  --qualifier live

# Or use Lambda SnapStart (Java only)
```

---

## Additional Resources

- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/latest/dg/)
- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [esbuild Documentation](https://esbuild.github.io/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

---

## Support

For deployment issues or questions:

- **Slack**: #collectiq-devops
- **Email**: devops@collectiq.com
- **On-call**: PagerDuty rotation

---

**Last Updated**: 2024-01-15
**Maintained By**: DevOps Team
