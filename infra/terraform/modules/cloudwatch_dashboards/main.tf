data "aws_region" "current" {}

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
    widgets = [
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
          region  = data.aws_region.current.name
          title   = "Authenticity Score Distribution"
        }
      }
    ]
  })
}
