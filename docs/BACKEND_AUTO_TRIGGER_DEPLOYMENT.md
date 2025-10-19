# Backend Auto-Trigger Deployment Guide

## Overview

This guide walks you through deploying the backend auto-trigger feature, where EventBridge automatically starts the AI analysis workflow when a card is created.

---

## Architecture

```
User uploads card
  ↓
Frontend: POST /cards (create card)
  ↓
cards_create Lambda
  ├─ Creates card in DynamoDB
  └─ Emits "CardCreated" event to EventBridge
      ↓
EventBridge Rule (card_created_auto_revalue)
  ↓
Step Functions (auto-start)
  ├─ rekognition_extract
  ├─ pricing_agent (parallel)
  ├─ authenticity_agent (parallel)
  └─ aggregator
      ↓
Card updated with results
```

**Key Benefits:**

- ✅ Fully automated - no frontend changes needed
- ✅ Decoupled architecture - easy to extend
- ✅ Event-driven - can add more consumers (notifications, analytics)
- ✅ Users can still manually trigger revaluation for updates

---

## Prerequisites

Before deploying:

1. **Backend Lambda functions built:**

   ```bash
   cd services/backend
   pnpm install
   pnpm build
   ```

2. **Terraform initialized:**

   ```bash
   cd infra/terraform/envs/hackathon
   terraform init
   ```

3. **AWS credentials configured:**
   ```bash
   aws configure
   # or
   export AWS_PROFILE=your-profile
   ```

---

## Deployment Steps

### Step 1: Review Changes

The following files have been modified:

1. **`services/backend/src/handlers/cards_create.ts`**
   - Added EventBridge client
   - Added `emitCardCreatedEvent()` function
   - Emits event after card creation (if `AUTO_TRIGGER_REVALUE=true`)

2. **`infra/terraform/envs/hackathon/lambdas.tf`**
   - Updated `cards_create` IAM policy to allow `events:PutEvents`
   - Added environment variables:
     - `AUTO_TRIGGER_REVALUE=true`
     - `EVENT_BUS_NAME=collectiq-hackathon-events`

3. **`infra/terraform/envs/hackathon/main.tf`**
   - Added EventBridge rule `card_created_auto_revalue`
   - Added IAM role `eventbridge_sfn_role` for Step Functions invocation
   - Configured input transformer to map event to Step Functions input

4. **`infra/terraform/modules/eventbridge_bus/main.tf`**
   - Added `role_arn` support for Step Functions targets

5. **`apps/web/app/(protected)/upload/page.tsx`**
   - Updated toast message to indicate automatic analysis

### Step 2: Build Backend

```bash
cd services/backend
pnpm build
```

**Verify build output:**

```bash
ls -la dist/handlers/cards_create.mjs
# Should show the compiled file
```

### Step 3: Plan Infrastructure Changes

```bash
cd infra/terraform/envs/hackathon
terraform plan -out=tfplan
```

**Expected changes:**

- `aws_iam_role.eventbridge_sfn_role` - **CREATE**
- `aws_iam_role_policy.eventbridge_sfn_policy` - **CREATE**
- `aws_cloudwatch_event_rule.rules["card_created_auto_revalue"]` - **CREATE**
- `aws_cloudwatch_event_target.targets["card_created_auto_revalue"]` - **CREATE**
- `module.lambda_cards_create` - **UPDATE** (environment variables, IAM policy)

**Review the plan carefully!**

### Step 4: Apply Infrastructure Changes

```bash
terraform apply tfplan
```

**Expected output:**

```
Apply complete! Resources: 4 added, 1 changed, 0 destroyed.
```

### Step 5: Verify Deployment

#### 5.1 Check Lambda Environment Variables

```bash
aws lambda get-function-configuration \
  --function-name collectiq-hackathon-cards-create \
  --query 'Environment.Variables' \
  --output json
```

**Expected output:**

```json
{
  "REGION": "us-east-1",
  "DDB_TABLE": "collectiq-hackathon-cards",
  "AUTO_TRIGGER_REVALUE": "true",
  "EVENT_BUS_NAME": "collectiq-hackathon-events"
}
```

#### 5.2 Check EventBridge Rule

```bash
aws events list-rules \
  --event-bus-name collectiq-hackathon-events \
  --query 'Rules[?Name==`card_created_auto_revalue`]' \
  --output json
```

**Expected output:**

```json
[
  {
    "Name": "card_created_auto_revalue",
    "Arn": "arn:aws:events:us-east-1:123456789012:rule/collectiq-hackathon-events/card_created_auto_revalue",
    "State": "ENABLED",
    "Description": "Automatically trigger AI analysis when card is created",
    "EventBusName": "collectiq-hackathon-events"
  }
]
```

#### 5.3 Check EventBridge Target

```bash
aws events list-targets-by-rule \
  --rule card_created_auto_revalue \
  --event-bus-name collectiq-hackathon-events \
  --output json
```

**Expected output:**

```json
{
  "Targets": [
    {
      "Id": "card_created_auto_revalue-target",
      "Arn": "arn:aws:states:us-east-1:123456789012:stateMachine:collectiq-hackathon-card-valuation",
      "RoleArn": "arn:aws:iam::123456789012:role/collectiq-hackathon-eventbridge-sfn-role",
      "InputTransformer": {
        "InputPathsMap": {
          "cardId": "$.detail.cardId",
          "userId": "$.detail.userId",
          ...
        },
        "InputTemplate": "..."
      }
    }
  ]
}
```

#### 5.4 Check IAM Role

```bash
aws iam get-role \
  --role-name collectiq-hackathon-eventbridge-sfn-role \
  --output json
```

**Verify the role has permission to invoke Step Functions.**

---

## Testing

### Test 1: End-to-End Flow

1. **Upload a card via frontend:**

   ```bash
   # Navigate to http://localhost:3000/upload
   # Upload a card image
   ```

2. **Check CloudWatch logs for `cards_create` Lambda:**

   ```bash
   aws logs tail /aws/lambda/collectiq-hackathon-cards-create --follow
   ```

   **Look for:**

   ```
   Card created successfully
   Emitting CardCreated event for auto-trigger
   CardCreated event emitted successfully
   ```

3. **Check EventBridge metrics:**

   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Events \
     --metric-name TriggeredRules \
     --dimensions Name=RuleName,Value=card_created_auto_revalue \
     --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Sum
   ```

   **Expected:** `Sum: 1` (or more if you uploaded multiple cards)

4. **Check Step Functions execution:**

   ```bash
   aws stepfunctions list-executions \
     --state-machine-arn arn:aws:states:us-east-1:123456789012:stateMachine:collectiq-hackathon-card-valuation \
     --status-filter RUNNING \
     --max-results 10
   ```

   **Expected:** At least one execution with status `RUNNING`

5. **Wait 20-30 seconds and check card in DynamoDB:**

   ```bash
   aws dynamodb get-item \
     --table-name collectiq-hackathon-cards \
     --key '{"PK":{"S":"USER#<userId>"},"SK":{"S":"CARD#<cardId>"}}' \
     --output json
   ```

   **Expected:** Card should have `authenticityScore` and `valueMedian` populated

### Test 2: Manual Trigger Still Works

1. **Navigate to card detail page:**

   ```
   http://localhost:3000/cards/{cardId}
   ```

2. **Click "Refresh" or "Retry Analysis" button**

3. **Verify new Step Functions execution starts:**

   ```bash
   aws stepfunctions list-executions \
     --state-machine-arn arn:aws:states:us-east-1:123456789012:stateMachine:collectiq-hackathon-card-valuation \
     --max-results 5
   ```

   **Expected:** New execution with recent `startDate`

### Test 3: Idempotency Check

1. **Upload a card**
2. **Immediately click "Refresh" on card detail page**
3. **Check Step Functions executions:**

   ```bash
   aws stepfunctions list-executions \
     --state-machine-arn arn:aws:states:us-east-1:123456789012:stateMachine:collectiq-hackathon-card-valuation \
     --max-results 10
   ```

4. **Verify:** Only one execution is running (idempotency check in `cards_revalue` Lambda prevents duplicates)

---

## Monitoring

### CloudWatch Dashboards

Create a dashboard to monitor auto-trigger:

```bash
aws cloudwatch put-dashboard \
  --dashboard-name CollectIQ-AutoTrigger \
  --dashboard-body file://dashboard.json
```

**dashboard.json:**

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Events", "TriggeredRules", { "stat": "Sum" }],
          ["AWS/Events", "FailedInvocations", { "stat": "Sum" }]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "EventBridge Auto-Trigger"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/States", "ExecutionsStarted", { "stat": "Sum" }],
          ["AWS/States", "ExecutionsSucceeded", { "stat": "Sum" }],
          ["AWS/States", "ExecutionsFailed", { "stat": "Sum" }]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Step Functions Executions"
      }
    }
  ]
}
```

### CloudWatch Alarms

Create alarms for failures:

```bash
# Alarm for EventBridge failed invocations
aws cloudwatch put-metric-alarm \
  --alarm-name collectiq-eventbridge-failures \
  --alarm-description "Alert when EventBridge fails to invoke Step Functions" \
  --metric-name FailedInvocations \
  --namespace AWS/Events \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold

# Alarm for Step Functions failures
aws cloudwatch put-metric-alarm \
  --alarm-name collectiq-stepfunctions-failures \
  --alarm-description "Alert when Step Functions executions fail" \
  --metric-name ExecutionsFailed \
  --namespace AWS/States \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 3 \
  --comparison-operator GreaterThanThreshold
```

### Key Metrics to Watch

| Metric            | Namespace  | Threshold                    | Action                 |
| ----------------- | ---------- | ---------------------------- | ---------------------- |
| TriggeredRules    | AWS/Events | Should match card creations  | Check EventBridge rule |
| FailedInvocations | AWS/Events | Should be 0                  | Check IAM permissions  |
| ExecutionsStarted | AWS/States | Should match triggered rules | Check Step Functions   |
| ExecutionsFailed  | AWS/States | Should be < 10%              | Check Lambda logs      |

---

## Troubleshooting

### Issue 1: EventBridge Rule Not Triggering

**Symptoms:**

- Card created but no Step Functions execution
- No "CardCreated event emitted" in logs

**Debug:**

```bash
# Check if event is being emitted
aws logs filter-log-events \
  --log-group-name /aws/lambda/collectiq-hackathon-cards-create \
  --filter-pattern "CardCreated event emitted" \
  --start-time $(date -u -d '10 minutes ago' +%s)000

# Check EventBridge metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name TriggeredRules \
  --dimensions Name=RuleName,Value=card_created_auto_revalue \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Solutions:**

1. Verify `AUTO_TRIGGER_REVALUE=true` in Lambda environment
2. Check EventBridge rule is enabled
3. Verify event pattern matches emitted event
4. Check CloudWatch logs for errors

### Issue 2: Step Functions Not Starting

**Symptoms:**

- EventBridge rule triggered but no execution
- FailedInvocations metric > 0

**Debug:**

```bash
# Check EventBridge failed invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name FailedInvocations \
  --dimensions Name=RuleName,Value=card_created_auto_revalue \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Check IAM role permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/collectiq-hackathon-eventbridge-sfn-role \
  --action-names states:StartExecution \
  --resource-arns arn:aws:states:us-east-1:123456789012:stateMachine:collectiq-hackathon-card-valuation
```

**Solutions:**

1. Verify IAM role has `states:StartExecution` permission
2. Check Step Functions state machine ARN is correct
3. Verify input transformer format matches state machine input
4. Check EventBridge target configuration

### Issue 3: Duplicate Executions

**Symptoms:**

- Multiple Step Functions executions for same card
- Wasted API costs

**Debug:**

```bash
# List executions for a specific card
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:123456789012:stateMachine:collectiq-hackathon-card-valuation \
  --max-results 50 \
  | jq '.executions[] | select(.name | contains("<cardId>"))'
```

**Solutions:**

1. Verify idempotency check in `cards_revalue` Lambda
2. Check for duplicate EventBridge events
3. Ensure frontend doesn't call `revalueCard()` after upload
4. Add execution name deduplication in Step Functions

### Issue 4: Input Transformer Errors

**Symptoms:**

- Step Functions execution fails immediately
- Error: "Invalid input"

**Debug:**

```bash
# Get execution details
aws stepfunctions describe-execution \
  --execution-arn <execution-arn> \
  --output json

# Check input format
aws stepfunctions get-execution-history \
  --execution-arn <execution-arn> \
  --max-results 1 \
  --output json
```

**Solutions:**

1. Verify input transformer template matches state machine input schema
2. Check all required fields are present in event detail
3. Ensure JSON encoding is correct
4. Test input transformer with sample event

---

## Rollback Plan

If auto-trigger causes issues:

### Option 1: Disable via Environment Variable

```bash
# Update Lambda environment variable
aws lambda update-function-configuration \
  --function-name collectiq-hackathon-cards-create \
  --environment "Variables={REGION=us-east-1,DDB_TABLE=collectiq-hackathon-cards,AUTO_TRIGGER_REVALUE=false,EVENT_BUS_NAME=collectiq-hackathon-events}"

# Wait for update to complete
aws lambda wait function-updated \
  --function-name collectiq-hackathon-cards-create
```

### Option 2: Disable EventBridge Rule

```bash
# Disable the rule (keeps configuration)
aws events disable-rule \
  --name card_created_auto_revalue \
  --event-bus-name collectiq-hackathon-events
```

### Option 3: Full Rollback via Terraform

```bash
cd infra/terraform/envs/hackathon

# Revert changes in main.tf (remove event rule)
# Revert changes in lambdas.tf (set AUTO_TRIGGER_REVALUE=false)

terraform plan -out=tfplan
terraform apply tfplan
```

---

## Performance Impact

### Latency

- **cards_create Lambda:** +50-100ms (EventBridge PutEvents call)
- **Step Functions start:** ~200ms (EventBridge → Step Functions)
- **Total overhead:** ~300ms

**User experience:** No noticeable impact (async operation)

### Cost

**Per card upload:**

- EventBridge event: $0.000001 ($1 per million events)
- EventBridge rule evaluation: Free
- Step Functions execution: $0.000025

**Total additional cost:** ~$0.000026 per upload

**At scale:**

- 10,000 uploads/month: $0.26/month
- 100,000 uploads/month: $2.60/month

---

## Security Considerations

### IAM Permissions

The EventBridge role has minimal permissions:

- `states:StartExecution` on specific state machine only
- No access to DynamoDB, S3, or other services

### Event Data

The CardCreated event contains:

- Card metadata (name, set, rarity)
- S3 keys (already user-scoped)
- User ID (from JWT)

**No sensitive data** (passwords, tokens, etc.) is included.

### Audit Trail

All events are logged:

- EventBridge events (CloudWatch Events)
- Step Functions executions (CloudWatch Logs)
- Lambda invocations (CloudWatch Logs)

---

## Next Steps

After successful deployment:

1. **Monitor for 24 hours:**
   - Check CloudWatch dashboards
   - Review error rates
   - Verify cost impact

2. **Add notifications:**
   - SNS topic for execution failures
   - Email alerts for high error rates

3. **Optimize:**
   - Adjust retry policies
   - Fine-tune timeout values
   - Add caching for pricing data

4. **Extend:**
   - Add more event consumers (notifications, analytics)
   - Implement batch processing
   - Add price change alerts

---

## Related Documentation

- [API Flow Documentation](./API_FLOW.md)
- [Auto-Trigger Implementation Guide](./AUTO_TRIGGER_REVALUE.md)
- [Quick Reference](./QUICK_REFERENCE.md)

---

## Support

For deployment issues:

1. Check CloudWatch logs
2. Review this troubleshooting guide
3. Check AWS Console for service status
4. Contact DevOps team

---

**Last Updated:** 2024-01-15  
**Version:** 1.0.0  
**Maintained By:** CollectIQ DevOps Team
