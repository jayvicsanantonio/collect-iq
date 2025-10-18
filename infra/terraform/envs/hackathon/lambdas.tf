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
      "dynamodb:GetItem"
    ]
    resources = [
      module.dynamodb_collectiq.table_arn
    ]
  }
}

# DynamoDB DeleteItem policy for cards_delete Lambda
data "aws_iam_policy_document" "cards_delete_dynamodb" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:DeleteItem",
      "dynamodb:GetItem"
    ]
    resources = [
      module.dynamodb_collectiq.table_arn
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
      "dynamodb:GetItem"
    ]
    resources = [
      module.dynamodb_collectiq.table_arn
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
      "dynamodb:GetItem"
    ]
    resources = [
      module.dynamodb_collectiq.table_arn
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
    REGION           = var.aws_region
    BUCKET_UPLOADS       = module.s3_uploads.bucket_name
    MAX_UPLOAD_MB        = "12"
    ALLOWED_UPLOAD_MIME  = "image/jpeg,image/png,image/heic"
    KMS_KEY_ID           = "" # Using SSE-S3 for hackathon
  }

  custom_iam_policy_json = data.aws_iam_policy_document.upload_presign_s3.json

  enable_xray_tracing = true
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
    REGION            = var.aws_region
    DDB_TABLE             = module.dynamodb_collectiq.table_name
    COGNITO_USER_POOL_ID  = "" # Will be added when Cognito is deployed
  }

  custom_iam_policy_json = data.aws_iam_policy_document.cards_create_dynamodb.json

  enable_xray_tracing = true
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
  }

  custom_iam_policy_json = data.aws_iam_policy_document.cards_list_dynamodb.json

  enable_xray_tracing = true
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
  }

  custom_iam_policy_json = data.aws_iam_policy_document.cards_get_dynamodb.json

  enable_xray_tracing = true
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
    COGNITO_USER_POOL_ID  = "" # Will be added when Cognito is deployed
    HARD_DELETE_CARDS     = "false"
  }

  custom_iam_policy_json = data.aws_iam_policy_document.cards_delete_dynamodb.json

  enable_xray_tracing = true
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
  }

  custom_iam_policy_json = data.aws_iam_policy_document.cards_revalue_sfn.json

  enable_xray_tracing = true
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
  }

  custom_iam_policy_json = data.aws_iam_policy_document.rekognition_extract_s3.json
  additional_policy_arns = [module.rekognition_access.policy_arn]

  enable_xray_tracing = true
  log_retention_days  = 30

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
  }

  # additional_policy_arns will include ssm_secrets policy when deployed

  enable_xray_tracing = true
  log_retention_days  = 30

  tags = local.common_tags
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
    BEDROCK_MODEL_ID = "anthropic.claude-3-5-sonnet-20240620-v1:0"
    BUCKET_UPLOADS   = module.s3_uploads.bucket_name
    BUCKET_SAMPLES   = "" # Optional authentic samples bucket
  }

  custom_iam_policy_json = data.aws_iam_policy_document.rekognition_extract_s3.json
  additional_policy_arns = [module.bedrock_access.policy_arn]

  enable_xray_tracing = true
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
    REGION     = var.aws_region
    DDB_TABLE      = module.dynamodb_collectiq.table_name
    EVENT_BUS_NAME = module.eventbridge_bus.bus_name # Will be added when EventBridge is deployed
  }

  custom_iam_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      jsondecode(data.aws_iam_policy_document.aggregator_dynamodb.json).Statement,
      jsondecode(data.aws_iam_policy_document.aggregator_eventbridge.json).Statement
    )
  })

  enable_xray_tracing = true
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
  }

  custom_iam_policy_json = data.aws_iam_policy_document.error_handler_sqs.json

  enable_xray_tracing = true
  log_retention_days  = 30

  tags = local.common_tags
}
