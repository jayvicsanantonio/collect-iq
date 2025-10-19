variable "bucket_name" {
  description = "Name of the S3 bucket"
  type        = string
}

variable "enable_versioning" {
  description = "Enable S3 versioning"
  type        = bool
  default     = true
}

variable "cors_allowed_headers" {
  description = "CORS allowed headers"
  type        = list(string)
  default     = ["*"]
}

variable "cors_allowed_methods" {
  description = "CORS allowed methods"
  type        = list(string)
  default     = ["PUT", "POST", "GET"]
}

variable "cors_allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["*"]
}

variable "cors_expose_headers" {
  description = "CORS expose headers"
  type        = list(string)
  default     = ["ETag"]
}

variable "cors_max_age_seconds" {
  description = "CORS max age in seconds"
  type        = number
  default     = 3000
}

#variable "glacier_transition_days" {
#  description = "Days before transitioning to Glacier"
#  type        = number
#  default     = 90
#}

#variable "expiration_days" {
#  description = "Days before object expiration"
#  type        = number
#  default     = 365
#}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
