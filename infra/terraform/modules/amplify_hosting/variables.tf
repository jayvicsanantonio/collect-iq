variable "app_name" {
  description = "Name of the Amplify application"
  type        = string
}

variable "repository" {
  description = "GitHub repository URL"
  type        = string
}

variable "access_token" {
  description = "GitHub personal access token for repository access"
  type        = string
  sensitive   = true
  default     = ""
}

variable "build_spec" {
  description = "Build specification for Next.js SSR/ISR"
  type        = string
}

variable "environment_variables" {
  description = "Environment variables for the Amplify app"
  type        = map(string)
  default     = {}
}

variable "main_branch_name" {
  description = "Name of the main branch"
  type        = string
  default     = "main"
}

variable "develop_branch_name" {
  description = "Name of the develop branch"
  type        = string
  default     = "develop"
}

variable "enable_develop_branch" {
  description = "Whether to create a develop branch"
  type        = bool
  default     = false
}

variable "enable_auto_branch_creation" {
  description = "Enable automatic branch creation for PR previews"
  type        = bool
  default     = true
}

variable "auto_branch_creation_patterns" {
  description = "Patterns for automatic branch creation"
  type        = list(string)
  default     = ["*", "pr*"]
}

variable "custom_domain" {
  description = "Custom domain for the Amplify app (empty string for default domain only)"
  type        = string
  default     = ""
}

variable "custom_domain_prefix" {
  description = "Subdomain prefix for custom domain"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
