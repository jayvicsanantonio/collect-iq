# Hackathon Environment - Quick Start

This guide provides a quick setup for the CollectIQ hackathon environment.

## Prerequisites

- Terraform >= 1.1.7 installed
- AWS CLI configured with credentials
- S3 bucket and DynamoDB table for state management (created via prereq)

## Quick Setup

### 1. Ensure State Backend Exists

```bash
# From project root
cd infra/terraform/prereq

# Initialize and apply (if not already done)
terraform init
terraform apply
```

### 2. Initialize Hackathon Environment

```bash
# Navigate to hackathon environment
cd ../envs/hackathon

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars (optional - defaults are configured)
# Update github_repo_url if you want to configure Amplify

# Initialize Terraform backend
terraform init

# Validate configuration
terraform validate

# Format code
terraform fmt
```

### 3. Deploy Infrastructure

```bash
# Review planned changes
terraform plan

# Apply configuration
terraform apply
# Type 'yes' when prompted
```

## What Gets Created

Currently, the hackathon environment creates minimal resources:

- Data source for AWS account ID
- Local variables for resource naming

As modules are added, this environment will provision:

- AWS Amplify hosting for Next.js frontend
- Amazon Cognito user pool with Hosted UI
- API Gateway with JWT authorizer
- Lambda functions for backend APIs
- Step Functions for multi-agent orchestration
- DynamoDB table for data storage
- S3 bucket for image uploads
- EventBridge for domain events
- CloudWatch dashboards and alarms
- Secrets Manager for API keys

## Configuration

The hackathon environment is pre-configured with:

- **Region**: us-east-1
- **Budget**: $50/month
- **Lambda Memory**: 512MB (lightweight), 1024MB (heavy)
- **Log Level**: info
- **Billing**: On-demand for DynamoDB
- **Domain**: Amplify default domain (no custom domain)

## Outputs

After applying, view outputs:

```bash
terraform output
```

Current outputs:

- `aws_region`: AWS region
- `environment`: Environment name (hackathon)
- `account_id`: AWS account ID
- `name_prefix`: Resource naming prefix (collectiq-hackathon)

## Verify Setup

```bash
# Check state file in S3
aws s3 ls s3://collectiq-tfstate/hackathon/

# List Terraform resources
terraform state list

# Show current state
terraform show
```

## Next Steps

1. **Create Terraform Modules**: Implement modules in `../../modules/`
2. **Import Modules**: Add module blocks to `main.tf`
3. **Deploy Resources**: Run `terraform apply` after each module addition
4. **Configure Applications**: Use Terraform outputs to configure frontend/backend

## Troubleshooting

### Backend not initialized

```bash
cd ../../prereq
terraform init
terraform apply
```

### State lock errors

```bash
terraform force-unlock <LOCK_ID>
```

### Permission errors

Verify AWS credentials:

```bash
aws sts get-caller-identity
```

## Cleanup

To destroy all resources:

```bash
terraform destroy
# Type 'yes' when prompted
```

**Note**: This does not delete the state backend (S3 bucket and DynamoDB table).
