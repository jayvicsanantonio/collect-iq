# Quick Test: Step Functions Workflow

## Prerequisites

1. Upload a test card image to S3:

```bash
# Set variables
BUCKET_NAME="collectiq-hackathon-uploads-$(aws sts get-caller-identity --query Account --output text)"
USER_ID="test-user-123"
CARD_ID="test-card-$(date +%s)"
IMAGE_FILE="path/to/your/test-card.jpg"

# Upload image
aws s3 cp $IMAGE_FILE s3://$BUCKET_NAME/uploads/$USER_ID/$CARD_ID.jpg
```

2. Get the Step Functions ARN:

```bash
cd infra/terraform/envs/hackathon
STATE_MACHINE_ARN=$(terraform output -raw step_functions_state_machine_arn)
echo $STATE_MACHINE_ARN
```

## Test Execution

### 1. Create Test Input

Create `test-input.json`:

```json
{
  "userId": "test-user-123",
  "cardId": "test-card-1234567890",
  "s3Key": "uploads/test-user-123/test-card-1234567890.jpg",
  "s3Bucket": "collectiq-hackathon-uploads-123456789012",
  "cardMetadata": {
    "name": "Charizard",
    "set": "Base Set",
    "number": "4",
    "rarity": "Holo Rare"
  }
}
```

**Note**: Replace the bucket name and s3Key with your actual values.

### 2. Start Execution

```bash
EXECUTION_ARN=$(aws stepfunctions start-execution \
  --state-machine-arn $STATE_MACHINE_ARN \
  --name test-execution-$(date +%s) \
  --input file://test-input.json \
  --query 'executionArn' \
  --output text)

echo "Execution started: $EXECUTION_ARN"
```

### 3. Monitor Execution

```bash
# Check execution status
aws stepfunctions describe-execution \
  --execution-arn $EXECUTION_ARN \
  --query 'status' \
  --output text

# Wait for completion (polls every 5 seconds)
while true; do
  STATUS=$(aws stepfunctions describe-execution \
    --execution-arn $EXECUTION_ARN \
    --query 'status' \
    --output text)
  echo "Status: $STATUS"
  if [ "$STATUS" = "SUCCEEDED" ] || [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "TIMED_OUT" ] || [ "$STATUS" = "ABORTED" ]; then
    break
  fi
  sleep 5
done
```

### 4. View Results

```bash
# Get execution output
aws stepfunctions describe-execution \
  --execution-arn $EXECUTION_ARN \
  --query 'output' \
  --output text | jq .

# View execution history
aws stepfunctions get-execution-history \
  --execution-arn $EXECUTION_ARN \
  --max-results 100
```

### 5. Check CloudWatch Logs

```bash
# Step Functions logs
aws logs tail /aws/vendedlogs/states/collectiq-hackathon-card-valuation --follow

# Lambda logs
aws logs tail /aws/lambda/collectiq-hackathon-rekognition-extract --since 5m
aws logs tail /aws/lambda/collectiq-hackathon-pricing-agent --since 5m
aws logs tail /aws/lambda/collectiq-hackathon-authenticity-agent --since 5m
aws logs tail /aws/lambda/collectiq-hackathon-aggregator --since 5m
```

### 6. Verify DynamoDB Record

```bash
# Query DynamoDB for the card record
aws dynamodb get-item \
  --table-name collectiq-hackathon-cards \
  --key '{"PK":{"S":"USER#test-user-123"},"SK":{"S":"CARD#test-card-1234567890"}}' \
  --output json | jq .
```

## Expected Results

### Successful Execution Output

```json
{
  "userId": "test-user-123",
  "cardId": "test-card-1234567890",
  "aggregatorResult": {
    "Payload": {
      "status": "success",
      "cardId": "test-card-1234567890",
      "valuation": {
        "valueMedian": 450.0,
        "valueLow": 350.0,
        "valueHigh": 550.0,
        "confidence": 0.85,
        "sources": ["eBay", "TCGPlayer", "PriceCharting"]
      },
      "authenticity": {
        "authenticityScore": 0.92,
        "confidence": 0.88,
        "rationale": "Card exhibits authentic holographic patterns and correct font metrics"
      },
      "timestamp": "2025-10-16T12:34:56.789Z"
    }
  }
}
```

### Execution Timeline

1. **RekognitionExtract** (2-5 seconds)
   - Extracts text, labels, and visual features
   - Outputs FeatureEnvelope

2. **ParallelAgents** (10-30 seconds)
   - PricingAgent: Fetches pricing data
   - AuthenticityAgent: Analyzes authenticity

3. **Aggregator** (1-2 seconds)
   - Merges results
   - Persists to DynamoDB
   - Emits EventBridge event

**Total**: 15-40 seconds

## Troubleshooting

### Execution Failed

```bash
# Get error details
aws stepfunctions describe-execution \
  --execution-arn $EXECUTION_ARN \
  --query 'cause' \
  --output text
```

### Lambda Timeout

If a Lambda function times out, check the logs:

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/collectiq-hackathon-rekognition-extract \
  --filter-pattern "Task timed out"
```

### Permission Denied

Verify IAM permissions:

```bash
aws iam get-role-policy \
  --role-name collectiq-hackathon-card-valuation-role \
  --policy-name collectiq-hackathon-card-valuation-invoke-lambda
```

## Cleanup

```bash
# Delete test image from S3
aws s3 rm s3://$BUCKET_NAME/uploads/$USER_ID/$CARD_ID.jpg

# Delete test record from DynamoDB
aws dynamodb delete-item \
  --table-name collectiq-hackathon-cards \
  --key '{"PK":{"S":"USER#test-user-123"},"SK":{"S":"CARD#test-card-1234567890"}}'
```

## Performance Metrics

Monitor these metrics in CloudWatch:

- `ExecutionTime`: Duration of workflow execution
- `ExecutionsSucceeded`: Number of successful executions
- `ExecutionsFailed`: Number of failed executions
- `ExecutionsTimedOut`: Number of timed-out executions

## Next Steps

After successful testing:

1. Deploy EventBridge event bus (Task 6)
2. Set up CloudWatch dashboards (Task 6)
3. Configure CloudWatch alarms (Task 6)
4. Perform end-to-end testing with real card images (Task 13)
