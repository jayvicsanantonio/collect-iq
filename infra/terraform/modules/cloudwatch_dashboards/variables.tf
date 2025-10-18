variable "dashboard_prefix" {
  description = "Prefix for dashboard names"
  type        = string
}

variable "lambda_function_names" {
  description = "List of Lambda function names to monitor"
  type        = list(string)
  default     = []
}

variable "step_functions_state_machine_name" {
  description = "Name of the Step Functions state machine"
  type        = string
  default     = ""
}

variable "step_functions_state_machine_arn" {
  description = "ARN of the Step Functions state machine"
  type        = string
  default     = ""
}

variable "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  type        = string
  default     = ""
}

variable "s3_bucket_name" {
  description = "Name of the S3 bucket"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
