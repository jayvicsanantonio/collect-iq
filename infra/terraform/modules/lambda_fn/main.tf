resource "aws_lambda_function" "function" {
  function_name = var.function_name
  description   = var.description
  role          = aws_iam_role.lambda_role.arn

  # Deployment package
  filename         = var.filename
  source_code_hash = var.source_code_hash
  handler          = var.handler
  runtime          = var.runtime
  architectures    = var.architectures

  # Resource configuration
  memory_size = var.memory_size
  timeout     = var.timeout

  # Environment variables
  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content {
      variables = var.environment_variables
    }
  }

  # X-Ray tracing
  tracing_config {
    mode = var.enable_xray_tracing ? "Active" : "PassThrough"
  }

  # VPC configuration (optional)
  dynamic "vpc_config" {
    for_each = var.vpc_subnet_ids != null ? [1] : []
    content {
      subnet_ids         = var.vpc_subnet_ids
      security_group_ids = var.vpc_security_group_ids
    }
  }

  # Reserved concurrent executions
  reserved_concurrent_executions = var.reserved_concurrent_executions

  tags = var.tags

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_basic_execution
  ]
}

# Lambda execution role
resource "aws_iam_role" "lambda_role" {
  name               = "${var.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = var.tags
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

# Basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# X-Ray policy (if enabled)
resource "aws_iam_role_policy_attachment" "lambda_xray" {
  count = var.enable_xray_tracing ? 1 : 0

  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# VPC execution policy (if VPC enabled)
resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
  count = var.vpc_subnet_ids != null ? 1 : 0

  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Custom IAM policies
resource "aws_iam_role_policy" "lambda_custom_policy" {
  count = var.custom_iam_policy_json != "" ? 1 : 0

  name   = "${var.function_name}-custom-policy"
  role   = aws_iam_role.lambda_role.id
  policy = var.custom_iam_policy_json
}

# Attach additional policy ARNs
resource "aws_iam_role_policy_attachment" "additional_policies" {
  for_each = toset(var.additional_policy_arns)

  role       = aws_iam_role.lambda_role.name
  policy_arn = each.value
}

# CloudWatch Logs
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# Lambda alias for blue/green deployments
resource "aws_lambda_alias" "alias" {
  count = var.create_alias ? 1 : 0

  name             = var.alias_name
  description      = "Alias for ${var.function_name}"
  function_name    = aws_lambda_function.function.function_name
  function_version = var.alias_function_version

  # Routing configuration for canary/linear deployments
  dynamic "routing_config" {
    for_each = var.alias_routing_additional_version_weights != null ? [1] : []
    content {
      additional_version_weights = var.alias_routing_additional_version_weights
    }
  }
}
