# Hackathon Environment

This directory contains the Terraform configuration for the CollectIQ hackathon environment.

## Prerequisites

1. **AWS Account**: Ensure you have AWS credentials configured
2. **Terraform**: Version >= 1.1.7
3. **State Backend**: S3 bucket and DynamoDB table must be created first

## Initial Setup

### 1. Create State Backend (One-time setup)

Before initializing this environment, you must create the S3 bucket and DynamoDB table for state management:

```bash
cd ../../prereq
terraform init
terraform plan
terraform apply
```

This creates:

- S3 bucket: `collectiq-tfstate` (with versioning enabled)
- DynamoDB table: `collectiq-terraform-locks`

### 2. Configure Variables

Copy the example tfvars file and update with your values:

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your configuration
```

### 3. Initialize Terraform

Initialize the Terraform backend and download providers:

```bash
terraform init
```

### 4. Plan and Apply

Review the infrastructure changes:

```bash
terraform plan
```

Apply the configuration:

```bash
terraform apply
```

## Configuration

### Variables

#### Core Configuration

- `aws_region` (string): AWS region for all resources
  - Default: `us-east-1`
  - Description: Primary region for infrastructure deployment

- `environment` (string): Environment name
  - Default: `hackathon`
  - Description: Used for resource naming and tagging

- `project_name` (string): Project name for resource naming
  - Default: `collectiq`
  - Description: Base name for all resources

#### GitHub Integration

- `github_repo_url` (string): GitHub repository URL for Amplify hosting
  - Required: Yes
  - Example: `https://github.com/your-org/collect-iq`
  - Description: Repository containing Next.js frontend code

#### Budget Configuration

- `budget_amount` (number): Monthly budget amount in USD
  - Default: `50`
  - Description: AWS Budget with alerts at 80% and 100% thresholds

- `budget_email_addresses` (list(string)): Email addresses for budget alerts
  - Default: `[]`
  - Example: `["devops@example.com", "team@example.com"]`
  - Description: Recipients for budget threshold notifications

#### Lambda Configuration

- `lambda_memory_lightweight` (number): Memory allocation for lightweight Lambda functions (MB)
  - Default: `512`
  - Description: Used for presign, list, get, delete handlers

- `lambda_memory_heavy` (number): Memory allocation for heavy processing Lambda functions (MB)
  - Default: `1024`
  - Description: Used for rekognition_extract, pricing_agent, authenticity_agent

#### Logging and Monitoring

- `log_level` (string): Log level for Lambda functions
  - Default: `info`
  - Options: `debug`, `info`, `warn`, `error`
  - Description: Controls verbosity of application logs

- `log_retention_days` (number): CloudWatch log retention in days
  - Default: `30`
  - Description: How long to retain logs before automatic deletion

- `enable_xray_tracing` (bool): Enable X-Ray tracing
  - Default: `true`
  - Description: Enables distributed tracing for Lambda and Step Functions

### Outputs

After applying, Terraform will output the following values for use by frontend and backend applications:

#### Backend Outputs

- `api_base_url`: API Gateway base URL for backend requests
- `api_id`: API Gateway ID
- `dynamodb_table_name`: DynamoDB table name for card data
- `dynamodb_table_arn`: DynamoDB table ARN
- `s3_uploads_bucket`: S3 bucket name for image uploads
- `s3_uploads_bucket_arn`: S3 bucket ARN
- `eventbridge_bus_name`: EventBridge bus name for domain events
- `eventbridge_bus_arn`: EventBridge bus ARN

#### Frontend Outputs

- `amplify_app_id`: Amplify application ID
- `amplify_default_domain`: Amplify default domain (e.g., `main.d123abc.amplifyapp.com`)
- `amplify_main_branch_url`: Full URL for main branch deployment

#### Authentication Outputs

- `cognito_user_pool_id`: Cognito user pool ID
- `cognito_user_pool_arn`: Cognito user pool ARN
- `cognito_client_id`: Cognito app client ID for OAuth
- `cognito_hosted_ui_domain`: Cognito Hosted UI domain for authentication
- `cognito_jwks_url`: JWKS URL for JWT validation

#### IAM Policy Outputs

- `rekognition_policy_arn`: IAM policy ARN for Rekognition access
- `bedrock_policy_arn`: IAM policy ARN for Bedrock access
- `secrets_policy_arn`: IAM policy ARN for Secrets Manager access

#### Secrets Manager Outputs

- `secret_arns`: Map of secret names to ARNs (sensitive)

## Resource Naming Convention

All resources are prefixed with: `collectiq-hackathon-`

## Cost Optimization

The hackathon environment is configured for cost efficiency:

- Lambda memory: 512MB for lightweight, 1024MB for heavy processing
- DynamoDB: On-demand billing
- S3: Lifecycle policies for archival
- Budget alerts at $50/month

## Modules

Infrastructure is organized into reusable modules:

- `amplify_hosting`: Next.js frontend deployment
- `cognito_user_pool`: User authentication
- `api_gateway_http`: HTTP API with JWT authorizer
- `dynamodb_collectiq`: Single-table design
- `s3_uploads`: Secure image storage
- `lambda_fn`: Lambda function deployment
- `step_functions`: Multi-agent orchestration
- `eventbridge_bus`: Domain events
- `rekognition_access`: IAM policies for Rekognition
- `bedrock_access`: IAM policies for Bedrock
- `cloudwatch_dashboards`: Monitoring
- `ssm_secrets`: External API keys

## State Management

- **Backend**: S3 with DynamoDB locking
- **State file**: `s3://collectiq-tfstate/hackathon/terraform.tfstate`
- **Lock table**: `collectiq-terraform-locks`
- **Encryption**: Enabled
- **Versioning**: Enabled for state recovery

## Common Commands

```bash
# Initialize backend
terraform init

# Validate configuration
terraform validate

# Format code
terraform fmt -recursive

# Plan changes
terraform plan

# Apply changes
terraform apply

# Show current state
terraform show

# List resources
terraform state list

# Destroy all resources (use with caution!)
terraform destroy
```

## Troubleshooting

### Backend initialization fails

Ensure the prereq resources are created:

```bash
cd ../../prereq
terraform apply
```

### State lock errors

If state is locked, you can force unlock (use with caution):

```bash
terraform force-unlock <LOCK_ID>
```

### Permission errors

Ensure your AWS credentials have sufficient permissions for all resources.
