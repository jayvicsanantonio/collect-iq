# CloudWatch Monitoring Configuration for Hackathon Environment
# This file defines dashboards, alarms, and X-Ray tracing

# ============================================================================
# CloudWatch Dashboards
# ============================================================================

module "cloudwatch_dashboards" {
  source = "../../modules/cloudwatch_dashboards"

  dashboard_prefix = local.name_prefix

  # Lambda function names for monitoring
  lambda_function_names = [
    module.lambda_upload_presign.function_name,
    module.lambda_cards_create.function_name,
    module.lambda_cards_list.function_name,
    module.lambda_cards_get.function_name,
    module.lambda_cards_delete.function_name,
    module.lambda_cards_revalue.function_name,
    module.lambda_rekognition_extract.function_name,
    module.lambda_pricing_agent.function_name,
    module.lambda_authenticity_agent.function_name,
    module.lambda_aggregator.function_name,
    module.lambda_error_handler.function_name
  ]

  # Step Functions state machine
  step_functions_state_machine_name = module.step_functions.state_machine_name
  step_functions_state_machine_arn  = module.step_functions.state_machine_arn

  # DynamoDB table
  dynamodb_table_name = module.dynamodb_collectiq.table_name

  # S3 bucket
  s3_bucket_name = module.s3_uploads.bucket_name

  tags = local.common_tags
}

# ============================================================================
# SNS Topic for Alarm Notifications
# ============================================================================

resource "aws_sns_topic" "cloudwatch_alarms" {
  name = "${local.name_prefix}-cloudwatch-alarms"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-cloudwatch-alarms"
    }
  )
}

resource "aws_sns_topic_subscription" "cloudwatch_alarms_email" {
  count = length(var.alarm_email_addresses) > 0 ? length(var.alarm_email_addresses) : 0

  topic_arn = aws_sns_topic.cloudwatch_alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email_addresses[count.index]
}

# ============================================================================
# CloudWatch Alarms - API Gateway
# ============================================================================

# Note: API Gateway alarms will be added when API Gateway is deployed
# Required alarms:
# - API 5xx rate > 5% for 5 minutes
# - API P95 latency > 1000ms for 10 minutes
# - API 4xx rate (optional, for monitoring client errors)
#
# Example implementation:
# resource "aws_cloudwatch_metric_alarm" "api_5xx_rate" {
#   alarm_name          = "${local.name_prefix}-api-5xx-rate-high"
#   comparison_operator = "GreaterThanThreshold"
#   evaluation_periods  = 1
#   threshold           = 5
#   alarm_description   = "API Gateway 5xx error rate > 5% for 5 minutes"
#   treat_missing_data  = "notBreaching"
#
#   metric_query {
#     id          = "error_rate"
#     expression  = "(errors / requests) * 100"
#     label       = "5xx Error Rate (%)"
#     return_data = true
#   }
#
#   metric_query {
#     id = "errors"
#     metric {
#       metric_name = "5XXError"
#       namespace   = "AWS/ApiGateway"
#       period      = 300
#       stat        = "Sum"
#       dimensions = {
#         ApiId = module.api_gateway_http.api_id
#       }
#     }
#   }
#
#   metric_query {
#     id = "requests"
#     metric {
#       metric_name = "Count"
#       namespace   = "AWS/ApiGateway"
#       period      = 300
#       stat        = "Sum"
#       dimensions = {
#         ApiId = module.api_gateway_http.api_id
#       }
#     }
#   }
#
#   alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]
#   ok_actions    = [aws_sns_topic.cloudwatch_alarms.arn]
#
#   tags = local.common_tags
# }

# ============================================================================
# CloudWatch Alarms - Lambda Functions
# ============================================================================

# Lambda Error Rate Alarm (> 10% for 5 minutes)
resource "aws_cloudwatch_metric_alarm" "lambda_error_rate" {
  for_each = toset([
    module.lambda_upload_presign.function_name,
    module.lambda_cards_create.function_name,
    module.lambda_cards_list.function_name,
    module.lambda_cards_get.function_name,
    module.lambda_cards_delete.function_name,
    module.lambda_cards_revalue.function_name,
    module.lambda_rekognition_extract.function_name,
    module.lambda_pricing_agent.function_name,
    module.lambda_authenticity_agent.function_name,
    module.lambda_aggregator.function_name,
    module.lambda_error_handler.function_name
  ])

  alarm_name          = "${each.key}-error-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 10
  alarm_description   = "Lambda function ${each.key} error rate > 10% for 5 minutes"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]
  ok_actions    = [aws_sns_topic.cloudwatch_alarms.arn]

  metric_query {
    id          = "error_rate"
    expression  = "(errors / invocations) * 100"
    label       = "Error Rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      metric_name = "Errors"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions = {
        FunctionName = each.key
      }
    }
  }

  metric_query {
    id = "invocations"
    metric {
      metric_name = "Invocations"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions = {
        FunctionName = each.key
      }
    }
  }

  tags = local.common_tags
}

# Lambda Duration Alarm (approaching timeout)
resource "aws_cloudwatch_metric_alarm" "lambda_duration_high" {
  for_each = {
    # Heavy processing functions with 5-minute timeout
    "${module.lambda_rekognition_extract.function_name}" = 240000 # 4 minutes (80% of 5 min)
    "${module.lambda_pricing_agent.function_name}"       = 240000
    "${module.lambda_authenticity_agent.function_name}"  = 240000
  }

  alarm_name          = "${each.key}-duration-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Average"
  threshold           = each.value
  alarm_description   = "Lambda function ${each.key} duration approaching timeout"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.key
  }

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]

  tags = local.common_tags
}

# ============================================================================
# CloudWatch Alarms - Step Functions
# ============================================================================

# Step Functions Failed Executions Alarm (> 10 in 15 minutes)
resource "aws_cloudwatch_metric_alarm" "step_functions_failed_executions" {
  alarm_name          = "${local.name_prefix}-step-functions-failed-executions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ExecutionsFailed"
  namespace           = "AWS/States"
  period              = 900 # 15 minutes
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Step Functions failed executions > 10 in 15 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    StateMachineArn = module.step_functions.state_machine_arn
  }

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]
  ok_actions    = [aws_sns_topic.cloudwatch_alarms.arn]

  tags = local.common_tags
}

# Step Functions Timed Out Executions Alarm
resource "aws_cloudwatch_metric_alarm" "step_functions_timed_out" {
  alarm_name          = "${local.name_prefix}-step-functions-timed-out"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ExecutionsTimedOut"
  namespace           = "AWS/States"
  period              = 900 # 15 minutes
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Step Functions timed out executions > 5 in 15 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    StateMachineArn = module.step_functions.state_machine_arn
  }

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]

  tags = local.common_tags
}

# ============================================================================
# CloudWatch Alarms - DynamoDB
# ============================================================================

# DynamoDB Throttled Requests Alarm
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  alarm_name          = "${local.name_prefix}-dynamodb-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ThrottledRequests"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "DynamoDB throttled requests detected"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = module.dynamodb_collectiq.table_name
  }

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]

  tags = local.common_tags
}

# DynamoDB System Errors Alarm
resource "aws_cloudwatch_metric_alarm" "dynamodb_system_errors" {
  alarm_name          = "${local.name_prefix}-dynamodb-system-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "SystemErrors"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "DynamoDB system errors detected"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = module.dynamodb_collectiq.table_name
  }

  alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]

  tags = local.common_tags
}

# ============================================================================
# CloudWatch Alarms - EventBridge DLQ
# ============================================================================

# Note: EventBridge DLQ alarms will be added when EventBridge is deployed
# Required alarm:
# - DLQ depth > 10 messages
#
# Example implementation:
# resource "aws_cloudwatch_metric_alarm" "eventbridge_dlq_depth" {
#   alarm_name          = "${local.name_prefix}-eventbridge-dlq-depth"
#   comparison_operator = "GreaterThanThreshold"
#   evaluation_periods  = 1
#   metric_name         = "ApproximateNumberOfMessagesVisible"
#   namespace           = "AWS/SQS"
#   period              = 300
#   statistic           = "Average"
#   threshold           = 10
#   alarm_description   = "EventBridge DLQ depth > 10 messages"
#   treat_missing_data  = "notBreaching"
#
#   dimensions = {
#     QueueName = module.eventbridge_bus.dlq_name
#   }
#
#   alarm_actions = [aws_sns_topic.cloudwatch_alarms.arn]
#   ok_actions    = [aws_sns_topic.cloudwatch_alarms.arn]
#
#   tags = local.common_tags
# }

# ============================================================================
# AWS Budget Alarm
# ============================================================================

resource "aws_budgets_budget" "hackathon" {
  name              = "${local.name_prefix}-monthly-budget"
  budget_type       = "COST"
  limit_amount      = tostring(var.budget_amount)
  limit_unit        = "USD"
  time_period_start = "2025-01-01_00:00"
  time_unit         = "MONTHLY"

  cost_filter {
    name = "TagKeyValue"
    values = [
      "user:Project$CollectIQ",
      "user:Environment$${var.environment}"
    ]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_email_addresses
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_email_addresses
  }

  tags = local.common_tags
}

# ============================================================================
# X-Ray Tracing Configuration
# ============================================================================

# X-Ray tracing is already enabled on:
# - All Lambda functions (via lambda_fn module with enable_xray_tracing = true)
# - Step Functions state machine (via step_functions module with enable_xray_tracing = true)
# - API Gateway will have X-Ray enabled when deployed

# No additional resources needed - X-Ray is configured at the service level
