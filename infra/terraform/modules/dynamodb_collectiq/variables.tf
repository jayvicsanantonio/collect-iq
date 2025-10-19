variable "table_name" {
  description = "Name of the DynamoDB table"
  type        = string
}

variable "billing_mode" {
  description = "Billing mode (PROVISIONED or PAY_PER_REQUEST)"
  type        = string
  default     = "PAY_PER_REQUEST"

  validation {
    condition     = contains(["PROVISIONED", "PAY_PER_REQUEST"], var.billing_mode)
    error_message = "Billing mode must be PROVISIONED or PAY_PER_REQUEST"
  }
}

variable "gsi1_name" {
  description = "Name of GSI1 (userId + createdAt)"
  type        = string
  default     = "GSI1"
}

variable "gsi2_name" {
  description = "Name of GSI2 (setRarity + valueMedian)"
  type        = string
  default     = "GSI2"
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery"
  type        = bool
  default     = true
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption (empty for AWS managed key)"
  type        = string
  default     = ""
}

variable "ttl_attribute" {
  description = "Attribute name for TTL"
  type        = string
  default     = "ttl"
}

variable "enable_ttl" {
  description = "Enable TTL for automatic expiration"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
