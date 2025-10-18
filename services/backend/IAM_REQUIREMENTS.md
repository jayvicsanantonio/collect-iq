# IAM Requirements

This document outlines the IAM permissions required for each Lambda function in the CollectIQ backend, following the principle of least privilege.

## Table of Contents

- [Least-Privilege Principles](#least-privilege-principles)
- [Lambda Execution Roles](#lambda-execution-roles)
- [API Gateway Permissions](#api-gateway-permissions)
- [Step Functions Permissions](#step-functions-permissions)
- [Common Policies](#common-policies)

## Least-Privilege Principles

CollectIQ follows AWS security best practices for IAM:

1. **Separate Roles**: Each Lambda function has its own execution role with only the permissions it needs
2. **Resource Scoping**: Permissions are scoped to specific resources (tables, buckets, state machines) rather than using wildcards
3. **Condition Keys**: Where applicable, use IAM condition keys to further restrict access
4. **No Inline Policies**: All policies are managed separately for easier auditing and updates
5. **Regular Audits**: Use AWS IAM Access Analyzer to identify unused permissions

## Lambda Execution Roles

### Base Lambda Execution Policy

All Lambda functions require basic CloudWatch Logs permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:${region}:${account}:log-group:/aws/lambda/${stage}-collectiq-*:*"
    }
  ]
}
```

### X-Ray Tracing Policy (All Functions)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["xray:PutTraceSegments", "xray:PutTelemetryRecords"],
      "Resource": "*"
    }
  ]
}
```

---

## Handler Functions

### 1. upload_presign Handler

**Purpose**: Generate presigned S3 URLs for image uploads

**Required Permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3PresignPermissions",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::${stage}-collectiq-uploads-${account}/uploads/*"
    },
    {
      "Sid": "KMSEncryptionPermissions",
      "Effect": "Allow",
      "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
      "Resource": "arn:aws:kms:${region}:${account}:key/${kms_key_id}",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "s3.${region}.amazonaws.com"
        }
      }
    }
  ]
}
```

**Terraform Example**:

```hcl
resource "aws_iam_role_policy" "upload_presign_s3" {
  name = "${var.stage}-collectiq-upload-presign-s3"
  role = aws_iam_role.upload_presign.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3PresignPermissions"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl"
        ]
        Resource = "${aws_s3_bucket.uploads.arn}/uploads/*"
      }
    ]
  })
}
```

---

### 2. cards_create Handler

**Purpose**: Create new card records in DynamoDB

**Required Permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBWritePermissions",
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem"],
      "Resource": "arn:aws:dynamodb:${region}:${account}:table/${stage}-CollectIQ",
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:LeadingKeys": ["USER#${cognito:sub}"]
        }
      }
    }
  ]
}
```

---

### 3. cards_list Handler

**Purpose**: List user's cards from DynamoDB

**Required Permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBReadPermissions",
      "Effect": "Allow",
      "Action": ["dynamodb:Query"],
      "Resource": [
        "arn:aws:dynamodb:${region}:${account}:table/${stage}-CollectIQ",
        "arn:aws:dynamodb:${region}:${account}:table/${stage}-CollectIQ/index/GSI1"
      ]
    }
  ]
}
```

---

### 4. cards_get Handler

**Purpose**: Retrieve a specific card from DynamoDB

**Required Permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBReadPermissions",
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem"],
      "Resource": "arn:aws:dynamodb:${region}:${account}:table/${stage}-CollectIQ"
    }
  ]
}
```

---

### 5. cards_delete Handler

**Purpose**: Delete card records from DynamoDB

**Required Permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBDeletePermissions",
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:DeleteItem"],
      "Resource": "arn:aws:dynamodb:${region}:${account}:table/${stage}-CollectIQ"
    }
  ]
}
```

---

### 6. cards_revalue Handler

**Purpose**: Trigger Step Functions workflow for card revaluation

**Required Permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBReadPermissions",
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:Query"],
      "Resource": "arn:aws:dynamodb:${region}:${account}:table/${stage}-CollectIQ"
    },
    {
      "Sid": "StepFunctionsStartExecution",
      "Effect": "Allow",
      "Action": ["states:StartExecution"],
      "Resource": "arn:aws:states:${region}:${account}:stateMachine:${stage}-collectiq-revalue"
    },
    {
      "Sid": "StepFunctionsDescribeExecution",
      "Effect": "Allow",
      "Action": ["states:DescribeExecution"],
      "Resource": "arn:aws:states:${region}:${account}:execution:${stage}-collectiq-revalue:*"
    }
  ]
}
```

---

### 7. healthz Handler

**Purpose**: Health check endpoint (no AWS service access needed)

**Required Permissions**: Only base CloudWatch Logs permissions

---

## Orchestration Functions

### 8. rekognition_extract Lambda

**Purpose**: Extract features from card images using Rekognition

**Required Permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3ReadPermissions",
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::${stage}-collectiq-uploads-${account}/uploads/*"
    },
    {
      "Sid": "RekognitionPermissions",
      "Effect": "Allow",
      "Action": ["rekognition:DetectText", "rekognition:DetectLabels"],
      "Resource": "*"
    },
    {
      "Sid": "KMSDecryptPermissions",
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "arn:aws:kms:${region}:${account}:key/${kms_key_id}",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "s3.${region}.amazonaws.com"
        }
      }
    }
  ]
}
```

---

### 9. aggregator Lambda

**Purpose**: Merge agent results and persist to DynamoDB

**Required Permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBWritePermissions",
      "Effect": "Allow",
      "Action": ["dynamodb:UpdateItem", "dynamodb:PutItem"],
      "Resource": "arn:aws:dynamodb:${region}:${account}:table/${stage}-CollectIQ"
    },
    {
      "Sid": "EventBridgePutEvents",
      "Effect": "Allow",
      "Action": ["events:PutEvents"],
      "Resource": "arn:aws:events:${region}:${account}:event-bus/${stage}-collectiq-events"
    }
  ]
}
```

---

### 10. error_handler Lambda

**Purpose**: Handle workflow errors and send to DLQ

**Required Permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBWritePermissions",
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem"],
      "Resource": "arn:aws:dynamodb:${region}:${account}:table/${stage}-CollectIQ"
    },
    {
      "Sid": "SQSSendMessage",
      "Effect": "Allow",
      "Action": ["sqs:SendMessage"],
      "Resource": "arn:aws:sqs:${region}:${account}:${stage}-collectiq-dlq"
    }
  ]
}
```

---

## Agent Functions

### 11. pricing_agent Lambda

**Purpose**: Fetch pricing data and invoke Bedrock for valuation

**Required Permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBCachePermissions",
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"],
      "Resource": "arn:aws:dynamodb:${region}:${account}:table/${stage}-CollectIQ"
    },
    {
      "Sid": "SecretsManagerReadPermissions",
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
      "Resource": [
        "arn:aws:secretsmanager:${region}:${account}:secret:${stage}/collectiq/ebay-api-key-*",
        "arn:aws:secretsmanager:${region}:${account}:secret:${stage}/collectiq/tcgplayer-*",
        "arn:aws:secretsmanager:${region}:${account}:secret:${stage}/collectiq/pricecharting-api-key-*"
      ]
    },
    {
      "Sid": "BedrockInvokeModel",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "arn:aws:bedrock:${region}::foundation-model/anthropic.claude-*"
    }
  ]
}
```

---

### 12. authenticity_agent Lambda

**Purpose**: Analyze card authenticity using Rekognition features and Bedrock

**Required Permissions**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3ReadPermissions",
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::${stage}-collectiq-uploads-${account}/uploads/*",
        "arn:aws:s3:::${stage}-collectiq-authentic-samples/authentic-samples/*"
      ]
    },
    {
      "Sid": "BedrockInvokeModel",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "arn:aws:bedrock:${region}::foundation-model/anthropic.claude-*"
    },
    {
      "Sid": "KMSDecryptPermissions",
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "arn:aws:kms:${region}:${account}:key/${kms_key_id}",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "s3.${region}.amazonaws.com"
        }
      }
    }
  ]
}
```

---

## API Gateway Permissions

API Gateway requires permissions to invoke Lambda functions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "APIGatewayInvokeLambda",
      "Effect": "Allow",
      "Principal": {
        "Service": "apigateway.amazonaws.com"
      },
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:${region}:${account}:function:${stage}-collectiq-*",
      "Condition": {
        "ArnLike": {
          "AWS:SourceArn": "arn:aws:execute-api:${region}:${account}:${api_id}/*"
        }
      }
    }
  ]
}
```

**Terraform Example**:

```hcl
resource "aws_lambda_permission" "api_gateway" {
  for_each = toset([
    "upload_presign",
    "cards_create",
    "cards_list",
    "cards_get",
    "cards_delete",
    "cards_revalue",
    "healthz"
  ])

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.handlers[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
```

---

## Step Functions Permissions

Step Functions requires permissions to invoke Lambda functions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "StepFunctionsInvokeLambda",
      "Effect": "Allow",
      "Action": ["lambda:InvokeFunction"],
      "Resource": [
        "arn:aws:lambda:${region}:${account}:function:${stage}-collectiq-rekognition-extract",
        "arn:aws:lambda:${region}:${account}:function:${stage}-collectiq-pricing-agent",
        "arn:aws:lambda:${region}:${account}:function:${stage}-collectiq-authenticity-agent",
        "arn:aws:lambda:${region}:${account}:function:${stage}-collectiq-aggregator",
        "arn:aws:lambda:${region}:${account}:function:${stage}-collectiq-error-handler"
      ]
    },
    {
      "Sid": "StepFunctionsLogging",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogDelivery",
        "logs:GetLogDelivery",
        "logs:UpdateLogDelivery",
        "logs:DeleteLogDelivery",
        "logs:ListLogDeliveries",
        "logs:PutResourcePolicy",
        "logs:DescribeResourcePolicies",
        "logs:DescribeLogGroups"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Common Policies

### Secrets Manager Access Policy

Reusable policy for functions that need API keys:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SecretsManagerReadPermissions",
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
      "Resource": "arn:aws:secretsmanager:${region}:${account}:secret:${stage}/collectiq/*"
    }
  ]
}
```

### DynamoDB Full Access Policy

For functions that need complete CRUD access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBFullAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:${region}:${account}:table/${stage}-CollectIQ",
        "arn:aws:dynamodb:${region}:${account}:table/${stage}-CollectIQ/index/*"
      ]
    }
  ]
}
```

---

## Terraform Module Example

Complete example for creating a Lambda execution role with least-privilege permissions:

```hcl
# Lambda execution role
resource "aws_iam_role" "lambda_execution" {
  name = "${var.stage}-collectiq-${var.function_name}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.stage
    Service     = "collectiq"
    Function    = var.function_name
  }
}

# Base CloudWatch Logs policy
resource "aws_iam_role_policy" "lambda_logs" {
  name = "${var.stage}-collectiq-${var.function_name}-logs"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.stage}-collectiq-${var.function_name}:*"
      }
    ]
  })
}

# X-Ray tracing policy
resource "aws_iam_role_policy" "lambda_xray" {
  name = "${var.stage}-collectiq-${var.function_name}-xray"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}

# Function-specific policies (attach as needed)
resource "aws_iam_role_policy" "lambda_custom" {
  count = var.custom_policy != null ? 1 : 0
  name  = "${var.stage}-collectiq-${var.function_name}-custom"
  role  = aws_iam_role.lambda_execution.id

  policy = var.custom_policy
}
```

---

## Security Best Practices

### 1. Use Resource-Based Policies

Prefer resource-based policies over identity-based policies when possible:

```hcl
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.example.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.example.arn
}
```

### 2. Scope Permissions to Specific Resources

Avoid wildcards in Resource fields:

❌ **Bad**:

```json
"Resource": "arn:aws:dynamodb:*:*:table/*"
```

✅ **Good**:

```json
"Resource": "arn:aws:dynamodb:us-east-1:123456789012:table/dev-CollectIQ"
```

### 3. Use Condition Keys

Add conditions to further restrict access:

```json
{
  "Effect": "Allow",
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::bucket/uploads/*",
  "Condition": {
    "StringEquals": {
      "s3:ExistingObjectTag/Owner": "${aws:userid}"
    }
  }
}
```

### 4. Regular Audits

Use AWS IAM Access Analyzer to identify:

- Unused permissions
- Overly permissive policies
- External access to resources

```bash
# List findings
aws accessanalyzer list-findings \
  --analyzer-arn arn:aws:access-analyzer:us-east-1:123456789012:analyzer/ConsoleAnalyzer

# Generate policy based on CloudTrail logs
aws accessanalyzer generate-policy \
  --cloud-trail-details '{"trails":[{"cloudTrailArn":"arn:aws:cloudtrail:..."}],"accessRole":"arn:aws:iam::...","startTime":"2024-01-01T00:00:00Z","endTime":"2024-12-31T23:59:59Z"}'
```

### 5. Separate Roles by Environment

Never share IAM roles between dev and prod:

```hcl
resource "aws_iam_role" "lambda_execution" {
  name = "${var.stage}-collectiq-${var.function_name}"  # stage prefix
  # ...
}
```

### 6. Enable CloudTrail Logging

Monitor all IAM actions:

```hcl
resource "aws_cloudtrail" "main" {
  name                          = "${var.stage}-collectiq-audit"
  s3_bucket_name                = aws_s3_bucket.cloudtrail.id
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true

  event_selector {
    read_write_type           = "All"
    include_management_events = true
  }
}
```

---

## Troubleshooting

### Access Denied Errors

1. **Check CloudWatch Logs** for the specific permission denied:

   ```bash
   aws logs tail /aws/lambda/dev-collectiq-cards-create --follow
   ```

2. **Verify IAM Policy** is attached to the role:

   ```bash
   aws iam list-attached-role-policies --role-name dev-collectiq-cards-create
   aws iam list-role-policies --role-name dev-collectiq-cards-create
   ```

3. **Test IAM Policy** using the IAM Policy Simulator:
   ```bash
   aws iam simulate-principal-policy \
     --policy-source-arn arn:aws:iam::123456789012:role/dev-collectiq-cards-create \
     --action-names dynamodb:PutItem \
     --resource-arns arn:aws:dynamodb:us-east-1:123456789012:table/dev-CollectIQ
   ```

### Permission Boundary Issues

If using permission boundaries, ensure they don't conflict with role policies:

```bash
aws iam get-role --role-name dev-collectiq-cards-create --query 'Role.PermissionsBoundary'
```

---

## Summary

This document provides comprehensive IAM requirements for all CollectIQ backend Lambda functions. Each function has been designed with least-privilege access, scoped to specific resources, and organized for easy Terraform implementation.

For questions or to report security concerns, contact the DevOps team.
