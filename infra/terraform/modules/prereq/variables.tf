variable "bucket_name" {
  description = "Name of S3 bucket"
  type        = string
  default     = "collectiq-tfstate-s3"
}

variable "dynamodb_name" {
  description = "Name of S3 bucket"
  type        = string
  default     = "collectiq-tfstate-ddb"
}


