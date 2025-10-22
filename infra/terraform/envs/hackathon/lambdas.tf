# Lambda Functions Configuration for Hackathon Environment
# This file defines all Lambda function deployments

# ============================================================================
# Data Sources
# ============================================================================

# Get the built Lambda deployment packages
data "archive_file" "upload_presign" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/handlers/upload_presign.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/upload_presign.zip"
}

data "archive_file" "image_presign" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/handlers/image_presign.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/image_presign.zip"
}

data "archive_file" "cards_create" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/handlers/cards_create.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/cards_create.zip"
}

data "archive_file" "cards_list" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/handlers/cards_list.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/cards_list.zip"
}

data "archive_file" "cards_get" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/handlers/cards_get.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/cards_get.zip"
}

data "archive_file" "cards_delete" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/handlers/cards_delete.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/cards_delete.zip"
}

data "archive_file" "cards_revalue" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/handlers/cards_revalue.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/cards_revalue.zip"
}

data "archive_file" "rekognition_extract" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/orchestration/rekognition-extract.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/rekognition-extract.zip"
}

data "archive_file" "ocr_reasoning_agent" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/agents/ocr-reasoning-agent.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/ocr-reasoning-agent.zip"
}

data "archive_file" "pricing_agent" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/agents/pricing-agent.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/pricing-agent.zip"
}

data "archive_file" "authenticity_agent" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/agents/authenticity_agent.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/authenticity_agent.zip"
}

data "archive_file" "aggregator" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/orchestration/aggregator.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/aggregator.zip"
}

data "archive_file" "error_handler" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/orchestration/error-handler.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/error-handler.zip"
}

# ============================================================================
# IAM Policy Documents
# ============================================================================

# S3 PutObject policy for upload_presign Lambda
data "aws_iam_policy_document" "upload_presign_s3" {
  statement {
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:PutObjectAcl"
    ]
    resources = [
      "${module.s3_uploads.bucket_arn}/uploads/*"
    ]
  }
}

# S3 GetObject policy for image_presign Lambda
data "aws_iam_policy_document" "image_presign_s3" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject"
    ]
    resources = [
      "${module.s3_uploads.bucket_arn}/uploads/*"
    ]
  }
}

# DynamoDB PutItem policy for cards_create Lambda
data "aws_iam_policy_document" "cards_create_dynamodb" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:PutItem"
    ]
    resources = [
      module.dynamodb_collectiq.table_arn
    ]
  }

  # EventBridge PutEvents for auto-trigger revaluation
  statement {
    effect = "Allow"
    actions = [
      "events:PutEvents"
    ]
    resources = [
      module.eventbridge_bus.bus_arn
    ]
  }
}

# DynamoDB Query policy for cards_list Lambda (GSI1)
data "aws_iam_policy_document" "cards_list_dynamodb" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:Query"
    ]
    resources = [
      module.dynamodb_collectiq.table_arn,
      "${module.dynamodb_collectiq.table_arn}/index/${module.dynamodb_collectiq.gsi1_name}"
    ]
  }
}

# DynamoDB GetItem policy for cards_get Lambda
data "aws_iam_policy_document" "cards_get_dynamodb" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan"
    ]
    resources = [
      module.dynamodb_collectiq.table_arn,
      "${module.dynamodb_collectiq.table_arn}/index/*"
    ]
  }
}

# DynamoDB DeleteItem policy for cards_delete Lambda
data "aws_iam_policy_document" "cards_delete_dynamodb" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:DeleteItem",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:UpdateItem"
    ]
    resources = [
      module.dynamodb_collectiq.table_arn,
      "${module.dynamodb_collectiq.table_arn}/index/*"
    ]
  }

  # S3 DeleteObject for cleaning up card images
  statement {
    effect = "Allow"
    actions = [
      "s3:DeleteObject"
    ]
    resources = [
      "${module.s3_uploads.bucket_arn}/*"
    ]
  }
}

# Step Functions StartExecution policy for cards_revalue Lambda
data "aws_iam_policy_document" "cards_revalue_sfn" {
  statement {
    effect = "Allow"
    actions = [
      "states:StartExecution",
      "states:ListExecutions"
    ]
    resources = [
      # Will be added when Step Functions is deployed
      # module.step_functions.state_machine_arn
      "*"
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan"
    ]
    resources = [
      module.dynamodb_collectiq.table_arn,
      "${module.dynamodb_collectiq.table_arn}/index/*"
    ]
  }
}

# S3 GetObject policy for rekognition_extract Lambda
data "aws_iam_policy_document" "rekognition_extract_s3" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject"
    ]
    resources = [
      "${module.s3_uploads.bucket_arn}/*"
    ]
  }
}

# DynamoDB UpdateItem policy for aggregator Lambda
data "aws_iam_policy_document" "aggregator_dynamodb" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:UpdateItem",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan"
    ]
    resources = [
      module.dynamodb_collectiq.table_arn,
      "${module.dynamodb_collectiq.table_arn}/index/*"
    ]
  }
}

# EventBridge PutEvents policy for aggregator Lambda
data "aws_iam_policy_document" "aggregator_eventbridge" {
  statement {
    effect = "Allow"
    actions = [
      "events:PutEvents"
    ]
    resources = [
      # Will be added when EventBridge is deployed
      module.eventbridge_bus.bus_arn
      #"*"
    ]
  }
}

# SQS SendMessage policy for error_handler Lambda
data "aws_iam_policy_document" "error_handler_sqs" {
  statement {
    effect = "Allow"
    actions = [
      "sqs:SendMessage"
    ]
    resources = [
      # Will be added when EventBridge DLQ is deployed
      module.eventbridge_bus.dlq_arn
      #"*"
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "dynamodb:UpdateItem"
    ]
    resources = [
      module.dynamodb_collectiq.table_arn
    ]
  }
}

# ============================================================================
# Lambda Functions - API Handlers
# ============================================================================

# 4.1 Upload Presign Lambda
module "lambda_upload_presign" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-upload-presign"
  description   = "Generate presigned URLs for S3 uploads"
  filename      = data.archive_file.upload_presign.output_path
  source_code_hash = data.archive_file.upload_presign.output_base64sha256
  handler       = "upload_presign.handler"
  runtime       = "nodejs20.x"

  memory_size = 512
  timeout     = 30

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION                   = var.aws_region
    BUCKET_UPLOADS           = module.s3_uploads.bucket_name
    MAX_UPLOAD_MB            = "12"
    ALLOWED_UPLOAD_MIME      = "image/jpeg,image/png"
    KMS_KEY_ID               = "" # Using SSE-S3 for hackathon
    XRAY_ENABLED             = "false" # Disable X-Ray SDK to avoid context issues
  }

  custom_iam_policy_json = data.aws_iam_policy_document.upload_presign_s3.json

  enable_xray_tracing = false # Disabled due to context issues with module-level SDK initialization
  log_retention_days  = 30

  tags = local.common_tags
}

# 4.1.1 Image Presign Lambda
module "lambda_image_presign" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-image-presign"
  description   = "Generate presigned URLs for viewing S3 images"
  filename      = data.archive_file.image_presign.output_path
  source_code_hash = data.archive_file.image_presign.output_base64sha256
  handler       = "image_presign.handler"
  runtime       = "nodejs20.x"

  memory_size = 512
  timeout     = 30

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION         = var.aws_region
    BUCKET_UPLOADS = module.s3_uploads.bucket_name
    XRAY_ENABLED   = "false"
  }

  custom_iam_policy_json = data.aws_iam_policy_document.image_presign_s3.json

  enable_xray_tracing = false
  log_retention_days  = 30

  tags = local.common_tags
}

# 4.2 Cards Create Lambda
module "lambda_cards_create" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-cards-create"
  description   = "Create a new card record"
  filename      = data.archive_file.cards_create.output_path
  source_code_hash = data.archive_file.cards_create.output_base64sha256
  handler       = "cards_create.handler"
  runtime       = "nodejs20.x"

  memory_size = 512
  timeout     = 30

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION                = var.aws_region
    DDB_TABLE             = module.dynamodb_collectiq.table_name
    S3_BUCKET             = module.s3_uploads.bucket_name
    COGNITO_USER_POOL_ID  = "" # Will be added when Cognito is deployed
    XRAY_ENABLED          = "false"
    AUTO_TRIGGER_REVALUE  = "true"  # Enable auto-trigger via EventBridge
    EVENT_BUS_NAME        = module.eventbridge_bus.bus_name
  }

  custom_iam_policy_json = data.aws_iam_policy_document.cards_create_dynamodb.json

  enable_xray_tracing = false
  log_retention_days  = 30

  tags = local.common_tags
}

# 4.2 Cards List Lambda
module "lambda_cards_list" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-cards-list"
  description   = "List user's cards with pagination"
  filename      = data.archive_file.cards_list.output_path
  source_code_hash = data.archive_file.cards_list.output_base64sha256
  handler       = "cards_list.handler"
  runtime       = "nodejs20.x"

  memory_size = 512
  timeout     = 30

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION            = var.aws_region
    DDB_TABLE             = module.dynamodb_collectiq.table_name
    COGNITO_USER_POOL_ID  = "" # Will be added when Cognito is deployed
    XRAY_ENABLED          = "false" # Disable X-Ray SDK to avoid context issues
  }

  custom_iam_policy_json = data.aws_iam_policy_document.cards_list_dynamodb.json

  enable_xray_tracing = false
  log_retention_days  = 30

  tags = local.common_tags
}

# 4.2 Cards Get Lambda
module "lambda_cards_get" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-cards-get"
  description   = "Get a specific card by ID"
  filename      = data.archive_file.cards_get.output_path
  source_code_hash = data.archive_file.cards_get.output_base64sha256
  handler       = "cards_get.handler"
  runtime       = "nodejs20.x"

  memory_size = 512
  timeout     = 30

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION            = var.aws_region
    DDB_TABLE             = module.dynamodb_collectiq.table_name
    COGNITO_USER_POOL_ID  = "" # Will be added when Cognito is deployed
    XRAY_ENABLED          = "false" # Disable X-Ray SDK to avoid context issues
  }

  custom_iam_policy_json = data.aws_iam_policy_document.cards_get_dynamodb.json

  enable_xray_tracing = false
  log_retention_days  = 30

  tags = local.common_tags
}

# 4.2 Cards Delete Lambda
module "lambda_cards_delete" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-cards-delete"
  description   = "Delete a specific card"
  filename      = data.archive_file.cards_delete.output_path
  source_code_hash = data.archive_file.cards_delete.output_base64sha256
  handler       = "cards_delete.handler"
  runtime       = "nodejs20.x"

  memory_size = 512
  timeout     = 30

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION            = var.aws_region
    DDB_TABLE             = module.dynamodb_collectiq.table_name
    S3_BUCKET             = module.s3_uploads.bucket_name
    COGNITO_USER_POOL_ID  = "" # Will be added when Cognito is deployed
    HARD_DELETE_CARDS     = "true" # Permanently delete cards and S3 objects
    XRAY_ENABLED          = "false" # Disable X-Ray SDK to avoid context issues
  }

  custom_iam_policy_json = data.aws_iam_policy_document.cards_delete_dynamodb.json

  enable_xray_tracing = false
  log_retention_days  = 30

  tags = local.common_tags
}

# 4.3 Cards Revalue Lambda
module "lambda_cards_revalue" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-cards-revalue"
  description   = "Trigger Step Functions workflow for card revaluation"
  filename      = data.archive_file.cards_revalue.output_path
  source_code_hash = data.archive_file.cards_revalue.output_base64sha256
  handler       = "cards_revalue.handler"
  runtime       = "nodejs20.x"

  memory_size = 512
  timeout     = 30

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION           = var.aws_region
    STEP_FUNCTIONS_ARN   = try(module.step_functions.state_machine_arn, "") # Will be added when Step Functions is deployed
    DDB_TABLE            = module.dynamodb_collectiq.table_name
    XRAY_ENABLED         = "false" # Disable X-Ray SDK to avoid context issues
  }

  custom_iam_policy_json = data.aws_iam_policy_document.cards_revalue_sfn.json

  enable_xray_tracing = false
  log_retention_days  = 30

  tags = local.common_tags
}

# ============================================================================
# Lambda Functions - Orchestration
# ============================================================================

# 4.4 Rekognition Extract Lambda
module "lambda_rekognition_extract" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-rekognition-extract"
  description   = "Extract visual features using Amazon Rekognition"
  filename      = data.archive_file.rekognition_extract.output_path
  source_code_hash = data.archive_file.rekognition_extract.output_base64sha256
  handler       = "rekognition-extract.handler"
  runtime       = "nodejs20.x"

  memory_size = 1024
  timeout     = 300 # 5 minutes

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION     = var.aws_region
    BUCKET_UPLOADS = module.s3_uploads.bucket_name
    XRAY_ENABLED   = "false" # Disable X-Ray SDK to avoid context issues
  }

  custom_iam_policy_json = data.aws_iam_policy_document.rekognition_extract_s3.json
  additional_policy_arns = [module.rekognition_access.policy_arn]

  # Sharp layer for image processing
  layers = [module.lambda_sharp_layer.layer_arn]

  enable_xray_tracing = false
  log_retention_days  = 30

  tags = local.common_tags
}

# 4.4.1 OCR Reasoning Agent Lambda
# IAM Permissions:
# - bedrock:Converse (via bedrock_access policy) - required for ConverseCommand API
# - bedrock:ConverseStream (via bedrock_access policy) - for streaming responses
# - bedrock:InvokeModel (via bedrock_access policy) - legacy API support
# - bedrock:InvokeModelWithResponseStream (via bedrock_access policy) - legacy streaming support
# - logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents (via AWSLambdaBasicExecutionRole)
# - ec2:CreateNetworkInterface, ec2:DescribeNetworkInterfaces, ec2:DeleteNetworkInterface (via AWSLambdaVPCAccessExecutionRole)
module "lambda_ocr_reasoning_agent" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-ocr-reasoning-agent"
  description   = "Interpret OCR results using Amazon Bedrock (Claude Sonnet 4.0)"
  filename      = data.archive_file.ocr_reasoning_agent.output_path
  source_code_hash = data.archive_file.ocr_reasoning_agent.output_base64sha256
  handler       = "ocr-reasoning-agent.handler"
  runtime       = "nodejs20.x"

  memory_size = 512
  timeout     = 30

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION              = var.aws_region
    BEDROCK_MODEL_ID    = "anthropic.claude-sonnet-4-20250514-v1:0"
    BEDROCK_TEMPERATURE = "0.15"
    BEDROCK_MAX_TOKENS  = "4096"
    BEDROCK_MAX_RETRIES = "3"
    XRAY_ENABLED        = "false" # Disabled to avoid context issues with module-level SDK initialization
  }

  # Bedrock access policy grants bedrock:Converse and bedrock:InvokeModel permissions
  # restricted to the specific Claude Sonnet 4.0 model ARN
  additional_policy_arns = [module.bedrock_access.policy_arn]

  # X-Ray tracing disabled to avoid context issues
  enable_xray_tracing = false
  log_retention_days  = 7

  tags = local.common_tags
}

# 4.5 Pricing Agent Lambda
module "lambda_pricing_agent" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-pricing-agent"
  description   = "Fetch pricing data from external APIs"
  filename      = data.archive_file.pricing_agent.output_path
  source_code_hash = data.archive_file.pricing_agent.output_base64sha256
  handler       = "pricing-agent.handler"
  runtime       = "nodejs20.x"

  memory_size = 1024
  timeout     = 300 # 5 minutes

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION                = var.aws_region
    DDB_TABLE                 = module.dynamodb_collectiq.table_name
    EBAY_SECRET_ARN           = "" # Will be added when Secrets Manager is configured
    TCGPLAYER_SECRET_ARN      = "" # Will be added when Secrets Manager is configured
    PRICECHARTING_SECRET_ARN  = "" # Will be added when Secrets Manager is configured
    XRAY_ENABLED              = "false" # Disable X-Ray SDK to avoid context issues
  }

  # additional_policy_arns will include ssm_secrets policy when deployed

  enable_xray_tracing = false
  log_retention_days  = 30

  tags = local.common_tags
}

# Grant pricing agent access to DynamoDB for caching
resource "aws_iam_role_policy" "pricing_agent_dynamodb" {
  name = "${local.name_prefix}-pricing-agent-dynamodb"
  role = module.lambda_pricing_agent.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Resource = [
          module.dynamodb_collectiq.table_arn,
          "${module.dynamodb_collectiq.table_arn}/index/*"
        ]
      }
    ]
  })
}

# Grant pricing agent access to Secrets Manager
resource "aws_iam_role_policy_attachment" "secrets_lambda" {
  role = module.lambda_pricing_agent.role_name
  policy_arn = module.ssm_secrets.policy_arn
}

# 4.6 Authenticity Agent Lambda
module "lambda_authenticity_agent" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-authenticity-agent"
  description   = "Verify card authenticity using Amazon Bedrock"
  filename      = data.archive_file.authenticity_agent.output_path
  source_code_hash = data.archive_file.authenticity_agent.output_base64sha256
  handler       = "authenticity_agent.handler"
  runtime       = "nodejs20.x"

  memory_size = 1024
  timeout     = 300 # 5 minutes

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION       = var.aws_region
    BEDROCK_MODEL_ID = "anthropic.claude-sonnet-4-20250514-v1:0"
    BUCKET_UPLOADS   = module.s3_uploads.bucket_name
    BUCKET_SAMPLES   = "" # Optional authentic samples bucket
    XRAY_ENABLED     = "false" # Disable X-Ray SDK to avoid context issues
  }

  custom_iam_policy_json = data.aws_iam_policy_document.rekognition_extract_s3.json
  additional_policy_arns = [module.bedrock_access.policy_arn]

  # Sharp layer for image processing
  layers = [module.lambda_sharp_layer.layer_arn]

  enable_xray_tracing = false
  log_retention_days  = 30

  tags = local.common_tags
}

# 4.7 Aggregator Lambda
module "lambda_aggregator" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-aggregator"
  description   = "Aggregate results and persist to DynamoDB"
  filename      = data.archive_file.aggregator.output_path
  source_code_hash = data.archive_file.aggregator.output_base64sha256
  handler       = "aggregator.handler"
  runtime       = "nodejs20.x"

  memory_size = 512
  timeout     = 60

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION            = var.aws_region
    DDB_TABLE         = module.dynamodb_collectiq.table_name
    CARD_ID_INDEX_NAME = "CardIdIndex"
    EVENT_BUS_NAME    = module.eventbridge_bus.bus_name # Will be added when EventBridge is deployed
    XRAY_ENABLED      = "false" # Disable X-Ray SDK to avoid context issues
  }

  custom_iam_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      jsondecode(data.aws_iam_policy_document.aggregator_dynamodb.json).Statement,
      jsondecode(data.aws_iam_policy_document.aggregator_eventbridge.json).Statement
    )
  })

  enable_xray_tracing = false
  log_retention_days  = 30

  tags = local.common_tags
}

# 4.8 Error Handler Lambda
module "lambda_error_handler" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-error-handler"
  description   = "Handle Step Functions errors and send to DLQ"
  filename      = data.archive_file.error_handler.output_path
  source_code_hash = data.archive_file.error_handler.output_base64sha256
  handler       = "error-handler.handler"
  runtime       = "nodejs20.x"

  memory_size = 512
  timeout     = 60

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION = var.aws_region
    DLQ_URL    = module.eventbridge_bus.dlq_url # Will be added when EventBridge DLQ is deployed
    DDB_TABLE  = module.dynamodb_collectiq.table_name
    XRAY_ENABLED = "false" # Disable X-Ray SDK to avoid context issues
  }

  custom_iam_policy_json = data.aws_iam_policy_document.error_handler_sqs.json

  enable_xray_tracing = false
  log_retention_days  = 30

  tags = local.common_tags
}


# Lambda Function Outputs

# ============================================================================
# API Handler Lambda Outputs
# ============================================================================

output "lambda_upload_presign_arn" {
  description = "ARN of the upload_presign Lambda function"
  value       = module.lambda_upload_presign.function_arn
}

output "lambda_upload_presign_invoke_arn" {
  description = "Invoke ARN of the upload_presign Lambda function"
  value       = module.lambda_upload_presign.invoke_arn
}

output "lambda_image_presign_arn" {
  description = "ARN of the image_presign Lambda function"
  value       = module.lambda_image_presign.function_arn
}

output "lambda_image_presign_invoke_arn" {
  description = "Invoke ARN of the image_presign Lambda function"
  value       = module.lambda_image_presign.invoke_arn
}

output "lambda_cards_create_arn" {
  description = "ARN of the cards_create Lambda function"
  value       = module.lambda_cards_create.function_arn
}

output "lambda_cards_create_invoke_arn" {
  description = "Invoke ARN of the cards_create Lambda function"
  value       = module.lambda_cards_create.invoke_arn
}

output "lambda_cards_list_arn" {
  description = "ARN of the cards_list Lambda function"
  value       = module.lambda_cards_list.function_arn
}

output "lambda_cards_list_invoke_arn" {
  description = "Invoke ARN of the cards_list Lambda function"
  value       = module.lambda_cards_list.invoke_arn
}

output "lambda_cards_get_arn" {
  description = "ARN of the cards_get Lambda function"
  value       = module.lambda_cards_get.function_arn
}

output "lambda_cards_get_invoke_arn" {
  description = "Invoke ARN of the cards_get Lambda function"
  value       = module.lambda_cards_get.invoke_arn
}

output "lambda_cards_delete_arn" {
  description = "ARN of the cards_delete Lambda function"
  value       = module.lambda_cards_delete.function_arn
}

output "lambda_cards_delete_invoke_arn" {
  description = "Invoke ARN of the cards_delete Lambda function"
  value       = module.lambda_cards_delete.invoke_arn
}

output "lambda_cards_revalue_arn" {
  description = "ARN of the cards_revalue Lambda function"
  value       = module.lambda_cards_revalue.function_arn
}

output "lambda_cards_revalue_invoke_arn" {
  description = "Invoke ARN of the cards_revalue Lambda function"
  value       = module.lambda_cards_revalue.invoke_arn
}

# ============================================================================
# Orchestration Lambda Outputs
# ============================================================================

output "lambda_rekognition_extract_arn" {
  description = "ARN of the rekognition_extract Lambda function"
  value       = module.lambda_rekognition_extract.function_arn
}

output "lambda_ocr_reasoning_agent_arn" {
  description = "ARN of the ocr_reasoning_agent Lambda function"
  value       = module.lambda_ocr_reasoning_agent.function_arn
}

output "lambda_pricing_agent_arn" {
  description = "ARN of the pricing_agent Lambda function"
  value       = module.lambda_pricing_agent.function_arn
}

output "lambda_authenticity_agent_arn" {
  description = "ARN of the authenticity_agent Lambda function"
  value       = module.lambda_authenticity_agent.function_arn
}

output "lambda_aggregator_arn" {
  description = "ARN of the aggregator Lambda function"
  value       = module.lambda_aggregator.function_arn
}

output "lambda_error_handler_arn" {
  description = "ARN of the error_handler Lambda function"
  value       = module.lambda_error_handler.function_arn
}
