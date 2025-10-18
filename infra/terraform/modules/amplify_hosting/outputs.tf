output "app_id" {
  description = "Amplify app ID"
  value       = aws_amplify_app.app.id
}

output "default_domain" {
  description = "Default Amplify domain"
  value       = aws_amplify_app.app.default_domain
}

output "custom_domain" {
  description = "Custom domain (if configured)"
  value       = var.custom_domain != "" ? var.custom_domain : ""
}

output "main_branch_url" {
  description = "URL for the main branch"
  value       = "https://${aws_amplify_branch.main.branch_name}.${aws_amplify_app.app.default_domain}"
}

output "app_arn" {
  description = "Amplify app ARN"
  value       = aws_amplify_app.app.arn
}

output "webhook_url" {
  description = "Webhook URL to trigger builds"
  value       = aws_amplify_webhook.main.url
  sensitive   = true
}
