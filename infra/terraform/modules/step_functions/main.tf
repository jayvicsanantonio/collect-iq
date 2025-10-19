resource "aws_sfn_state_machine" "state_machine" {
  name     = var.state_machine_name
  role_arn = aws_iam_role.step_functions_role.arn

  definition = var.definition

  type = var.state_machine_type

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.step_functions_logs.arn}:*"
    include_execution_data = var.log_include_execution_data
    level                  = var.log_level
  }

  tracing_configuration {
    enabled = var.enable_xray_tracing
  }

  tags = var.tags
}

# Step Functions execution role
resource "aws_iam_role" "step_functions_role" {
  name               = "${var.state_machine_name}-role"
  assume_role_policy = data.aws_iam_policy_document.step_functions_assume_role.json

  tags = var.tags
}

data "aws_iam_policy_document" "step_functions_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

# Policy to invoke Lambda functions
resource "aws_iam_role_policy" "invoke_lambda" {
  count = length(var.lambda_function_arns) > 0 ? 1 : 0

  name = "${var.state_machine_name}-invoke-lambda"
  role = aws_iam_role.step_functions_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = var.lambda_function_arns
      }
    ]
  })
}

# Policy for CloudWatch Logs
resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "${var.state_machine_name}-cloudwatch-logs"
  role = aws_iam_role.step_functions_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      }
    ]
  })
}

# Policy for X-Ray tracing
resource "aws_iam_role_policy" "xray" {
  count = var.enable_xray_tracing ? 1 : 0

  name = "${var.state_machine_name}-xray"
  role = aws_iam_role.step_functions_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets"
        ]
        Resource = "*"
      }
    ]
  })
}

# Custom IAM policies
resource "aws_iam_role_policy" "custom_policy" {
  count = var.custom_iam_policy_json != "" ? 1 : 0

  name   = "${var.state_machine_name}-custom-policy"
  role   = aws_iam_role.step_functions_role.id
  policy = var.custom_iam_policy_json
}

# CloudWatch Logs for execution history
resource "aws_cloudwatch_log_group" "step_functions_logs" {
  name              = "/aws/vendedlogs/states/${var.state_machine_name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}
