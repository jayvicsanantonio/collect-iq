# Lambda Function Deployment Guide

This document describes the Lambda function deployment configuration for the CollectIQ hackathon environment.

## Prerequisites

1. **Build Lambda Functions**: Before deploying, build the Lambda functions from the backend service:

   ```bash
   cd services/backend
   pnpm run build
   ```

2. **Terraform Initialized**: Ensure Terraform is initialized in the hackathon environment:
   ```bash
   cd infra/terraform/envs/hackathon
   terraform init
   ```

## Deployed Lambda Functions

### API Handler Functions (512MB, 30s timeout)

1. **upload_presign** - Generate presigned URLs for S3 uploads
   - Handler: `upload_presign.handler`
   - Permissions: `s3:PutObject` on `uploads/*` prefix
   - Environment Variables:
     - `BUCKET_UPLOADS`: S3 bucket name
     - `MAX_UPLOAD_MB`: Maximum upload size (12MB)
     - `ALLOWED_UPLOAD_MIME`: Allowed MIME types

2. **cards_create** - Create new card records
   - Handler: `cards_create.handler`
   - Permissions: `dynamodb:PutItem`
   - Environment Variables:
     - `DDB_TABLE`: DynamoDB table name
     - `COGNITO_USER_POOL_ID`: Cognito user pool ID

3. **cards_list** - List user's cards with pagination
   - Handler: `cards_list.handler`
   - Permissions: `dynamodb:Query` on table and GSI1
   - Environment Variables:
     - `DDB_TABLE`: DynamoDB table name
     - `COGNITO_USER_POOL_ID`: Cognito user pool ID

4. **cards_get** - Get specific card by ID
   - Handler: `cards_get.handler`
   - Permissions: `dynamodb:GetItem`
   - Environment Variables:
     - `DDB_TABLE`: DynamoDB table name
     - `COGNITO_USER_POOL_ID`: Cognito user pool ID

5. **cards_delete** - Delete specific card
   - Handler: `cards_delete.handler`
   - Permissions: `dynamodb:DeleteItem`, `dynamodb:GetItem`
   - Environment Variables:
     - `DDB_TABLE`: DynamoDB table name
     - `COGNITO_USER_POOL_ID`: Cognito user pool ID
     - `HARD_DELETE_CARDS`: Set to "true" for hard delete (default: "false")

6. **cards_revalue** - Trigger Step Functions workflow
   - Handler: `cards_revalue.handler`
   - Permissions: `states:StartExecution`, `states:ListExecutions`, `dynamodb:GetItem`
   - Environment Variables:
     - `STEP_FUNCTIONS_ARN`: Step Functions state machine ARN
     - `DDB_TABLE`: DynamoDB table name

### Orchestration Functions (1024MB, 5min timeout)

7. **rekognition_extract** - Extract visual features using Rekognition
   - Handler: `rekognition-extract.handler`
   - Permissions: `rekognition:DetectText`, `rekognition:DetectLabels`, `s3:GetObject`
   - Environment Variables:
     - `BUCKET_UPLOADS`: S3 bucket name

8. **pricing_agent** - Fetch pricing data from external APIs
   - Handler: `pricing-agent.handler`
   - Permissions: `secretsmanager:GetSecretValue` (when secrets are configured)
   - Environment Variables:
     - `DDB_TABLE`: DynamoDB table name
     - `EBAY_SECRET_ARN`: eBay API key secret ARN
     - `TCGPLAYER_SECRET_ARN`: TCGPlayer API keys secret ARN
     - `PRICECHARTING_SECRET_ARN`: PriceCharting API key secret ARN

9. **authenticity_agent** - Verify authenticity using Bedrock
   - Handler: `authenticity_agent.handler`
   - Permissions: `bedrock:InvokeModel`, `s3:GetObject`
   - Environment Variables:
     - `BEDROCK_MODEL_ID`: Bedrock model ID (Claude 3.5 Sonnet)
     - `BUCKET_UPLOADS`: S3 bucket name
     - `BUCKET_SAMPLES`: Optional authentic samples bucket

10. **aggregator** - Aggregate results and persist to DynamoDB
    - Handler: `aggregator.handler`
    - Permissions: `dynamodb:UpdateItem`, `dynamodb:GetItem`, `events:PutEvents`
    - Environment Variables:
      - `DDB_TABLE`: DynamoDB table name
      - `EVENT_BUS_NAME`: EventBridge bus name

11. **error_handler** - Handle Step Functions errors
    - Handler: `error-handler.handler`
    - Permissions: `sqs:SendMessage`, `dynamodb:UpdateItem`
    - Environment Variables:
      - `DLQ_URL`: SQS DLQ URL
      - `DDB_TABLE`: DynamoDB table name

## Deployment Steps

### 1. Build Lambda Functions

```bash
cd services/backend
pnpm run build
```

This creates bundled `.mjs` files in `services/backend/dist/`.

### 2. Plan Terraform Changes

```bash
cd infra/terraform/envs/hackathon
terraform plan
```

Review the planned changes to ensure all Lambda functions will be created correctly.

### 3. Apply Terraform Configuration

```bash
terraform apply
```

Type `yes` when prompted to confirm the deployment.

### 4. Verify Deployment

Check that all Lambda functions are created:

```bash
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `hackathon-collectiq`)].FunctionName'
```

### 5. Test Lambda Functions

Test the upload_presign function:

```bash
aws lambda invoke \
  --function-name hackathon-collectiq-upload-presign \
  --payload '{"body": "{\"filename\": \"test.jpg\", \"contentType\": \"image/jpeg\", \"sizeBytes\": 1024}"}' \
  response.json
```

## API Gateway Integration

The Lambda functions are ready for API Gateway integration. The invoke ARNs are available as Terraform outputs:

- `lambda_upload_presign_invoke_arn`
- `lambda_cards_create_invoke_arn`
- `lambda_cards_list_invoke_arn`
- `lambda_cards_get_invoke_arn`
- `lambda_cards_delete_invoke_arn`
- `lambda_cards_revalue_invoke_arn`

These will be used in task 4 to create API Gateway routes and integrations.

## Monitoring

All Lambda functions have:

- X-Ray tracing enabled
- CloudWatch Logs with 30-day retention
- CloudWatch metrics for invocations, errors, duration, and throttles

View logs:

```bash
aws logs tail /aws/lambda/hackathon-collectiq-upload-presign --follow
```

## Updating Lambda Functions

To update Lambda function code:

1. Make changes to source code in `services/backend/src/`
2. Rebuild: `cd services/backend && pnpm run build`
3. Re-apply Terraform: `cd infra/terraform/envs/hackathon && terraform apply`

Terraform will detect the source code hash change and update the Lambda functions.

## Troubleshooting

### Lambda Function Not Found

Ensure the build step completed successfully and the `.mjs` files exist in `services/backend/dist/`.

### Permission Denied Errors

Check IAM policies in `lambdas.tf`. Each Lambda function has a custom IAM policy document defining its permissions.

### Environment Variable Missing

Update the `environment_variables` block in `lambdas.tf` and re-apply Terraform.

### Cold Start Issues

For production, consider enabling provisioned concurrency for critical functions. For hackathon, cold starts are acceptable.

## Next Steps

- **Task 4 (remaining)**: Create API Gateway integrations for the Lambda functions
- **Task 5**: Configure Step Functions workflow to orchestrate the Lambda functions
- **Task 6**: Set up CloudWatch dashboards and alarms for monitoring
