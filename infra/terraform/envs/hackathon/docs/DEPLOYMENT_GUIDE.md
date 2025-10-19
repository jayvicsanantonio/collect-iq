# Hackathon Environment Deployment Guide

This guide provides step-by-step instructions for deploying the CollectIQ hackathon environment infrastructure.

## Prerequisites

Before deploying, ensure you have:

1. **Terraform** >= 1.1.7 installed
2. **AWS CLI** configured with valid credentials
3. **AWS Account** with appropriate permissions
4. **State Backend** (S3 bucket and DynamoDB table) created

## Pre-Deployment Checklist

### 1. Verify AWS Credentials

```bash
aws sts get-caller-identity
```

Expected output should show your AWS account ID and user/role ARN.

### 2. Ensure State Backend Exists

The state backend must be created before initializing the hackathon environment:

```bash
cd infra/terraform/prereq
terraform init
terraform plan
terraform apply
```

This creates:

- S3 bucket: `collectiq-tfstate` (with versioning and encryption)
- DynamoDB table: `collectiq-terraform-locks`

### 3. Configure Variables

Navigate to the hackathon environment directory:

```bash
cd infra/terraform/envs/hackathon
```

The `terraform.tfvars` file has been created with default values. Update the following:

```hcl
# REQUIRED: Add your GitHub repository URL for Amplify
github_repo_url = "https://github.com/your-org/collect-iq"

# OPTIONAL: Add email addresses for budget alerts
budget_email_addresses = ["devops@example.com"]
```

## Deployment Steps

### Step 1: Initialize Terraform

Initialize the Terraform backend and download required providers:

```bash
terraform init
```

Expected output:

```
Initializing the backend...
Successfully configured the backend "s3"!
Initializing provider plugins...
Terraform has been successfully initialized!
```

### Step 2: Validate Configuration

Validate the Terraform configuration syntax:

```bash
terraform validate
```

Expected output:

```
Success! The configuration is valid.
```

### Step 3: Format Code

Ensure consistent formatting:

```bash
terraform fmt -recursive
```

### Step 4: Plan Infrastructure Changes

Review the infrastructure that will be created:

```bash
terraform plan
```

This will show:

- Resources to be created
- Estimated costs (if using cost estimation tools)
- Any potential issues

Review the plan carefully. Expected resources include:

- 1 S3 bucket (uploads)
- 1 DynamoDB table (cards)
- 1 Cognito user pool
- 1 Cognito user pool client
- 1 Cognito user pool domain
- 1 API Gateway HTTP API
- 1 EventBridge event bus
- 1 SQS queue (DLQ)
- 3 Secrets Manager secrets
- 2 IAM policies (Rekognition, Bedrock)
- 1 AWS Budget
- 1 Amplify app (if github_repo_url is configured)

### Step 5: Apply Configuration

Deploy the infrastructure:

```bash
terraform apply
```

Review the plan one more time, then type `yes` when prompted.

Deployment typically takes 5-10 minutes. You'll see progress as resources are created.

### Step 6: Verify Outputs

After successful deployment, view the outputs:

```bash
terraform output
```

Save these outputs - they're needed for configuring the frontend and backend applications.

Key outputs to note:

- `api_base_url`: Use in frontend environment variables
- `cognito_user_pool_id`: Use in frontend environment variables
- `cognito_client_id`: Use in frontend environment variables
- `cognito_hosted_ui_domain`: Use for OAuth configuration
- `amplify_default_domain`: Your frontend URL
- `s3_uploads_bucket`: Use in backend Lambda functions
- `dynamodb_table_name`: Use in backend Lambda functions

## Post-Deployment Verification

### 1. Verify S3 Bucket

```bash
aws s3 ls | grep collectiq-hackathon-uploads
```

### 2. Verify DynamoDB Table

```bash
aws dynamodb describe-table --table-name collectiq-hackathon-cards
```

### 3. Verify Cognito User Pool

```bash
aws cognito-idp list-user-pools --max-results 10 | grep collectiq-hackathon
```

### 4. Verify API Gateway

```bash
aws apigatewayv2 get-apis | grep collectiq-hackathon
```

### 5. Test API Gateway Health Endpoint (when Lambda deployed)

```bash
curl https://<api-id>.execute-api.us-east-1.amazonaws.com/healthz
```

### 6. Test Cognito Hosted UI

Open the Cognito Hosted UI domain in a browser:

```
https://collectiq-hackathon.auth.us-east-1.amazoncognito.com/login?client_id=<client-id>&response_type=code&redirect_uri=http://localhost:3000/auth/callback
```

## Update Amplify Callback URLs

After Amplify deployment, update the Cognito callback URLs:

1. Get the Amplify default domain from outputs:

   ```bash
   terraform output amplify_default_domain
   ```

2. Update `main.tf` with the Amplify domain:

   ```hcl
   callback_urls = [
     "http://localhost:3000/auth/callback",
     "https://<amplify-domain>/auth/callback"
   ]

   logout_urls = [
     "http://localhost:3000",
     "https://<amplify-domain>"
   ]
   ```

3. Apply the changes:
   ```bash
   terraform apply
   ```

## Update CORS Origins

After Amplify deployment, restrict CORS to the Amplify domain:

1. Update `main.tf` for S3 and API Gateway:

   ```hcl
   # S3 CORS
   cors_allowed_origins = ["https://<amplify-domain>"]

   # API Gateway CORS
   cors_allow_origins = ["https://<amplify-domain>"]
   ```

2. Apply the changes:
   ```bash
   terraform apply
   ```

## Configure Frontend Environment Variables

Update `apps/web/.env.local` with Terraform outputs:

```bash
NEXT_PUBLIC_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<cognito_user_pool_id>
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=<cognito_client_id>
NEXT_PUBLIC_COGNITO_DOMAIN=<cognito_hosted_ui_domain>
NEXT_PUBLIC_API_BASE=<api_base_url>
```

## Configure Backend Environment Variables

Backend Lambda functions will receive environment variables automatically through Terraform when deployed in subsequent tasks.

## Monitoring and Alerts

### View CloudWatch Logs

```bash
aws logs describe-log-groups | grep collectiq-hackathon
```

### Check Budget Status

```bash
aws budgets describe-budgets --account-id <account-id>
```

### View Cost Explorer

Navigate to AWS Console > Cost Explorer to monitor spending.

## Troubleshooting

### Issue: Backend initialization fails

**Solution**: Ensure prereq resources are created:

```bash
cd ../../prereq
terraform apply
```

### Issue: State lock error

**Solution**: If state is locked and you're sure no other process is running:

```bash
terraform force-unlock <LOCK_ID>
```

### Issue: Permission denied errors

**Solution**: Verify your AWS credentials have the following permissions:

- S3: CreateBucket, PutObject, GetObject
- DynamoDB: CreateTable, DescribeTable
- Cognito: CreateUserPool, CreateUserPoolClient
- API Gateway: CreateApi, CreateRoute
- IAM: CreatePolicy, CreateRole
- Secrets Manager: CreateSecret
- Budgets: CreateBudget
- Amplify: CreateApp (if deploying frontend)

### Issue: Amplify deployment fails

**Solution**: Ensure `github_repo_url` is set in `terraform.tfvars` and you have GitHub repository access configured in AWS Amplify.

### Issue: Resource already exists

**Solution**: Import existing resource into Terraform state:

```bash
terraform import <resource_type>.<resource_name> <resource_id>
```

## Rollback Procedure

If deployment fails or you need to rollback:

### Option 1: Destroy and Recreate

```bash
terraform destroy
terraform apply
```

### Option 2: Revert to Previous State

```bash
# List state versions
aws s3api list-object-versions --bucket collectiq-tfstate --prefix hackathon/

# Download previous version
aws s3api get-object --bucket collectiq-tfstate --key hackathon/terraform.tfstate --version-id <version-id> terraform.tfstate.backup

# Restore state
terraform state push terraform.tfstate.backup

# Apply previous configuration
git checkout <previous-commit>
terraform apply
```

## Cost Estimation

Expected monthly costs for hackathon environment:

- **S3**: ~$1-2 (storage + requests)
- **DynamoDB**: ~$5-10 (on-demand, depends on usage)
- **Cognito**: Free tier (up to 50,000 MAUs)
- **API Gateway**: ~$3-5 (HTTP API, 1M requests)
- **Lambda**: ~$5-10 (depends on invocations)
- **Amplify**: ~$5-10 (build minutes + hosting)
- **Secrets Manager**: ~$1-2 (3 secrets)
- **CloudWatch**: ~$2-5 (logs + metrics)
- **EventBridge**: ~$1 (custom events)

**Total**: ~$20-50/month (within budget)

## Next Steps

After successful deployment:

1. **Deploy Lambda Functions** (Task 4)
2. **Configure Step Functions** (Task 5)
3. **Set Up CloudWatch Monitoring** (Task 6)
4. **Configure CI/CD Pipelines** (Task 7)
5. **Store External API Keys** (Task 8)
6. **Test End-to-End Flow** (Task 13)

## State Management

### View State

```bash
terraform show
```

### List Resources

```bash
terraform state list
```

### Inspect Specific Resource

```bash
terraform state show module.cognito_user_pool.aws_cognito_user_pool.pool
```

### Backup State

```bash
terraform state pull > terraform.tfstate.backup
```

## Cleanup

To destroy all resources (use with caution):

```bash
terraform destroy
```

This will:

- Delete all AWS resources
- Preserve the state file in S3
- NOT delete the state backend (S3 bucket and DynamoDB table)

To completely clean up including state backend:

```bash
# Destroy hackathon environment
terraform destroy

# Destroy state backend
cd ../../prereq
terraform destroy
```

## Support

For issues or questions:

1. Check AWS CloudWatch Logs for error messages
2. Review Terraform plan output for warnings
3. Consult AWS documentation for service-specific issues
4. Check GitHub repository issues

## References

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [Amazon Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)
