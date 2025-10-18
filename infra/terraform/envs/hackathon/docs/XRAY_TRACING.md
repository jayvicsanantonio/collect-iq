# X-Ray Tracing Configuration

## Overview

X-Ray distributed tracing is enabled across all CollectIQ services to provide end-to-end visibility into request flows, performance bottlenecks, and error patterns.

## Enabled Services

### ✅ Lambda Functions

All Lambda functions have X-Ray tracing enabled via the `lambda_fn` module:

- `enable_xray_tracing = true` (default)
- IAM policy: `AWSXRayDaemonWriteAccess` attached automatically
- Tracing mode: `Active`

**Lambda Functions with X-Ray:**

- `collectiq-hackathon-upload-presign`
- `collectiq-hackathon-cards-create`
- `collectiq-hackathon-cards-list`
- `collectiq-hackathon-cards-get`
- `collectiq-hackathon-cards-delete`
- `collectiq-hackathon-cards-revalue`
- `collectiq-hackathon-rekognition-extract`
- `collectiq-hackathon-pricing-agent`
- `collectiq-hackathon-authenticity-agent`
- `collectiq-hackathon-aggregator`
- `collectiq-hackathon-error-handler`

### ✅ Step Functions

The Step Functions state machine has X-Ray tracing enabled:

- `enable_xray_tracing = true` in `step_functions` module
- IAM policy for X-Ray write access attached to execution role
- Tracing configuration: `enabled = true`

**State Machine:**

- `collectiq-hackathon-card-valuation`

### ✅ API Gateway (HTTP API)

API Gateway HTTP API has detailed metrics enabled, which includes X-Ray tracing:

- `detailed_metrics_enabled = true` in stage configuration
- X-Ray trace ID included in access logs: `$context.xrayTraceId`
- Tracing propagated to downstream Lambda functions

**Note:** API Gateway will be deployed in a future task. X-Ray configuration is ready.

## Service Map

When all services are deployed, the X-Ray service map will show:

```
User Request
    ↓
API Gateway (HTTP API)
    ↓
Lambda Handler (cards_revalue)
    ↓
Step Functions (card-valuation)
    ├─→ Lambda (rekognition_extract)
    │       ↓
    │   Amazon Rekognition
    │
    ├─→ Lambda (pricing_agent)
    │       ↓
    │   External APIs (eBay, TCGPlayer, PriceCharting)
    │
    ├─→ Lambda (authenticity_agent)
    │       ↓
    │   Amazon Bedrock
    │
    └─→ Lambda (aggregator)
            ↓
        DynamoDB + EventBridge
```

## Viewing X-Ray Traces

### AWS Console

1. Navigate to **AWS X-Ray Console**
2. Select **Service Map** to view the complete request flow
3. Select **Traces** to view individual request traces
4. Filter by:
   - Time range
   - HTTP status code
   - Response time
   - Annotations (userId, cardId, etc.)

### AWS CLI

```bash
# List recent traces
aws xray get-trace-summaries \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --region us-east-1

# Get specific trace details
aws xray batch-get-traces \
  --trace-ids <trace-id> \
  --region us-east-1
```

### CloudWatch Logs Insights

Query traces by X-Ray trace ID:

```sql
fields @timestamp, @message, @xrayTraceId
| filter @xrayTraceId like /1-/
| sort @timestamp desc
| limit 100
```

## Custom Annotations and Metadata

Lambda functions can add custom annotations and metadata to X-Ray segments:

```typescript
import { captureAWS } from 'aws-xray-sdk-core';
import AWS from 'aws-sdk';

// Wrap AWS SDK clients
const dynamodb = captureAWS(new AWS.DynamoDB.DocumentClient());

// Add annotations (indexed, filterable)
const segment = AWSXRay.getSegment();
segment.addAnnotation('userId', userId);
segment.addAnnotation('cardId', cardId);

// Add metadata (not indexed, for debugging)
segment.addMetadata('cardMetadata', {
  name: 'Pikachu',
  set: 'Base Set',
  rarity: 'Common',
});
```

## Performance Analysis

### Identify Slow Requests

1. Go to X-Ray Console → Traces
2. Filter by response time > 1000ms
3. Analyze trace timeline to identify bottlenecks:
   - Lambda cold starts
   - DynamoDB query latency
   - External API calls
   - Bedrock inference time

### Identify Error Patterns

1. Filter traces by HTTP status code (4xx, 5xx)
2. Group by error type
3. Analyze error distribution across services

### Optimize Based on Insights

- **High Lambda duration**: Increase memory allocation
- **DynamoDB throttles**: Switch to provisioned capacity or increase on-demand limits
- **External API timeouts**: Implement caching or increase timeout
- **Bedrock latency**: Use smaller models or optimize prompts

## Cost Considerations

### X-Ray Pricing

- **Free Tier**: 100,000 traces recorded per month, 1,000,000 traces retrieved/scanned per month
- **Beyond Free Tier**: $5.00 per 1 million traces recorded, $0.50 per 1 million traces retrieved/scanned

### Hackathon Environment

- **Expected Usage**: ~10,000 traces/month (100 requests/day × 30 days)
- **Estimated Cost**: $0 (within free tier)

### Cost Optimization

- Use sampling rules to reduce trace volume in production
- Set retention period to 7-30 days
- Archive traces to S3 for long-term storage

## Sampling Rules

Default sampling rule (100% of requests):

```json
{
  "version": 2,
  "default": {
    "fixed_target": 1,
    "rate": 1.0
  }
}
```

For production, consider reducing sampling rate:

```json
{
  "version": 2,
  "rules": [
    {
      "description": "Sample errors at 100%",
      "http_method": "*",
      "url_path": "*",
      "fixed_target": 1,
      "rate": 1.0,
      "attributes": {
        "http.status": "5*"
      }
    },
    {
      "description": "Sample successful requests at 10%",
      "http_method": "*",
      "url_path": "*",
      "fixed_target": 1,
      "rate": 0.1
    }
  ]
}
```

## Troubleshooting

### X-Ray Traces Not Appearing

**Symptom**: No traces in X-Ray console

**Solutions**:

1. Verify IAM permissions:

   ```bash
   aws iam get-role-policy \
     --role-name collectiq-hackathon-upload-presign-role \
     --policy-name AWSXRayDaemonWriteAccess
   ```

2. Check Lambda tracing configuration:

   ```bash
   aws lambda get-function-configuration \
     --function-name collectiq-hackathon-upload-presign \
     --query 'TracingConfig'
   ```

3. Verify X-Ray daemon is running (automatic for Lambda)

### Incomplete Traces

**Symptom**: Traces show only some services

**Solutions**:

1. Ensure all AWS SDK clients are wrapped with `captureAWS()`
2. Verify downstream services have X-Ray enabled
3. Check for network issues or timeouts

### High X-Ray Costs

**Symptom**: X-Ray costs exceeding budget

**Solutions**:

1. Implement sampling rules to reduce trace volume
2. Reduce retention period
3. Archive traces to S3 for long-term storage

## References

- [AWS X-Ray Documentation](https://docs.aws.amazon.com/xray/)
- [X-Ray SDK for Node.js](https://docs.aws.amazon.com/xray/latest/devguide/xray-sdk-nodejs.html)
- [X-Ray Sampling Rules](https://docs.aws.amazon.com/xray/latest/devguide/xray-console-sampling.html)
- [X-Ray Pricing](https://aws.amazon.com/xray/pricing/)
