resource "aws_cloudwatch_event_bus" "bus" {
  name = var.bus_name

  tags = var.tags
}

# Dead Letter Queue for failed event deliveries
resource "aws_sqs_queue" "dlq" {
  name                      = "${var.bus_name}-dlq"
  message_retention_seconds = var.dlq_message_retention_seconds
  
  tags = var.tags
}

# Event rules
resource "aws_cloudwatch_event_rule" "rules" {
  for_each = var.event_rules

  name           = each.key
  description    = each.value.description
  event_bus_name = aws_cloudwatch_event_bus.bus.name
  event_pattern  = each.value.event_pattern

  tags = var.tags
}

# Event targets
resource "aws_cloudwatch_event_target" "targets" {
  for_each = var.event_rules

  rule           = aws_cloudwatch_event_rule.rules[each.key].name
  event_bus_name = aws_cloudwatch_event_bus.bus.name
  target_id      = "${each.key}-target"
  arn            = each.value.target_arn

  # Dead letter config for failed deliveries
  dead_letter_config {
    arn = aws_sqs_queue.dlq.arn
  }

  # Retry policy
  retry_policy {
    maximum_event_age_in_seconds = var.retry_maximum_event_age
    maximum_retry_attempts       = var.retry_maximum_retry_attempts
  }

  # Input transformer (optional)
  dynamic "input_transformer" {
    for_each = each.value.input_transformer != null ? [each.value.input_transformer] : []
    content {
      input_paths    = input_transformer.value.input_paths
      input_template = input_transformer.value.input_template
    }
  }
}

# Lambda permissions for EventBridge to invoke targets
resource "aws_lambda_permission" "eventbridge_invoke" {
  for_each = {
    for k, v in var.event_rules : k => v
    if v.target_type == "lambda"
  }

  statement_id  = "AllowEventBridgeInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value.target_function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.rules[each.key].arn
}

# SQS queue policy for EventBridge to send messages
resource "aws_sqs_queue_policy" "eventbridge_send" {
  for_each = {
    for k, v in var.event_rules : k => v
    if v.target_type == "sqs"
  }

  queue_url = each.value.target_arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = each.value.target_arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.rules[each.key].arn
          }
        }
      }
    ]
  })
}

# IAM role for EventBridge to send to DLQ
resource "aws_iam_role" "eventbridge_dlq" {
  name = "${var.bus_name}-dlq-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "eventbridge_dlq" {
  name = "${var.bus_name}-dlq-policy"
  role = aws_iam_role.eventbridge_dlq.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = aws_sqs_queue.dlq.arn
      }
    ]
  })
}
