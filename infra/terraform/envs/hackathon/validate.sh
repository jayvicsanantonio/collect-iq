#!/bin/bash
# Validation script for hackathon environment deployment
# This script checks prerequisites and validates configuration before deployment

set -e

echo "=========================================="
echo "CollectIQ Hackathon Environment Validator"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track validation status
VALIDATION_PASSED=true

# Function to print success message
success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print error message
error() {
    echo -e "${RED}✗${NC} $1"
    VALIDATION_PASSED=false
}

# Function to print warning message
warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to print info message
info() {
    echo "ℹ $1"
}

echo "1. Checking Prerequisites..."
echo "----------------------------"

# Check if Terraform is installed
if command -v terraform &> /dev/null; then
    TERRAFORM_VERSION=$(terraform version -json | grep -o '"terraform_version":"[^"]*' | cut -d'"' -f4)
    success "Terraform is installed (version: $TERRAFORM_VERSION)"
    
    # Check version requirement
    REQUIRED_VERSION="1.1.7"
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$TERRAFORM_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
        success "Terraform version meets requirement (>= $REQUIRED_VERSION)"
    else
        error "Terraform version $TERRAFORM_VERSION is below required version $REQUIRED_VERSION"
    fi
else
    error "Terraform is not installed"
fi

# Check if AWS CLI is installed
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1 | cut -d' ' -f1 | cut -d'/' -f2)
    success "AWS CLI is installed (version: $AWS_VERSION)"
else
    error "AWS CLI is not installed"
fi

echo ""
echo "2. Checking AWS Credentials..."
echo "------------------------------"

# Check AWS credentials
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
    success "AWS credentials are configured"
    info "Account ID: $ACCOUNT_ID"
    info "User/Role: $USER_ARN"
else
    error "AWS credentials are not configured or invalid"
fi

echo ""
echo "3. Checking State Backend..."
echo "----------------------------"

# Check if S3 bucket exists
if aws s3 ls s3://collectiq-tfstate &> /dev/null; then
    success "S3 state bucket exists (collectiq-tfstate)"
    
    # Check if versioning is enabled
    VERSIONING=$(aws s3api get-bucket-versioning --bucket collectiq-tfstate --query Status --output text 2>/dev/null || echo "Disabled")
    if [ "$VERSIONING" = "Enabled" ]; then
        success "S3 bucket versioning is enabled"
    else
        warning "S3 bucket versioning is not enabled"
    fi
else
    error "S3 state bucket does not exist (collectiq-tfstate)"
    info "Run: cd ../../prereq && terraform apply"
fi

# Check if DynamoDB table exists
if aws dynamodb describe-table --table-name collectiq-terraform-locks &> /dev/null; then
    success "DynamoDB lock table exists (collectiq-terraform-locks)"
else
    error "DynamoDB lock table does not exist (collectiq-terraform-locks)"
    info "Run: cd ../../prereq && terraform apply"
fi

echo ""
echo "4. Checking Configuration Files..."
echo "----------------------------------"

# Check if terraform.tfvars exists
if [ -f "terraform.tfvars" ]; then
    success "terraform.tfvars file exists"
    
    # Check if github_repo_url is set
    if grep -q 'github_repo_url.*=.*""' terraform.tfvars; then
        warning "github_repo_url is empty in terraform.tfvars"
        info "Amplify hosting will not be deployed without a repository URL"
    elif grep -q 'github_repo_url' terraform.tfvars; then
        REPO_URL=$(grep 'github_repo_url' terraform.tfvars | cut -d'=' -f2 | tr -d ' "')
        success "github_repo_url is configured: $REPO_URL"
    else
        warning "github_repo_url is not set in terraform.tfvars"
    fi
    
    # Check if budget_email_addresses is set
    if grep -q 'budget_email_addresses.*=.*\[\]' terraform.tfvars; then
        warning "budget_email_addresses is empty in terraform.tfvars"
        info "Budget alerts will not be sent without email addresses"
    elif grep -q 'budget_email_addresses' terraform.tfvars; then
        success "budget_email_addresses is configured"
    fi
else
    error "terraform.tfvars file does not exist"
    info "Run: cp terraform.tfvars.example terraform.tfvars"
fi

# Check if main.tf exists
if [ -f "main.tf" ]; then
    success "main.tf file exists"
else
    error "main.tf file does not exist"
fi

# Check if variables.tf exists
if [ -f "variables.tf" ]; then
    success "variables.tf file exists"
else
    error "variables.tf file does not exist"
fi

# Check if outputs.tf exists
if [ -f "outputs.tf" ]; then
    success "outputs.tf file exists"
else
    error "outputs.tf file does not exist"
fi

# Check if backend.tf exists
if [ -f "backend.tf" ]; then
    success "backend.tf file exists"
else
    error "backend.tf file does not exist"
fi

# Check if provider.tf exists
if [ -f "provider.tf" ]; then
    success "provider.tf file exists"
else
    error "provider.tf file does not exist"
fi

echo ""
echo "5. Validating Terraform Configuration..."
echo "----------------------------------------"

# Check if Terraform is initialized
if [ -d ".terraform" ]; then
    success "Terraform is initialized"
else
    warning "Terraform is not initialized"
    info "Run: terraform init"
fi

# Validate Terraform configuration (if Terraform is available)
if command -v terraform &> /dev/null; then
    if terraform validate &> /dev/null; then
        success "Terraform configuration is valid"
    else
        error "Terraform configuration has errors"
        info "Run: terraform validate"
    fi
    
    # Check formatting
    if terraform fmt -check -recursive &> /dev/null; then
        success "Terraform code is properly formatted"
    else
        warning "Terraform code needs formatting"
        info "Run: terraform fmt -recursive"
    fi
fi

echo ""
echo "6. Checking Module Dependencies..."
echo "----------------------------------"

# Check if required modules exist
MODULES=(
    "amplify_hosting"
    "api_gateway_http"
    "cognito_user_pool"
    "dynamodb_collectiq"
    "s3_uploads"
    "lambda_fn"
    "step_functions"
    "eventbridge_bus"
    "rekognition_access"
    "bedrock_access"
    "cloudwatch_dashboards"
    "ssm_secrets"
)

for module in "${MODULES[@]}"; do
    if [ -d "../../modules/$module" ]; then
        success "Module exists: $module"
    else
        error "Module missing: $module"
    fi
done

echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="

if [ "$VALIDATION_PASSED" = true ]; then
    echo -e "${GREEN}✓ All validations passed!${NC}"
    echo ""
    echo "You can proceed with deployment:"
    echo "  1. terraform init"
    echo "  2. terraform plan"
    echo "  3. terraform apply"
else
    echo -e "${RED}✗ Some validations failed${NC}"
    echo ""
    echo "Please fix the errors above before deploying."
    exit 1
fi

echo ""
