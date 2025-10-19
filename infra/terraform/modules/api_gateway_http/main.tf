resource "aws_apigatewayv2_api" "api" {
  name          = var.api_name
  protocol_type = "HTTP"
  description   = var.api_description

  cors_configuration {
    allow_origins     = var.cors_allow_origins
    allow_methods     = var.cors_allow_methods
    allow_headers     = var.cors_allow_headers
    expose_headers    = var.cors_expose_headers
    max_age           = var.cors_max_age
    allow_credentials = var.cors_allow_credentials
  }

  tags = var.tags
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  count = var.cognito_user_pool_arn != "" ? 1 : 0

  api_id           = aws_apigatewayv2_api.api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.api_name}-jwt-authorizer"

  jwt_configuration {
    audience = [var.cognito_client_id]
    issuer   = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = var.stage_name
  auto_deploy = true

  # Access logging
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_logs.arn
    format = jsonencode({
      requestId                   = "$context.requestId"
      ip                          = "$context.identity.sourceIp"
      requestTime                 = "$context.requestTime"
      httpMethod                  = "$context.httpMethod"
      routeKey                    = "$context.routeKey"
      status                      = "$context.status"
      protocol                    = "$context.protocol"
      responseLength              = "$context.responseLength"
      errorMessage                = "$context.error.message"
      integrationErrorMessage     = "$context.integrationErrorMessage"
      integrationStatus           = "$context.integrationStatus"
      authorizerError             = "$context.authorizer.error"
    })
  }

  # Throttling settings and detailed metrics (includes X-Ray)
  default_route_settings {
    throttling_burst_limit = var.throttling_burst_limit
    throttling_rate_limit  = var.throttling_rate_limit
    detailed_metrics_enabled = var.enable_xray_tracing
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/aws/apigateway/${var.api_name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# Routes and integrations
resource "aws_apigatewayv2_integration" "lambda" {
  for_each = var.lambda_integrations

  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"

  integration_uri        = each.value.lambda_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = var.lambda_integrations

  api_id    = aws_apigatewayv2_api.api.id
  route_key = each.value.route_key

  target = "integrations/${aws_apigatewayv2_integration.lambda[each.key].id}"

  # Apply JWT authorizer unless route is marked as public
  authorization_type = each.value.require_auth ? "JWT" : "NONE"
  authorizer_id      = each.value.require_auth && var.cognito_user_pool_arn != "" ? aws_apigatewayv2_authorizer.jwt[0].id : null
}

# Lambda permissions
resource "aws_lambda_permission" "api_gateway" {
  for_each = var.lambda_integrations

  statement_id  = "AllowAPIGatewayInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = each.value.lambda_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

data "aws_region" "current" {}
