variable "function_name" {
  description = "Name of the Lambda function"
  type        = string
}

variable "description" {
  description = "Description of the Lambda function"
  type        = string
  default     = ""
}

variable "filename" {
  description = "Path to the Lambda deployment package"
  type        = string
}

variable "source_code_hash" {
  description = "Base64-encoded SHA256 hash of the package"
  type        = string
  default     = null
}

variable "handler" {
  description = "Lambda function handler"
  type        = string
  default     = "index.handler"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs20.x"
}

variable "architectures" {
  description = "Instruction set architecture"
  type        = list(string)
  default     = ["x86_64"]
}

variable "memory_size" {
  description = "Memory size in MB"
  type        = number
  default     = 512
}

variable "timeout" {
  description = "Timeout in seconds"
  type        = number
  default     = 30
}

variable "environment_variables" {
  description = "Environment variables"
  type        = map(string)
  default     = {}
}

variable "enable_xray_tracing" {
  description = "Enable X-Ray tracing"
  type        = bool
  default     = true
}

variable "vpc_subnet_ids" {
  description = "VPC subnet IDs (null for no VPC)"
  type        = list(string)
  default     = null
}

variable "vpc_security_group_ids" {
  description = "VPC security group IDs"
  type        = list(string)
  default     = []
}

variable "reserved_concurrent_executions" {
  description = "Reserved concurrent executions (-1 for unreserved)"
  type        = number
  default     = -1
}

variable "custom_iam_policy_json" {
  description = "Custom IAM policy JSON"
  type        = string
  default     = ""
}

variable "additional_policy_arns" {
  description = "Additional IAM policy ARNs to attach"
  type        = list(string)
  default     = []
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "create_alias" {
  description = "Create Lambda alias for blue/green deployments"
  type        = bool
  default     = false
}

variable "alias_name" {
  description = "Name of the Lambda alias"
  type        = string
  default     = "live"
}

variable "alias_function_version" {
  description = "Function version for alias"
  type        = string
  default     = "$LATEST"
}

variable "alias_routing_additional_version_weights" {
  description = "Map of version weights for canary/linear deployments"
  type        = map(number)
  default     = null
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
