variable "bus_name" {
  description = "Name of the EventBridge event bus"
  type        = string
}

variable "event_rules" {
  description = "Map of event rules with targets"
  type = map(object({
    description          = string
    event_pattern        = string
    target_arn           = string
    target_type          = string # "lambda" or "sqs"
    target_function_name = optional(string)
    input_transformer = optional(object({
      input_paths    = map(string)
      input_template = string
    }))
  }))
  default = {}
}

variable "dlq_message_retention_seconds" {
  description = "DLQ message retention in seconds"
  type        = number
  default     = 1209600 # 14 days
}

variable "retry_maximum_event_age" {
  description = "Maximum event age for retry in seconds"
  type        = number
  default     = 86400 # 24 hours
}

variable "retry_maximum_retry_attempts" {
  description = "Maximum retry attempts"
  type        = number
  default     = 3
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
