variable "state_machine_name" {
  description = "Name of the Step Functions state machine"
  type        = string
}

variable "definition" {
  description = "Amazon States Language (ASL) definition"
  type        = string
}

variable "state_machine_type" {
  description = "Type of state machine (STANDARD or EXPRESS)"
  type        = string
  default     = "STANDARD"

  validation {
    condition     = contains(["STANDARD", "EXPRESS"], var.state_machine_type)
    error_message = "State machine type must be STANDARD or EXPRESS"
  }
}

variable "lambda_function_arns" {
  description = "List of Lambda function ARNs to grant invoke permissions"
  type        = list(string)
  default     = []
}

variable "custom_iam_policy_json" {
  description = "Custom IAM policy JSON for additional permissions"
  type        = string
  default     = ""
}

variable "enable_xray_tracing" {
  description = "Enable X-Ray tracing"
  type        = bool
  default     = true
}

variable "log_level" {
  description = "CloudWatch Logs level (ALL, ERROR, FATAL, OFF)"
  type        = string
  default     = "ERROR"

  validation {
    condition     = contains(["ALL", "ERROR", "FATAL", "OFF"], var.log_level)
    error_message = "Log level must be ALL, ERROR, FATAL, or OFF"
  }
}

variable "log_include_execution_data" {
  description = "Include execution data in CloudWatch Logs"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
