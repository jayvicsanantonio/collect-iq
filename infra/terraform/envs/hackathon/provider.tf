# AWS Provider configuration for hackathon environment

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "CollectIQ"
      Environment = var.environment
      Owner       = "DevOps"
      ManagedBy   = "Terraform"
    }
  }
}

terraform {
  required_version = ">= 1.1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.16.0"
    }
  }
}
