# Terraform Setup Guide

This guide walks through the initial setup of the CollectIQ Terraform infrastructure.

## Prerequisites

1. **Install Terraform** (version >= 1.1.7)

   ```bash
   # macOS (using Homebrew)
   brew tap hashicorp/tap
   brew install hashicorp/tap/terraform

   # Verify installation
   terraform --version
   ```

2. **Configure AWS CLI**

   ```bash
   # Install AWS CLI
   brew install awscli

   # Configure credentials
   aws configure
   # Enter your AWS Access Key ID
   # Enter your AWS Secret Access Key
   # Default region: us-east-1
   # Default output format: json

   # Verify configuration
   aws sts get-caller-identity
   ```

3. **Install Additional Tools** (optional but recommended)

   ```bash
   # tflint - Terraform linter
   brew install tflint

   # checkov - Security scanner
   brew install checkov

   # infracost - Cost estimation
   brew install infracost
   ```

## Step 1: Bootstrap State Management

Before deploying any infrastructure, you must create the S3 bucket and DynamoDB table for Terraform state management.

```bash
# Navigate to prereq directory
cd infra/terraform/prereq

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply the configuration
terraform apply
# Type 'yes' when prompted
```

This creates:

- **S3 Bucket**: `collectiq-tfstate`
  - Versioning enabled
  - Encryption enabled (AES-256)
  - Public access blocked
- **DynamoDB Table**: `collectiq-terraform-locks`
  - Used for state locking
  - Point-in-time recovery enabled

**Important**: This step only needs to be done once per AWS account.

## Step 2: Initialize Hackathon Environment

```bash
# Navigate to hackathon environment
cd ../envs/hackathon

# Copy example tfvars
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values (optional - defaults are configured)
# Update github_repo_url if you want to configure Amplify
nano terraform.tfvars

# Initialize Terraform with backend
terraform init

# Verify configuration
terraform validate

# Format code
terraform fmt

# Review the plan (should show minimal resources)
terraform plan

# Apply (creates account ID data source and local variables)
terraform apply
```

## Verification

After initialization, verify the setup:

```bash
# Check state is stored in S3
aws s3 ls s3://collectiq-tfstate/

# Should show:
# hackathon/terraform.tfstate

# Check DynamoDB table exists
aws dynamodb describe-table --table-name collectiq-terraform-locks

# Verify Terraform state
cd envs/hackathon
terraform state list

# Should show:
# data.aws_caller_identity.current
```

## Common Issues

### Issue: "Error acquiring the state lock"

**Solution**: Another Terraform process is running or crashed. Wait a few minutes or force unlock:

```bash
terraform force-unlock <LOCK_ID>
```

### Issue: "NoSuchBucket: The specified bucket does not exist"

**Solution**: Run the prereq setup first:

```bash
cd infra/terraform/prereq
terraform init
terraform apply
```

### Issue: "AccessDenied" errors

**Solution**: Verify AWS credentials have sufficient permissions:

```bash
aws sts get-caller-identity
```

Required IAM permissions:

- S3: CreateBucket, PutObject, GetObject, PutBucketVersioning
- DynamoDB: CreateTable, DescribeTable
- IAM: CreateRole, AttachRolePolicy (for future resources)

### Issue: "Backend configuration changed"

**Solution**: Reinitialize Terraform:

```bash
terraform init -reconfigure
```

## Next Steps

After completing the setup:

1. **Create Terraform Modules**: Implement modules in `modules/` directory
2. **Import Modules**: Add module blocks to `envs/hackathon/main.tf`
3. **Deploy Infrastructure**: Run `terraform apply` in the hackathon environment
4. **Configure CI/CD**: Set up GitHub Actions for automated validation and deployment

## State Management Best Practices

1. **Never commit state files**: They're in `.gitignore` and stored in S3
2. **Never commit `.tfvars` files**: They may contain sensitive data
3. **Always use state locking**: Prevents concurrent modifications
4. **Enable versioning**: Allows state recovery if corrupted
5. **Regular backups**: S3 versioning provides automatic backups
6. **Single environment**: Hackathon environment optimized for cost and simplicity

## Security Checklist

- [ ] AWS credentials configured with least-privilege IAM policy
- [ ] S3 bucket encryption enabled
- [ ] S3 bucket versioning enabled
- [ ] S3 public access blocked
- [ ] DynamoDB point-in-time recovery enabled
- [ ] `.tfvars` files in `.gitignore`
- [ ] State files never committed to git
- [ ] CloudTrail enabled for audit logging

## Support

For questions or issues:

- Review [Terraform Documentation](https://www.terraform.io/docs)
- Check [AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- Refer to [CollectIQ DevOps Specification](../../docs/DevOps/DevOps%20Project%20Specification.md)
- Contact DevOps team

## Cleanup (Use with Caution!)

To destroy all infrastructure:

```bash
# Destroy hackathon environment
cd envs/hackathon
terraform destroy

# Destroy state management (LAST STEP - cannot be undone easily!)
cd ../../prereq
terraform destroy
```

**Warning**: This will delete all resources including data in DynamoDB and S3. Always backup data before destroying infrastructure.
