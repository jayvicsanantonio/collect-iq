# Step Functions Multi-Agent Workflow

## Overview

The CollectIQ Step Functions state machine orchestrates a multi-agent AI workflow for card valuation and authenticity verification. The workflow follows this sequence:

1. **RekognitionExtract**: Extract visual features from card images using Amazon Rekognition
2. **ParallelAgents**: Execute pricing and authenticity agents concurrently
   - **PricingAgent**: Fetch pricing data from eBay, TCGPlayer, and PriceCharting
   - **AuthenticityAgent**: Verify card authenticity using Amazon Bedrock
3. **Aggregator**: Merge results, persist to DynamoDB, and emit EventBridge events
4. **ErrorHandler**: Handle failures and route to DLQ

## State Machine Type

**STANDARD** - Chosen for:

- Auditability (execution history retained for 90 days)
- Long-running workflows (up to 1 year)
- Exactly-once execution semantics
- Support for human approval steps (future enhancement)

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Start Execution                          │
│                  (userId, cardId, s3Key)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              RekognitionExtract Lambda                      │
│  • DetectText (OCR for card name, set, number)             │
│  • DetectLabels (holographic patterns, condition)          │
│  • Border metrics, font analysis, quality signals          │
│  Output: FeatureEnvelope                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Parallel Execution                         │
│  ┌──────────────────────────┬──────────────────────────┐   │
│  │   PricingAgent Lambda    │  AuthenticityAgent Lambda│   │
│  │  • eBay sold listings    │  • Bedrock Claude 3.5    │   │
│  │  • TCGPlayer market data │  • Perceptual hashing    │   │
│  │  • PriceCharting comps   │  • Holographic analysis  │   │
│  │  • Compute valuation     │  • Authenticity score    │   │
│  │  Output: PricingResult   │  Output: AuthResult      │   │
│  └──────────────────────────┴──────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Aggregator Lambda                           │
│  • Merge pricing and authenticity results                  │
│  • Persist to DynamoDB (card record + pricing history)     │
│  • Emit EventBridge events (CardValuationUpdated)          │
│  Output: Success                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    End Execution                            │
└─────────────────────────────────────────────────────────────┘

                    Error Path
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                ErrorHandler Lambda                          │
│  • Log error details to CloudWatch                         │
│  • Send to DLQ for manual review                           │
│  • Update card status to "error" in DynamoDB               │
└─────────────────────────────────────────────────────────────┘
```

## Input Schema

```json
{
  "userId": "user-123",
  "cardId": "card-456",
  "s3Key": "uploads/user-123/card-456.jpg",
  "s3Bucket": "collectiq-hackathon-uploads-123456789012",
  "cardMetadata": {
    "name": "Charizard",
    "set": "Base Set",
    "number": "4",
    "rarity": "Holo Rare"
  }
}
```

## Output Schema

```json
{
  "userId": "user-123",
  "cardId": "card-456",
  "aggregatorResult": {
    "Payload": {
      "status": "success",
      "cardId": "card-456",
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

## Error Handling

### Retry Policy

All Lambda tasks have the following retry configuration:

- **MaxAttempts**: 3
- **IntervalSeconds**: 2
- **BackoffRate**: 2.0
- **ErrorEquals**: Lambda service exceptions and throttling

This means:

- Attempt 1: Immediate
- Attempt 2: After 2 seconds
- Attempt 3: After 4 seconds
- Attempt 4: After 8 seconds

### Fallback Behavior

If an agent fails after all retries:

- **PricingAgent**: Returns default values (valueMedian: 0, confidence: 0)
- **AuthenticityAgent**: Returns neutral score (authenticityScore: 0.5, confidence: 0)
- Workflow continues to Aggregator with partial results

### Catch-All Error Handler

If any critical failure occurs:

1. Execution transitions to ErrorHandler Lambda
2. Error details logged to CloudWatch
3. Message sent to DLQ for manual review
4. Card status updated to "error" in DynamoDB

## Performance Characteristics

- **RekognitionExtract**: ~2-5 seconds
- **ParallelAgents**: ~10-30 seconds (concurrent execution)
  - PricingAgent: ~5-15 seconds (external API calls)
  - AuthenticityAgent: ~5-20 seconds (Bedrock inference)
- **Aggregator**: ~1-2 seconds
- **Total Workflow**: ~15-40 seconds

## Cost Optimization

- **State Machine Type**: STANDARD (more expensive than EXPRESS, but needed for auditability)
- **Log Level**: ERROR only (reduces CloudWatch Logs costs)
- **Execution Data**: Not logged (reduces storage costs)
- **Parallel Execution**: Reduces total workflow time by ~50%

## Monitoring

### CloudWatch Metrics

- `ExecutionsFailed`: Number of failed executions
- `ExecutionsSucceeded`: Number of successful executions
- `ExecutionTime`: Duration of executions
- `ExecutionsTimedOut`: Number of timed-out executions

### CloudWatch Alarms

- Failed executions > 10 in 15 minutes → Page on-call
- Execution time > 60 seconds (P95) → Slack notification

### X-Ray Tracing

- Enabled for all Lambda functions and Step Functions
- Service map shows complete request flow
- Trace analysis for slow executions

## Deployment

### Prerequisites

1. All Lambda functions must be deployed first
2. DynamoDB table must exist
3. S3 uploads bucket must exist

### Deploy Step Functions

```bash
cd infra/terraform/envs/hackathon
terraform init
terraform plan -target=module.step_functions
terraform apply -target=module.step_functions
```

### Verify Deployment

```bash
# Get state machine ARN
terraform output step_functions_state_machine_arn

# Test execution (AWS CLI)
aws stepfunctions start-execution \
  --state-machine-arn $(terraform output -raw step_functions_state_machine_arn) \
  --input file://test-input.json
```

## Testing

### Manual Test Execution

Create a test input file:

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

Start execution:

```bash
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:us-east-1:123456789012:stateMachine:collectiq-hackathon-card-valuation \
  --name test-execution-$(date +%s) \
  --input file://test-input.json
```

### View Execution History

```bash
# List executions
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:123456789012:stateMachine:collectiq-hackathon-card-valuation

# Describe execution
aws stepfunctions describe-execution \
  --execution-arn <execution-arn>

# Get execution history
aws stepfunctions get-execution-history \
  --execution-arn <execution-arn>
```

## Troubleshooting

### Execution Failed

1. Check CloudWatch Logs for error details
2. Review X-Ray traces for bottlenecks
3. Verify Lambda function permissions
4. Check DLQ for error messages

### Slow Execution

1. Review X-Ray service map for latency sources
2. Check external API response times (eBay, TCGPlayer)
3. Verify Bedrock model availability
4. Consider increasing Lambda memory allocation

### Lambda Timeout

1. Increase Lambda timeout (currently 5 minutes for agents)
2. Optimize external API calls (caching, parallel requests)
3. Consider breaking into smaller tasks

## Future Enhancements

- [ ] Add human approval step for high-value cards
- [ ] Implement workflow versioning for A/B testing
- [ ] Add SNS notifications for completed valuations
- [ ] Implement workflow replay for failed executions
- [ ] Add custom metrics for business KPIs
