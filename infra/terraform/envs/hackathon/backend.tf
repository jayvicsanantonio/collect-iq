# Backend configuration for hackathon environment
# This file configures remote state storage in S3 with DynamoDB locking
# Run `terraform init` to initialize the backend

terraform {
  backend "s3" {
    bucket         = "collectiq-hackathon-tfstate"
    key            = "hackathon/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "collectiq-hackathon-terraform-locks"
  }
}
