# Creates an S3 Bucket to store Terraform State & DynamoDB for Terraform State Lock.
# This must be run first before initializing dev/prod environments

module "prereq" {
  source        = "../modules/prereq"
  bucket_name   = "collectiq-hackathon-tfstate"
  dynamodb_name = "collectiq-hackathon-terraform-locks"
}
