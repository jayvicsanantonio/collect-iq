# Step Functions Deployment Guide

## Prerequisites

Before deploying the Step Functions state machine, ensure the following resources are already deployed:

- [x] S3 uploads bucket (`module.s3_uploads`)
- [x] DynamoDB table (`module.dynamodb_collectiq`)
- [x] Rekognition access IAM policy (`module.rekognition_access`)
- [x] Bedrock access IAM policy (`module.bedrock_access`)
- [x] All Lambda functions:
  - [x] `lambda_rekognition_extract`
  - [x] `lambda_pricing_agent`
  - [x] `lambda_authenticity_agent`
  - [x] `lambda_aggregator`
  - [x] `lambda_error_handler`
  - [x] `lambda_cards_revalue`

## Deployment Steps

### Step 1: Validate Terraform Configuration

```bash
cd infra/terraform/envs/hackathon
terraform validate
```

### Step 2: Plan Step Functions Deployment

```bash
terraform plan -target=module.step_functions
```

Review the plan to ensure:

- State machine will be created with correct name
- IAM role has permissions to invoke all Lambda functions
- CloudWatch Logs group will be created
- X-Ray tracing is enabled

### Step 3: Deploy Step Functions

```bash
terraform apply -target=module.step_functions
```

Type `yes` when prompted to confirm.

### Step 4: Verify Deployment

```bash
# Get state machine ARN
terraform output step_functions_state_machine_arn

# Verify state machine exists
aws stepfunctions describe-state-machine \
  --state-machine-arn $(terraform output -raw step_functions_state_machine_arn)
```

### Step 5: Update cards_revalue Lambda

The `cards_revalue` Lambda needs the Step Functions ARN in its environment variables.

**Option A: Update via Terraform (Recommended)**

1. Edit `lambdas.tf` and find the `lambda_cards_revalue` module
2. Change the `STEP_FUNCTIONS_ARN` environment variable:

```hcl
environment_variables = {
  AWS_REGION           = var.aws_region
  STEP_FUNCTIONS_ARN   = try(module.step_functions.state_machine_arn, "")
  DDB_TABLE            = module.dynamodb_collectiq.table_name
}
```

3. Apply the change:

```bash
terraform apply -target=module.lambda_cards_revalue
```

**Option B: Update via AWS CLI**

```bash
aws lambda update-function-configuration \
  --function-name collectiq-hackathon-cards-revalue \
  --environment "Variables={AWS_REGION=us-east-1,STEP_FUNCTIONS_ARN=$(terraform output -raw step_functions_state_machine_arn),DDB_TABLE=collectiq-hackathon-cards}" \
  --region us-east-1
```

### Step 6: Test Execution

Create a test input file (`test-input.json`):

```json
{
  "userId": "test-user-123",
  "cardId": "test-card-456",
  "s3Key": "uploads/test-user-123/test-card.jpg",
  "s3Bucket": "collectiq-hackathon-uploads-123456789012",
  "cardMetadata": {
    "name": "Pikachu",
    "set": "Base Set",
    "number": "58",
    "rarity": "Common"
  }
}
```

**Note**: Before running this test, ensure you have uploaded a test image to S3 at the specified key.

Start a test execution:

```bash
aws stepfunctions start-execution \
  --state-machine-arn $(terraform output -raw step_functions_state_machine_arn) \
  --name test-execution-$(date +%s) \
  --input file://test-input.json
```

### Step 7: Monitor Execution

```bash
# List recent executions
aws stepfunctions list-executions \
  --state-machine-arn $(terraform output -raw step_functions_state_machine_arn) \
  --max-results 10

# Get execution details (replace with actual execution ARN)
aws stepfunctions describe-execution \
  --execution-arn <execution-arn>

# View execution history
aws stepfunctions get-execution-history \
  --execution-arn <execution-arn>
```

### Step 8: Check CloudWatch Logs

```bash
# View Step Functions logs
aws logs tail /aws/vendedlogs/states/collectiq-hackathon-card-valuation --follow

# View Lambda logs
aws logs tail /aws/lambda/collectiq-hackathon-rekognition-extract --follow
aws logs tail /aws/lambda/collectiq-hackathon-pricing-agent --follow
aws logs tail /aws/lambda/collectiq-hackathon-authenticity-agent --follow
aws logs tail /aws/lambda/collectiq-hackathon-aggregator --follow
```

## Verification Checklist

- [ ] State machine created successfully
- [ ] IAM role has correct permissions
- [ ] CloudWatch Logs group exists
- [ ] X-Ray tracing enabled
- [ ] cards_revalue Lambda has Step Functions ARN
- [ ] Test execution completes successfully
- [ ] All Lambda functions invoked correctly
- [ ] Results persisted to DynamoDB
- [ ] CloudWatch Logs show execution details

## Troubleshooting

### State Machine Creation Failed

**Error**: `InvalidDefinition: Invalid State Machine Definition`

**Solution**: Validate the ASL definition:

```bash
aws stepfunctions validate-state-machine-definition \
  --definition file://state-machine-definition.json
```

### Lambda Invocation Failed

**Error**: `Lambda.ResourceNotFoundException`

**Solution**: Verify Lambda ARNs in the state machine definition:

```bash
# Check if Lambda functions exist
aws lambda list-functions --query 'Functions[?contains(FunctionName, `collectiq-hackathon`)].FunctionName'
```

### Permission Denied

**Error**: `AccessDeniedException: User is not authorized to perform: lambda:InvokeFunction`

**Solution**: Verify Step Functions IAM role has permissions:

```bash
aws iam get-role-policy \
  --role-name collectiq-hackathon-card-valuation-role \
  --policy-name collectiq-hackathon-card-valuation-invoke-lambda
```

### Execution Timeout

**Error**: Execution times out after 60 seconds

**Solution**: Check Lambda function timeouts and increase if needed:

```bash
aws lambda get-function-configuration \
  --function-name collectiq-hackathon-rekognition-extract \
  --query 'Timeout'
```

## Cost Estimation

### Step Functions Costs

- **State Transitions**: $0.025 per 1,000 transitions
- **Typical Workflow**: 6-8 transitions per execution
- **100 executions/day**: ~$0.05/month

### CloudWatch Logs Costs

- **Log Ingestion**: $0.50 per GB
- **Log Storage**: $0.03 per GB/month
- **Typical Workflow**: ~10 KB per execution
- **100 executions/day**: ~$0.15/month

### Total Estimated Cost

- **Step Functions + Logs**: ~$0.20/month for 100 executions/day
- **Lambda costs**: See Lambda pricing (separate)

## Next Steps

After successfully deploying Step Functions:

1. [ ] Deploy EventBridge event bus (Task 6)
2. [ ] Create CloudWatch dashboards (Task 6)
3. [ ] Set up CloudWatch alarms (Task 6)
4. [ ] Configure CI/CD pipeline (Task 7)
5. [ ] Perform end-to-end testing (Task 13)

## References

- [AWS Step Functions Documentation](https://docs.aws.amazon.com/step-functions/)
- [Amazon States Language Specification](https://states-language.net/spec.html)
- [Step Functions Best Practices](https://docs.aws.amazon.com/step-functions/latest/dg/bp-express.html)
- [Step Functions Pricing](https://aws.amazon.com/step-functions/pricing/)
