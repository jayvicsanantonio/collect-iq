# Backend configuration for prod environment
# This file configures remote state storage in S3 with DynamoDB locking
# Run `terraform init` to initialize the backend

terraform {
  backend "s3" {
    bucket         = "collectiq-tfstate"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "collectiq-terraform-locks"
  }
}
