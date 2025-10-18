# Quick Deploy Guide

This is a condensed guide for deploying the hackathon environment. For detailed instructions, see `DEPLOYMENT_GUIDE.md`.

## Prerequisites

```bash
# Check prerequisites
./validate.sh
```

Required:

- Terraform >= 1.1.7
- AWS CLI with configured credentials
- State backend (S3 + DynamoDB)

## Quick Start

### 1. Configure Variables

Edit `terraform.tfvars`:

```hcl
# REQUIRED: Add your GitHub repository URL
github_repo_url = "https://github.com/your-org/collect-iq"

# OPTIONAL: Add email addresses for budget alerts
budget_email_addresses = ["devops@example.com"]
```

### 2. Deploy

```bash
# Initialize Terraform
terraform init

# Review changes
terraform plan

# Deploy infrastructure
terraform apply
```

### 3. Get Outputs

```bash
# View all outputs
terraform output

# Get specific output
terraform output api_base_url
terraform output cognito_user_pool_id
terraform output amplify_default_domain
```

## What Gets Deployed

- ✅ S3 bucket for image uploads
- ✅ DynamoDB table for card data
- ✅ Cognito user pool with Hosted UI
- ✅ API Gateway with JWT authorizer
- ✅ EventBridge event bus
- ✅ Secrets Manager for API keys
- ✅ IAM policies for Rekognition and Bedrock
- ✅ AWS Budget with $50/month alert
- ✅ Amplify app for Next.js frontend

## Post-Deployment

### Update Frontend Environment

Create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=$(terraform output -raw cognito_client_id)
NEXT_PUBLIC_COGNITO_DOMAIN=$(terraform output -raw cognito_hosted_ui_domain)
NEXT_PUBLIC_API_BASE=$(terraform output -raw api_base_url)
```

### Update Cognito Callback URLs

After Amplify deploys, update `main.tf`:

```hcl
callback_urls = [
  "http://localhost:3000/auth/callback",
  "https://$(terraform output -raw amplify_default_domain)/auth/callback"
]
```

Then apply:

```bash
terraform apply
```

## Verify Deployment

```bash
# Check S3 bucket
aws s3 ls | grep collectiq-hackathon-uploads

# Check DynamoDB table
aws dynamodb describe-table --table-name collectiq-hackathon-cards

# Check Cognito user pool
aws cognito-idp list-user-pools --max-results 10 | grep collectiq-hackathon

# Test Cognito Hosted UI (open in browser)
echo $(terraform output -raw cognito_hosted_ui_domain)/login
```

## Estimated Cost

~$20-50/month:

- S3: $1-2
- DynamoDB: $5-10
- API Gateway: $3-5
- Lambda: $5-10 (when deployed)
- Amplify: $5-10
- Other: $2-5

## Troubleshooting

### State backend doesn't exist

```bash
cd ../../prereq
terraform apply
cd ../envs/hackathon
```

### Permission errors

Ensure AWS credentials have permissions for:
S3, DynamoDB, Cognito, API Gateway, IAM, Secrets Manager, Budgets, Amplify

### Amplify deployment fails

Ensure `github_repo_url` is set in `terraform.tfvars`

## Cleanup

```bash
# Destroy all resources
terraform destroy
```

## Next Steps

1. Deploy Lambda functions (Task 4)
2. Configure Step Functions (Task 5)
3. Set up CloudWatch monitoring (Task 6)
4. Configure CI/CD pipelines (Task 7)
5. Store external API keys (Task 8)

## Documentation

- `README.md` - Complete environment documentation
- `DEPLOYMENT_GUIDE.md` - Detailed deployment instructions
- `TASK_3_COMPLETION.md` - Task completion summary
- `validate.sh` - Prerequisites validation script

## Support

For issues:

1. Run `./validate.sh` to check prerequisites
2. Review `DEPLOYMENT_GUIDE.md` for troubleshooting
3. Check AWS CloudWatch Logs for errors
4. Review Terraform plan output for warnings
