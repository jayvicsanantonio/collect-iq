# Lambda Function Module

This module provisions AWS Lambda functions with configurable parameters, IAM roles, and deployment aliases.

## Features

- Configurable memory, timeout, and runtime
- IAM role with least-privilege policies
- X-Ray tracing enabled by default
- CloudWatch Logs with configurable retention
- Lambda aliases for blue/green deployments
- Support for custom IAM policies
- VPC configuration (optional)
- Reserved concurrency (optional)

## Usage

```hcl
module "upload_presign_lambda" {
  source = "../../modules/lambda_fn"

  function_name = "collectiq-hackathon-upload-presign"
  description   = "Generate presigned URLs for S3 uploads"

  filename         = "dist/upload_presign.zip"
  source_code_hash = filebase64sha256("dist/upload_presign.zip")
  handler          = "index.handler"
  runtime          = "nodejs20.x"

  memory_size = 512
  timeout     = 30

  environment_variables = {
    BUCKET_UPLOADS     = module.s3_uploads.bucket_name
    MAX_UPLOAD_MB      = "10"
    ALLOWED_UPLOAD_MIME = "image/jpeg,image/png"
  }

  enable_xray_tracing = true

  custom_iam_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:PutObject"]
        Resource = "${module.s3_uploads.bucket_arn}/uploads/*"
      }
    ]
  })

  create_alias          = true
  alias_name            = "live"
  alias_function_version = "$LATEST"

  tags = {
    Project     = "CollectIQ"
    Environment = "hackathon"
  }
}
```

## Blue/Green Deployments

```hcl
# Canary deployment (10% traffic to new version)
alias_routing_additional_version_weights = {
  "2" = 0.1  # 10% to version 2
}
```

## Inputs

| Name                | Description                 | Type   | Default         | Required |
| ------------------- | --------------------------- | ------ | --------------- | -------- |
| function_name       | Name of the Lambda function | string | -               | yes      |
| filename            | Path to deployment package  | string | -               | yes      |
| handler             | Function handler            | string | "index.handler" | no       |
| runtime             | Lambda runtime              | string | "nodejs20.x"    | no       |
| memory_size         | Memory in MB                | number | 512             | no       |
| timeout             | Timeout in seconds          | number | 30              | no       |
| enable_xray_tracing | Enable X-Ray                | bool   | true            | no       |

## Outputs

| Name          | Description            |
| ------------- | ---------------------- |
| function_name | Lambda function name   |
| function_arn  | Lambda function ARN    |
| invoke_arn    | Lambda invoke ARN      |
| role_arn      | Execution role ARN     |
| alias_arn     | Alias ARN (if created) |
