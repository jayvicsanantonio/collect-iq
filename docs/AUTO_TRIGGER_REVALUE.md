# Auto-Trigger Revaluation Implementation Guide

## ⚠️ Implementation Status

**✅ IMPLEMENTED:** Backend auto-trigger via EventBridge (Option 2)  
**❌ NOT IMPLEMENTED:** Frontend auto-trigger (Option 1)

The CollectIQ project uses the **backend EventBridge approach** for production. This document describes all options for reference, but Option 2 is the implemented solution.

## Overview

This guide shows how to automatically trigger the AI analysis workflow (`POST /cards/{id}/revalue`) immediately after a user uploads and creates a card.

**Current Implementation:** Backend EventBridge (see Option 2 below)

---

## Quick Start

### ⚠️ Recommended Approach: Backend Auto-Trigger (EventBridge)

**The frontend auto-trigger approach is NOT recommended.** Use the backend EventBridge approach for production.

### Option 1: Frontend Auto-Trigger (NOT RECOMMENDED)

**Time to implement:** ~5 minutes  
**Complexity:** Low  
**Best for:** Quick prototyping only (not production)

#### Step 1: Add Feature Flag

Create or update `apps/web/lib/config.ts`:

```typescript
/**
 * Feature flags for CollectIQ
 */
export const FEATURES = {
  /**
   * Automatically trigger AI analysis after card upload
   * Set to false to require manual "Analyze" button click
   */
  AUTO_TRIGGER_REVALUE: true,

  /**
   * Force refresh pricing data on auto-trigger
   * Set to false to use cached pricing if available
   */
  REVALUE_FORCE_REFRESH: false,
} as const;
```

#### Step 2: Update Upload Flow

Modify `apps/web/app/(protected)/upload/page.tsx`:

```typescript
// Find this section (around line 135):
const card = await api.createCard({
  frontS3Key: presignResponse.key,
});

// Step 5: Redirect to card detail/processing screen
toast({
  title: 'Card created',
  description: 'Analyzing your card...',
});

setTimeout(() => {
  const cardUrl = `/cards/${card.cardId}` as Route;
  router.push(cardUrl);
}, 500);
```

**Replace with:**

```typescript
import { FEATURES } from '@/lib/config';

// ... existing code ...

const card = await api.createCard({
  frontS3Key: presignResponse.key,
});

// Step 5: Automatically trigger AI analysis (if enabled)
if (FEATURES.AUTO_TRIGGER_REVALUE) {
  try {
    await api.revalueCard(card.cardId, {
      forceRefresh: FEATURES.REVALUE_FORCE_REFRESH,
    });

    toast({
      title: 'Card created',
      description: 'AI analysis started. This may take 15-25 seconds...',
    });
  } catch (error) {
    console.error('Failed to trigger revaluation:', error);

    // Don't block the flow - user can manually retry
    toast({
      title: 'Card created',
      description: 'Click "Analyze Card" to start AI analysis.',
      variant: 'default',
    });
  }
} else {
  toast({
    title: 'Card created',
    description: 'Click "Analyze Card" to start AI analysis.',
  });
}

// Step 6: Redirect to card detail/processing screen
setTimeout(() => {
  const cardUrl = `/cards/${card.cardId}` as Route;
  router.push(cardUrl);
}, 500);
```

#### Step 3: Update Card Detail Page

The card detail page already handles processing state and polling. No changes needed!

The page will:

1. Detect card is processing (missing `authenticityScore` or `valueLow`)
2. Show `CardProcessing` component with progress
3. Poll `GET /cards/{id}` every 3 seconds
4. Display results when complete

#### Step 4: Test

1. Upload a card image
2. Verify you see "AI analysis started" toast
3. Verify redirect to `/cards/{id}` shows processing state
4. Verify results appear after ~15-25 seconds

---

## Option 2: Environment Variable Configuration

For production deployments, use environment variables instead of hardcoded flags.

#### Step 1: Add Environment Variables

**File:** `apps/web/.env.local`

```bash
# Auto-trigger AI analysis after card upload
NEXT_PUBLIC_AUTO_TRIGGER_REVALUE=true

# Force refresh pricing data (set to false to use cache)
NEXT_PUBLIC_REVALUE_FORCE_REFRESH=false
```

#### Step 2: Update Config

**File:** `apps/web/lib/config.ts`

```typescript
/**
 * Feature flags for CollectIQ
 * Configured via environment variables
 */
export const FEATURES = {
  AUTO_TRIGGER_REVALUE: process.env.NEXT_PUBLIC_AUTO_TRIGGER_REVALUE === 'true',

  REVALUE_FORCE_REFRESH: process.env.NEXT_PUBLIC_REVALUE_FORCE_REFRESH === 'true',
} as const;
```

#### Step 3: Deploy

Environment variables can be configured per environment:

- **Development:** `.env.local`
- **Staging:** Amplify environment variables
- **Production:** Amplify environment variables

---

## Option 3: Backend Auto-Trigger (EventBridge)

**Time to implement:** ~30 minutes  
**Complexity:** Medium  
**Best for:** Production-grade, event-driven architecture

### Architecture

```
cards_create Lambda
  ↓
Emit "CardCreated" event
  ↓
EventBridge Rule
  ↓
Step Functions (auto-start)
```

### Implementation

#### Step 1: Update `cards_create` Lambda

**File:** `services/backend/src/handlers/cards_create.ts`

Add EventBridge client import:

```typescript
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
```

Add after card creation (around line 60):

```typescript
// Create card in DynamoDB with tracing
const card = await tracing.trace(
  'dynamodb_create_card',
  () => createCard(userId, cardData, requestId),
  { userId, requestId }
);

// Emit CardCreated event for auto-trigger (if enabled)
if (process.env.AUTO_TRIGGER_REVALUE === 'true') {
  try {
    const eventBridgeClient = new EventBridgeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    await eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: 'collectiq.cards',
            DetailType: 'CardCreated',
            Detail: JSON.stringify({
              cardId: card.cardId,
              userId: card.userId,
              frontS3Key: card.frontS3Key,
              backS3Key: card.backS3Key,
              name: card.name,
              set: card.set,
              number: card.number,
              rarity: card.rarity,
              conditionEstimate: card.conditionEstimate,
              timestamp: new Date().toISOString(),
            }),
            EventBusName: process.env.EVENT_BUS_NAME || 'collectiq-hackathon-events',
          },
        ],
      })
    );

    logger.info('CardCreated event emitted', {
      cardId: card.cardId,
      userId,
      requestId,
    });
  } catch (error) {
    // Don't fail card creation if event emission fails
    logger.error(
      'Failed to emit CardCreated event',
      error instanceof Error ? error : new Error(String(error)),
      { cardId: card.cardId, userId, requestId }
    );
  }
}

logger.info('Card created successfully', {
  operation: 'cards_create',
  userId,
  cardId: card.cardId,
  requestId,
});
```

#### Step 2: Update Lambda IAM Policy

**File:** `infra/terraform/envs/hackathon/lambdas.tf`

Update `cards_create_dynamodb` policy:

```hcl
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

  # Add EventBridge permissions
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
```

#### Step 3: Add EventBridge Rule

**File:** `infra/terraform/envs/hackathon/main.tf`

Update EventBridge module (around line 215):

```hcl
module "eventbridge_bus" {
  source = "../../modules/eventbridge_bus"

  bus_name = "${local.name_prefix}-events"

  # Event rules for card processing workflow
  event_rules = {
    # Auto-trigger revaluation when card is created
    card_created_auto_revalue = {
      description = "Automatically trigger AI analysis when card is created"
      event_pattern = jsonencode({
        source      = ["collectiq.cards"]
        detail-type = ["CardCreated"]
      })
      target_arn           = module.step_functions.state_machine_arn
      target_type          = "stepfunctions"
      target_role_arn      = aws_iam_role.eventbridge_sfn_role.arn
      input_transformer = {
        input_paths = {
          cardId             = "$.detail.cardId"
          userId             = "$.detail.userId"
          frontS3Key         = "$.detail.frontS3Key"
          backS3Key          = "$.detail.backS3Key"
          name               = "$.detail.name"
          set                = "$.detail.set"
          number             = "$.detail.number"
          rarity             = "$.detail.rarity"
          conditionEstimate  = "$.detail.conditionEstimate"
        }
        input_template = <<EOF
{
  "userId": <userId>,
  "cardId": <cardId>,
  "s3Keys": {
    "front": <frontS3Key>
  },
  "cardMeta": {
    "name": <name>,
    "set": <set>,
    "number": <number>,
    "rarity": <rarity>,
    "conditionEstimate": <conditionEstimate>,
    "frontS3Key": <frontS3Key>
  },
  "requestId": "$$.Execution.Name",
  "forceRefresh": false
}
EOF
      }
    }
  }

  dlq_message_retention_seconds = 1209600 # 14 days
  retry_maximum_event_age       = 86400   # 24 hours
  retry_maximum_retry_attempts  = 3

  tags = local.common_tags
}
```

#### Step 4: Create IAM Role for EventBridge

**File:** `infra/terraform/envs/hackathon/main.tf`

Add after EventBridge module:

```hcl
# IAM role for EventBridge to invoke Step Functions
resource "aws_iam_role" "eventbridge_sfn_role" {
  name = "${local.name_prefix}-eventbridge-sfn-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "events.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "eventbridge_sfn_policy" {
  name = "${local.name_prefix}-eventbridge-sfn-policy"
  role = aws_iam_role.eventbridge_sfn_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "states:StartExecution"
      ]
      Resource = [
        module.step_functions.state_machine_arn
      ]
    }]
  })
}
```

#### Step 5: Update Lambda Environment Variables

**File:** `infra/terraform/envs/hackathon/lambdas.tf`

Update `cards_create` Lambda environment:

```hcl
environment_variables = {
  REGION                = var.aws_region
  DDB_TABLE             = module.dynamodb_collectiq.table_name
  COGNITO_USER_POOL_ID  = "" # Will be added when Cognito is deployed
  XRAY_ENABLED          = "false"
  AUTO_TRIGGER_REVALUE  = "true"  # Enable auto-trigger
  EVENT_BUS_NAME        = module.eventbridge_bus.bus_name
}
```

#### Step 6: Deploy Infrastructure

```bash
cd infra/terraform/envs/hackathon
terraform plan
terraform apply
```

#### Step 7: Test

1. Upload a card via frontend
2. Check CloudWatch logs for `cards_create` Lambda
3. Verify "CardCreated event emitted" log entry
4. Check Step Functions console for new execution
5. Verify card detail page shows processing state

---

## Comparison Matrix

| Feature                 | Frontend Trigger | EventBridge Trigger      |
| ----------------------- | ---------------- | ------------------------ |
| **Implementation Time** | 5 minutes        | 30 minutes               |
| **Complexity**          | Low              | Medium                   |
| **Coupling**            | Tight            | Loose                    |
| **Testability**         | Easy             | Moderate                 |
| **Scalability**         | Good             | Excellent                |
| **Extensibility**       | Limited          | High                     |
| **Error Handling**      | Frontend retry   | EventBridge retry        |
| **Monitoring**          | Frontend logs    | CloudWatch Events        |
| **Cost**                | 2 API calls      | 1 API call + EventBridge |
| **Latency**             | ~100ms           | ~200ms (eventual)        |

---

## Recommendations

### ✅ Recommended: Backend EventBridge (IMPLEMENTED)

**Use EventBridge Auto-Trigger (Option 2)**

- ✅ Decoupled architecture
- ✅ Easy to add more event consumers (notifications, analytics)
- ✅ Better error handling and retry logic
- ✅ Scales better with traffic
- ✅ Production-ready
- ✅ **This is the implemented solution in this project**

### ❌ Not Recommended: Frontend Trigger

**Avoid Frontend Auto-Trigger (Option 1)**

- ❌ Tight coupling between frontend and backend
- ❌ Less reliable (depends on frontend execution)
- ❌ Harder to extend with additional consumers
- ❌ Not suitable for production
- ❌ Requires two API calls from frontend

### ⚠️ Alternative: Hybrid Approach (Not Implemented)

You could implement both, but it's unnecessary:

1. Frontend trigger for immediate feedback
2. EventBridge as backup (with deduplication check)

**Note:** The backend EventBridge approach alone is sufficient and recommended.

---

## Troubleshooting

### Issue: Revaluation not triggered

**Check:**

1. Feature flag is enabled: `FEATURES.AUTO_TRIGGER_REVALUE === true`
2. Card was created successfully (check response)
3. No errors in browser console
4. Backend logs show revalue request

**Solution:**

- Check CloudWatch logs for `cards_revalue` Lambda
- Verify Step Functions execution started
- Check for 409 Conflict (workflow already running)

### Issue: Duplicate executions

**Cause:** Both frontend and EventBridge triggering

**Solution:**

- Disable one trigger method
- Add idempotency check in `cards_revalue` Lambda (already implemented)

### Issue: EventBridge rule not firing

**Check:**

1. Event pattern matches emitted event
2. IAM role has permissions
3. Target is configured correctly

**Debug:**

```bash
# Check EventBridge metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name TriggeredRules \
  --dimensions Name=RuleName,Value=card_created_auto_revalue \
  --start-time 2024-01-15T00:00:00Z \
  --end-time 2024-01-15T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### Issue: Step Functions fails immediately

**Check:**

1. Input format matches state machine definition
2. Lambda functions are deployed
3. IAM permissions are correct

**Debug:**

- View execution history in Step Functions console
- Check input/output for each state
- Review CloudWatch logs for Lambda errors

---

## Monitoring

### CloudWatch Metrics

**Frontend Trigger:**

- `cards_revalue` Lambda invocations
- `cards_revalue` Lambda errors
- `cards_revalue` Lambda duration

**EventBridge Trigger:**

- EventBridge rule invocations
- EventBridge failed invocations
- Step Functions executions started

### CloudWatch Alarms

Create alarms for:

1. High error rate on `cards_revalue` Lambda
2. EventBridge rule failures
3. Step Functions execution failures
4. Long execution times (> 60 seconds)

### Dashboard

Create CloudWatch dashboard with:

- Cards created per hour
- Revaluations triggered per hour
- Success rate
- Average execution time
- Error rate by Lambda function

---

## Cost Analysis

### Frontend Trigger

- **API Gateway:** 2 requests per upload ($3.50 per million)
- **Lambda:** 2 invocations per upload ($0.20 per million)
- **Total:** ~$0.0000074 per upload

### EventBridge Trigger

- **API Gateway:** 1 request per upload
- **EventBridge:** 1 event per upload ($1.00 per million)
- **Lambda:** 1 invocation per upload
- **Total:** ~$0.0000047 per upload

**Savings:** ~$0.0000027 per upload (36% cheaper)

**At scale:**

- 10,000 uploads/month: Save $0.03/month
- 100,000 uploads/month: Save $0.27/month
- 1,000,000 uploads/month: Save $2.70/month

_Note: Savings are minimal. Choose based on architecture needs, not cost._

---

## Testing

### Unit Tests

**Frontend:**

```typescript
// apps/web/lib/__tests__/upload-flow.test.ts
describe('Auto-trigger revaluation', () => {
  it('should trigger revaluation after card creation', async () => {
    const mockCreateCard = jest.fn().mockResolvedValue({ cardId: '123' });
    const mockRevalueCard = jest.fn().mockResolvedValue({ executionArn: 'arn:...' });

    // ... test implementation
  });
});
```

**Backend:**

```typescript
// services/backend/src/handlers/__tests__/cards_create.test.ts
describe('cards_create with auto-trigger', () => {
  it('should emit CardCreated event when enabled', async () => {
    process.env.AUTO_TRIGGER_REVALUE = 'true';

    // ... test implementation
  });
});
```

### Integration Tests

```bash
# Test end-to-end flow
curl -X POST https://api.collectiq.com/cards \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"frontS3Key": "uploads/user123/test.jpg"}'

# Verify Step Functions execution started
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:123456789012:stateMachine:collectiq-hackathon-card-valuation \
  --status-filter RUNNING
```

---

## Rollback Plan

If auto-trigger causes issues:

### Frontend Trigger

1. Set `FEATURES.AUTO_TRIGGER_REVALUE = false`
2. Redeploy frontend
3. Users must manually click "Analyze Card"

### EventBridge Trigger

1. Disable EventBridge rule:
   ```bash
   aws events disable-rule --name card_created_auto_revalue
   ```
2. Or set `AUTO_TRIGGER_REVALUE=false` in Lambda environment
3. Redeploy infrastructure

---

## Next Steps

After implementing auto-trigger:

1. **Add Progress Notifications**
   - WebSocket for real-time updates
   - Push notifications when analysis completes

2. **Batch Processing**
   - Upload multiple cards at once
   - Queue for sequential processing

3. **Smart Scheduling**
   - Delay analysis during peak hours
   - Prioritize premium users

4. **Cost Optimization**
   - Cache pricing data longer
   - Skip analysis for duplicate cards

---

## Related Documentation

- [API Flow Documentation](./API_FLOW.md)
- [Step Functions Architecture](../infra/terraform/modules/step_functions/README.md)
- [EventBridge Configuration](../infra/terraform/modules/eventbridge_bus/README.md)

---

**Last Updated:** 2024-01-15  
**Version:** 1.0.0  
**Maintained By:** CollectIQ Engineering Team
