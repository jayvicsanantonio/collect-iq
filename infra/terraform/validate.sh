#!/bin/bash

# Terraform Validation Script
# This script validates the Terraform configuration across all environments

set -e

echo "🔍 CollectIQ Terraform Validation"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform is not installed${NC}"
    echo "Install with: brew install hashicorp/tap/terraform"
    exit 1
fi

echo -e "${GREEN}✅ Terraform installed:${NC} $(terraform version | head -n1)"
echo ""

# Check if AWS CLI is configured
if ! command -v aws &> /dev/null; then
    echo -e "${YELLOW}⚠️  AWS CLI is not installed${NC}"
    echo "Install with: brew install awscli"
else
    echo -e "${GREEN}✅ AWS CLI installed${NC}"
    if aws sts get-caller-identity &> /dev/null; then
        echo -e "${GREEN}✅ AWS credentials configured${NC}"
        aws sts get-caller-identity --query 'Account' --output text | xargs echo "   Account ID:"
    else
        echo -e "${RED}❌ AWS credentials not configured${NC}"
        echo "Run: aws configure"
    fi
fi
echo ""

# Function to validate environment
validate_env() {
    local env=$1
    local env_path="envs/$env"
    
    echo "📁 Validating $env environment..."
    
    if [ ! -d "$env_path" ]; then
        echo -e "${RED}❌ Directory not found: $env_path${NC}"
        return 1
    fi
    
    # Check required files
    local required_files=("backend.tf" "provider.tf" "main.tf" "variables.tf" "outputs.tf")
    for file in "${required_files[@]}"; do
        if [ -f "$env_path/$file" ]; then
            echo -e "${GREEN}✅ $file exists${NC}"
        else
            echo -e "${RED}❌ $file missing${NC}"
            return 1
        fi
    done
    
    # Check if tfvars example exists
    if [ -f "$env_path/terraform.tfvars.example" ]; then
        echo -e "${GREEN}✅ terraform.tfvars.example exists${NC}"
    else
        echo -e "${YELLOW}⚠️  terraform.tfvars.example missing${NC}"
    fi
    
    # Check if tfvars exists (should not be committed)
    if [ -f "$env_path/terraform.tfvars" ]; then
        echo -e "${YELLOW}⚠️  terraform.tfvars exists (should not be committed)${NC}"
    fi
    
    # Validate Terraform configuration
    cd "$env_path"
    
    if terraform fmt -check -recursive > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Terraform formatting is correct${NC}"
    else
        echo -e "${YELLOW}⚠️  Terraform formatting issues found${NC}"
        echo "   Run: terraform fmt -recursive"
    fi
    
    if terraform validate > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Terraform configuration is valid${NC}"
    else
        echo -e "${RED}❌ Terraform validation failed${NC}"
        terraform validate
        cd ../..
        return 1
    fi
    
    cd ../..
    echo ""
}

# Validate prereq
echo "📁 Validating prereq infrastructure..."
if [ -d "prereq" ]; then
    echo -e "${GREEN}✅ prereq directory exists${NC}"
    if [ -f "prereq/main.tf" ] && [ -f "prereq/provider.tf" ]; then
        echo -e "${GREEN}✅ prereq configuration files exist${NC}"
    else
        echo -e "${RED}❌ prereq configuration files missing${NC}"
    fi
else
    echo -e "${RED}❌ prereq directory not found${NC}"
fi
echo ""

# Validate modules
echo "📁 Validating modules..."
if [ -d "modules" ]; then
    echo -e "${GREEN}✅ modules directory exists${NC}"
    module_count=$(find modules -maxdepth 1 -type d | wc -l)
    echo "   Found $((module_count - 1)) modules"
else
    echo -e "${RED}❌ modules directory not found${NC}"
fi
echo ""

# Validate environments
validate_env "dev"
validate_env "prod"

# Check .gitignore
echo "📁 Validating .gitignore..."
if grep -q "*.tfstate" ../../.gitignore; then
    echo -e "${GREEN}✅ .gitignore includes Terraform files${NC}"
else
    echo -e "${YELLOW}⚠️  .gitignore may not include Terraform files${NC}"
fi
echo ""

# Check for optional tools
echo "🔧 Checking optional tools..."
if command -v tflint &> /dev/null; then
    echo -e "${GREEN}✅ tflint installed${NC}"
else
    echo -e "${YELLOW}⚠️  tflint not installed (optional)${NC}"
    echo "   Install with: brew install tflint"
fi

if command -v checkov &> /dev/null; then
    echo -e "${GREEN}✅ checkov installed${NC}"
else
    echo -e "${YELLOW}⚠️  checkov not installed (optional)${NC}"
    echo "   Install with: brew install checkov"
fi

if command -v infracost &> /dev/null; then
    echo -e "${GREEN}✅ infracost installed${NC}"
else
    echo -e "${YELLOW}⚠️  infracost not installed (optional)${NC}"
    echo "   Install with: brew install infracost"
fi
echo ""

# Summary
echo "=================================="
echo -e "${GREEN}✅ Validation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run prereq setup: cd prereq && terraform init && terraform apply"
echo "2. Initialize dev: cd envs/dev && terraform init"
echo "3. Initialize prod: cd envs/prod && terraform init"
echo ""
echo "For detailed setup instructions, see SETUP.md"
