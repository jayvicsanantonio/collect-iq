variable "secrets" {
  description = "Map of secrets to create"
  type = map(object({
    name          = string
    description   = string
    initial_value = optional(string)
  }))
  default = {}
}

variable "policy_name" {
  description = "Name of the IAM policy for reading secrets"
  type        = string
  default     = "SecretsManagerReadPolicy"
}

variable "policy_description" {
  description = "Description of the IAM policy"
  type        = string
  default     = "IAM policy for reading secrets from AWS Secrets Manager"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
