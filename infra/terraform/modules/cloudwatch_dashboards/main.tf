data "aws_region" "current" {}

locals {
  # OCR Reasoning widgets for AI Services dashboard
  ocr_reasoning_widgets = var.ocr_reasoning_lambda_name != "" ? [
    {
      type = "metric"
      properties = {
        metrics = [
          ["CollectIQ/${var.dashboard_prefix}", "BedrockOcrLatency", "agent", "ocr-reasoning", { stat = "Average", label = "Average Latency" }],
          ["...", { stat = "p95", label = "P95 Latency" }],
          ["...", { stat = "p99", label = "P99 Latency" }]
        ]
        view   = "timeSeries"
        region = data.aws_region.current.name
        title  = "OCR Reasoning Latency"
        period = 300
        yAxis = {
          left = {
            label = "Milliseconds"
          }
        }
      }
    },
    {
      type = "metric"
      properties = {
        metrics = [
          ["CollectIQ/${var.dashboard_prefix}", "BedrockOcrConfidence", "agent", "ocr-reasoning", { stat = "Average", label = "Average Confidence" }],
          ["...", { stat = "Minimum", label = "Min Confidence" }]
        ]
        view   = "timeSeries"
        region = data.aws_region.current.name
        title  = "OCR Reasoning Confidence Scores"
        period = 300
        yAxis = {
          left = {
            label = "Confidence (0.0-1.0)"
            min   = 0
            max   = 1
          }
        }
      }
    },
    {
      type = "metric"
      properties = {
        metrics = [
          ["CollectIQ/${var.dashboard_prefix}", "BedrockOcrInputTokens", "agent", "ocr-reasoning", { stat = "Average", label = "Input Tokens" }],
          [".", "BedrockOcrOutputTokens", ".", ".", { stat = "Average", label = "Output Tokens" }]
        ]
        view   = "timeSeries"
        region = data.aws_region.current.name
        title  = "OCR Reasoning Token Usage"
        period = 300
        yAxis = {
          left = {
            label = "Token Count"
          }
        }
      }
    },
    {
      type = "metric"
      properties = {
        metrics = [
          ["CollectIQ/${var.dashboard_prefix}", "BedrockOcrFallbackUsed", "agent", "ocr-reasoning", { stat = "Sum", label = "Fallback Count" }]
        ]
        view   = "timeSeries"
        region = data.aws_region.current.name
        title  = "OCR Reasoning Fallback Usage"
        period = 300
      }
    }
  ] : []
}

# API Performance Dashboard
resource "aws_cloudwatch_dashboard" "api_performance" {
  dashboard_name = "${var.dashboard_prefix}-api-performance"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApiGateway", "4XXError", { stat = "Sum", label = "4xx Errors" }],
            [".", "5XXError", { stat = "Sum", label = "5xx Errors" }],
            [".", "Count", { stat = "Sum", label = "Total Requests" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "API Gateway Error Rates"
          period  = 300
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Latency", { stat = "Average", label = "Average" }],
            ["...", { stat = "p50", label = "P50" }],
            ["...", { stat = "p95", label = "P95" }],
            ["...", { stat = "p99", label = "P99" }]
          ]
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "API Gateway Latency"
          period = 300
          yAxis = {
            left = {
              label = "Milliseconds"
            }
          }
        }
      }
    ]
  })
}

# Lambda Performance Dashboard
resource "aws_cloudwatch_dashboard" "lambda_performance" {
  dashboard_name = "${var.dashboard_prefix}-lambda-performance"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            for fn in var.lambda_function_names : [
              "AWS/Lambda", "Invocations", "FunctionName", fn, { stat = "Sum", label = fn }
            ]
          ]
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "Lambda Invocations"
          period = 300
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            for fn in var.lambda_function_names : [
              "AWS/Lambda", "Errors", "FunctionName", fn, { stat = "Sum", label = fn }
            ]
          ]
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "Lambda Errors"
          period = 300
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            for fn in var.lambda_function_names : [
              "AWS/Lambda", "Duration", "FunctionName", fn, { stat = "Average", label = fn }
            ]
          ]
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "Lambda Duration (Average)"
          period = 300
          yAxis = {
            left = {
              label = "Milliseconds"
            }
          }
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            for fn in var.lambda_function_names : [
              "AWS/Lambda", "Throttles", "FunctionName", fn, { stat = "Sum", label = fn }
            ]
          ]
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "Lambda Throttles"
          period = 300
        }
      }
    ]
  })
}

# Step Functions Dashboard
resource "aws_cloudwatch_dashboard" "step_functions" {
  count = var.step_functions_state_machine_name != "" ? 1 : 0

  dashboard_name = "${var.dashboard_prefix}-step-functions"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/States", "ExecutionsStarted", "StateMachineArn", var.step_functions_state_machine_arn, { stat = "Sum", label = "Started" }],
            [".", "ExecutionsSucceeded", ".", ".", { stat = "Sum", label = "Succeeded" }],
            [".", "ExecutionsFailed", ".", ".", { stat = "Sum", label = "Failed" }],
            [".", "ExecutionsTimedOut", ".", ".", { stat = "Sum", label = "Timed Out" }]
          ]
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "Step Functions Executions"
          period = 300
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/States", "ExecutionTime", "StateMachineArn", var.step_functions_state_machine_arn, { stat = "Average", label = "Average" }],
            ["...", { stat = "p95", label = "P95" }]
          ]
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "Step Functions Execution Time"
          period = 300
          yAxis = {
            left = {
              label = "Milliseconds"
            }
          }
        }
      }
    ]
  })
}

# Data Layer Dashboard (DynamoDB + S3)
resource "aws_cloudwatch_dashboard" "data_layer" {
  dashboard_name = "${var.dashboard_prefix}-data-layer"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = var.dynamodb_table_name != "" ? [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", var.dynamodb_table_name, { stat = "Sum", label = "Read Capacity" }],
            [".", "ConsumedWriteCapacityUnits", ".", ".", { stat = "Sum", label = "Write Capacity" }]
          ] : []
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "DynamoDB Capacity Units"
          period = 300
        }
      },
      {
        type = "metric"
        properties = {
          metrics = var.dynamodb_table_name != "" ? [
            ["AWS/DynamoDB", "UserErrors", "TableName", var.dynamodb_table_name, { stat = "Sum", label = "User Errors" }],
            [".", "SystemErrors", ".", ".", { stat = "Sum", label = "System Errors" }],
            [".", "ThrottledRequests", ".", ".", { stat = "Sum", label = "Throttled" }]
          ] : []
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "DynamoDB Errors and Throttles"
          period = 300
        }
      },
      {
        type = "metric"
        properties = {
          metrics = var.s3_bucket_name != "" ? [
            ["AWS/S3", "NumberOfObjects", "BucketName", var.s3_bucket_name, "StorageType", "AllStorageTypes", { stat = "Average", label = "Object Count" }]
          ] : []
          view   = "timeSeries"
          region = data.aws_region.current.name
          title  = "S3 Object Count"
          period = 86400
        }
      }
    ]
  })
}

# AI Services Dashboard (Rekognition + Bedrock)
resource "aws_cloudwatch_dashboard" "ai_services" {
  dashboard_name = "${var.dashboard_prefix}-ai-services"

  dashboard_body = jsonencode({
    widgets = concat(
      [
        {
          type = "metric"
          properties = {
            metrics = [
              ["AWS/Rekognition", "ResponseTime", { stat = "Average", label = "Rekognition Response Time" }],
              ["AWS/Bedrock", "Invocations", { stat = "Sum", label = "Bedrock Invocations" }]
            ]
            view   = "timeSeries"
            region = data.aws_region.current.name
            title  = "AI Services Usage"
            period = 300
          }
        },
        {
          type = "log"
          properties = {
            query   = <<-EOT
            SOURCE '/aws/lambda/${var.lambda_function_names[0]}'
            | fields @timestamp, @message
            | filter @message like /authenticityScore/
            | stats count() by bin(5m)
          EOT
            region = data.aws_region.current.name
            title  = "Authenticity Score Distribution"
          }
        }
      ],
      local.ocr_reasoning_widgets
    )
  })
}

# SNS Topic for OCR Reasoning Alarms
resource "aws_sns_topic" "ocr_reasoning_alarms" {
  count = var.ocr_reasoning_lambda_name != "" && var.alarm_sns_topic_arn == "" ? 1 : 0
  name  = "${var.dashboard_prefix}-ocr-reasoning-alarms"

  tags = var.tags
}

# CloudWatch Alarm: High Fallback Rate (>10%)
resource "aws_cloudwatch_metric_alarm" "ocr_high_fallback_rate" {
  count = var.ocr_reasoning_lambda_name != "" ? 1 : 0

  alarm_name          = "${var.dashboard_prefix}-ocr-high-fallback-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 10
  alarm_description   = "OCR reasoning fallback rate exceeds 10%"
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "fallback_rate"
    expression  = "(fallback_count / total_invocations) * 100"
    label       = "Fallback Rate (%)"
    return_data = true
  }

  metric_query {
    id = "fallback_count"
    metric {
      metric_name = "BedrockOcrFallbackUsed"
      namespace   = "CollectIQ/${var.dashboard_prefix}"
      period      = 300
      stat        = "Sum"
      dimensions = {
        agent = "ocr-reasoning"
      }
    }
  }

  metric_query {
    id = "total_invocations"
    metric {
      metric_name = "BedrockOcrLatency"
      namespace   = "CollectIQ/${var.dashboard_prefix}"
      period      = 300
      stat        = "SampleCount"
      dimensions = {
        agent = "ocr-reasoning"
      }
    }
  }

  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : (length(aws_sns_topic.ocr_reasoning_alarms) > 0 ? [aws_sns_topic.ocr_reasoning_alarms[0].arn] : [])

  tags = var.tags
}

# CloudWatch Alarm: High Latency (P95 >5 seconds)
resource "aws_cloudwatch_metric_alarm" "ocr_high_latency" {
  count = var.ocr_reasoning_lambda_name != "" ? 1 : 0

  alarm_name          = "${var.dashboard_prefix}-ocr-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 5000
  alarm_description   = "OCR reasoning P95 latency exceeds 5 seconds"
  treat_missing_data  = "notBreaching"

  metric_name = "BedrockOcrLatency"
  namespace   = "CollectIQ/${var.dashboard_prefix}"
  period      = 300
  extended_statistic = "p95"
  dimensions = {
    agent = "ocr-reasoning"
  }

  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : (length(aws_sns_topic.ocr_reasoning_alarms) > 0 ? [aws_sns_topic.ocr_reasoning_alarms[0].arn] : [])

  tags = var.tags
}

# CloudWatch Alarm: Low Confidence Scores (average <0.6)
resource "aws_cloudwatch_metric_alarm" "ocr_low_confidence" {
  count = var.ocr_reasoning_lambda_name != "" ? 1 : 0

  alarm_name          = "${var.dashboard_prefix}-ocr-low-confidence"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  threshold           = 0.6
  alarm_description   = "OCR reasoning average confidence score below 0.6"
  treat_missing_data  = "notBreaching"

  metric_name = "BedrockOcrConfidence"
  namespace   = "CollectIQ/${var.dashboard_prefix}"
  period      = 300
  statistic   = "Average"
  dimensions = {
    agent = "ocr-reasoning"
  }

  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : (length(aws_sns_topic.ocr_reasoning_alarms) > 0 ? [aws_sns_topic.ocr_reasoning_alarms[0].arn] : [])

  tags = var.tags
}

# CloudWatch Alarm: High Token Usage (average >3000 output tokens)
resource "aws_cloudwatch_metric_alarm" "ocr_high_token_usage" {
  count = var.ocr_reasoning_lambda_name != "" ? 1 : 0

  alarm_name          = "${var.dashboard_prefix}-ocr-high-token-usage"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 3000
  alarm_description   = "OCR reasoning average output token usage exceeds 3000"
  treat_missing_data  = "notBreaching"

  metric_name = "BedrockOcrOutputTokens"
  namespace   = "CollectIQ/${var.dashboard_prefix}"
  period      = 300
  statistic   = "Average"
  dimensions = {
    agent = "ocr-reasoning"
  }

  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : (length(aws_sns_topic.ocr_reasoning_alarms) > 0 ? [aws_sns_topic.ocr_reasoning_alarms[0].arn] : [])

  tags = var.tags
}
