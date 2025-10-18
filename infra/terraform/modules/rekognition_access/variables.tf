variable "policy_name" {
  description = "Name of the IAM policy"
  type        = string
  default     = "RekognitionAccessPolicy"
}

variable "policy_description" {
  description = "Description of the IAM policy"
  type        = string
  default     = "IAM policy for Amazon Rekognition access and S3 read permissions"
}

variable "uploads_bucket_arn" {
  description = "ARN of the uploads S3 bucket"
  type        = string
}

variable "samples_bucket_arn" {
  description = "ARN of the authentic samples S3 bucket (optional)"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
