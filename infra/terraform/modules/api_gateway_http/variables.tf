variable "api_name" {
  description = "Name of the API Gateway"
  type        = string
}

variable "api_description" {
  description = "Description of the API Gateway"
  type        = string
  default     = ""
}

variable "stage_name" {
  description = "Name of the API Gateway stage"
  type        = string
  default     = "$default"
}

variable "cognito_user_pool_id" {
  description = "Cognito user pool ID for JWT authorizer"
  type        = string
  default     = ""
}

variable "cognito_user_pool_arn" {
  description = "Cognito user pool ARN for JWT authorizer"
  type        = string
  default     = ""
}

variable "cognito_client_id" {
  description = "Cognito client ID for JWT audience validation"
  type        = string
  default     = ""
}

variable "cors_allow_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["*"]
}

variable "cors_allow_methods" {
  description = "CORS allowed methods"
  type        = list(string)
  default     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}

variable "cors_allow_headers" {
  description = "CORS allowed headers"
  type        = list(string)
  default     = ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key", "X-Amz-Security-Token"]
}

variable "cors_expose_headers" {
  description = "CORS exposed headers"
  type        = list(string)
  default     = []
}

variable "cors_max_age" {
  description = "CORS max age in seconds"
  type        = number
  default     = 300
}

variable "cors_allow_credentials" {
  description = "CORS allow credentials"
  type        = bool
  default     = true
}

variable "throttling_burst_limit" {
  description = "Throttling burst limit"
  type        = number
  default     = 100
}

variable "throttling_rate_limit" {
  description = "Throttling rate limit (requests per second)"
  type        = number
  default     = 100
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "lambda_integrations" {
  description = "Map of Lambda integrations with route configurations"
  type = map(object({
    lambda_function_name = string
    lambda_invoke_arn    = string
    route_key            = string
    require_auth         = bool
  }))
  default = {}
}

variable "enable_xray_tracing" {
  description = "Enable X-Ray tracing for API Gateway"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
