variable "policy_name" {
  description = "Name of the IAM policy"
  type        = string
  default     = "BedrockAccessPolicy"
}

variable "policy_description" {
  description = "Description of the IAM policy"
  type        = string
  default     = "IAM policy for Amazon Bedrock model invocation"
}

variable "model_arns" {
  description = "List of Bedrock model ARNs to grant access to"
  type        = list(string)
  default     = []
}

variable "model_ids" {
  description = "List of Bedrock model IDs or inference profile IDs (will be converted to ARNs)"
  type        = list(string)
  default = [
    "us.anthropic.claude-sonnet-4-20250514-v1:0"  # Cross-region inference profile
  ]
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
