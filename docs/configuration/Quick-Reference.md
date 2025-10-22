# CollectIQ Quick Reference Guide

## API Endpoints

### Authentication Required

| Endpoint              | Method | Purpose             | Response Time |
| --------------------- | ------ | ------------------- | ------------- |
| `/upload/presign`     | POST   | Get S3 upload URL   | ~100ms        |
| `/cards`              | POST   | Create card record  | ~200ms        |
| `/cards`              | GET    | List user's cards   | ~150ms        |
| `/cards/{id}`         | GET    | Get card details    | ~100ms        |
| `/cards/{id}`         | DELETE | Delete card         | ~150ms        |
| `/cards/{id}/revalue` | POST   | Trigger AI analysis | ~200ms        |

### No Authentication

| Endpoint   | Method | Purpose      |
| ---------- | ------ | ------------ |
| `/healthz` | GET    | Health check |

---

## Lambda Functions

### API Handlers (API Gateway → Lambda)

1. **upload_presign** - Generate S3 presigned URLs
2. **cards_create** - Create card in DynamoDB
3. **cards_list** - List cards with pagination
4. **cards_get** - Get single card
5. **cards_delete** - Delete card
6. **cards_revalue** - Start Step Functions workflow
7. **healthz** - Health check

### Orchestration (Step Functions → Lambda)

8. **rekognition_extract** - Extract visual features
9. **pricing_agent** - Fetch market pricing
10. **authenticity_agent** - Verify authenticity
11. **aggregator** - Merge results, update DynamoDB
12. **error_handler** - Handle workflow errors

---

## Step Functions Workflow

```
START
  ↓
rekognition_extract (5-10s)
  ↓
┌─────────────────────┐
│  Parallel Agents    │
├─────────┬───────────┤
│ pricing │authenticity│
│ (8-15s) │  (8-15s)  │
└─────────┴───────────┘
  ↓
aggregator (2-3s)
  ↓
END

Total: 15-25 seconds
```

---

## User Flows

### Current Flow (Manual Trigger)

```
Upload → Create Card → View Card → Click "Analyze" → Wait → Results
```

### Auto-Trigger Flow (Recommended)

```
Upload → Create Card → Auto-Analyze → View Processing → Results
```

---

## Configuration

### Auto-Trigger Configuration

**Backend (Lambda Environment Variables):**

```bash
# Lambda: cards_create
AUTO_TRIGGER_REVALUE=true
EVENT_BUS_NAME=collectiq-hackathon-events
```

**Frontend:**

No frontend configuration needed - auto-trigger is handled entirely by the backend via EventBridge.

**Enable/Disable:**

```bash
# Disable auto-trigger
aws events disable-rule \
  --name card_created_auto_revalue \
  --event-bus-name collectiq-hackathon-events

# Re-enable
aws events enable-rule \
  --name card_created_auto_revalue \
  --event-bus-name collectiq-hackathon-events
```

---

## Common Commands

### Development

```bash
# Install dependencies
pnpm install

# Start frontend dev server
pnpm web:dev

# Build backend Lambda functions
cd services/backend
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

### Infrastructure

```bash
# Navigate to Terraform directory
cd infra/terraform/envs/hackathon

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply changes
terraform apply

# Destroy infrastructure
terraform destroy
```

### AWS CLI

```bash
# List Lambda functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `collectiq`)].FunctionName'

# View Lambda logs
aws logs tail /aws/lambda/collectiq-hackathon-cards-create --follow

# List Step Functions executions
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:123456789012:stateMachine:collectiq-hackathon-card-valuation

# Describe execution
aws stepfunctions describe-execution \
  --execution-arn arn:aws:states:us-east-1:123456789012:execution:collectiq-hackathon-card-valuation:xxx
```

---

## Troubleshooting

### Card stuck in processing

**Check:**

1. Step Functions execution status
2. Lambda CloudWatch logs
3. DynamoDB for partial results

**Fix:**

```bash
# View execution history
aws stepfunctions get-execution-history \
  --execution-arn <execution-arn>

# Manually trigger revaluation
curl -X POST https://api.collectiq.com/cards/{id}/revalue \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"forceRefresh": true}'
```

### Upload fails

**Common causes:**

- File too large (> 12MB)
- Invalid format (not JPG/PNG/HEIC)
- Presigned URL expired (> 60s)
- Network error

**Fix:**

1. Compress image
2. Convert to supported format
3. Retry upload
4. Check browser console for errors

### Authentication errors

**Check:**

1. JWT token is valid
2. Token not expired
3. User has access to resource

**Fix:**

```bash
# Refresh token
# (handled automatically by frontend)

# Verify token
aws cognito-idp get-user \
  --access-token $ACCESS_TOKEN
```

---

## Monitoring

### CloudWatch Dashboards

- **API Gateway:** Request count, latency, errors
- **Lambda:** Invocations, duration, errors, throttles
- **Step Functions:** Executions, success rate, duration
- **DynamoDB:** Read/write capacity, throttles

### Key Metrics

| Metric                  | Threshold | Action                    |
| ----------------------- | --------- | ------------------------- |
| API Gateway 5xx         | > 1%      | Check Lambda logs         |
| Lambda errors           | > 5%      | Check function code       |
| Step Functions failures | > 10%     | Check workflow definition |
| DynamoDB throttles      | > 0       | Increase capacity         |

### Alarms

Create CloudWatch alarms for:

- High error rate (> 5%)
- High latency (> 3s p99)
- Low success rate (< 95%)
- Throttling events

---

## Cost Estimates

### Per Card Upload (with auto-trigger)

| Service                | Cost         |
| ---------------------- | ------------ |
| API Gateway            | $0.0000035   |
| Lambda (7 invocations) | $0.0000014   |
| Step Functions         | $0.000025    |
| Rekognition            | $0.001       |
| Bedrock (Claude)       | $0.003       |
| DynamoDB               | $0.0000001   |
| S3                     | $0.00001     |
| **Total**              | **~$0.0041** |

### Monthly Estimates

| Volume        | Cost    |
| ------------- | ------- |
| 1,000 cards   | $4.10   |
| 10,000 cards  | $41.00  |
| 100,000 cards | $410.00 |

_Note: Pricing data API costs not included (varies by provider)_

---

## Security Checklist

- [ ] JWT authentication enabled on all protected endpoints
- [ ] User-scoped data isolation (DynamoDB partition key)
- [ ] S3 presigned URLs expire in 60 seconds
- [ ] CORS configured for frontend domain only
- [ ] Secrets stored in AWS Secrets Manager
- [ ] Encryption at rest enabled (S3, DynamoDB)
- [ ] TLS 1.2+ enforced for all API calls
- [ ] IAM roles follow least privilege principle
- [ ] CloudWatch logs retention set to 30 days
- [ ] VPC endpoints configured for AWS services

---

## Performance Optimization

### Frontend

- [ ] SWR for client-side caching
- [ ] Image lazy loading
- [ ] Code splitting by route
- [ ] Debounced search inputs
- [ ] Optimistic UI updates

### Backend

- [ ] DynamoDB single-table design
- [ ] Pricing data cached for 14 days
- [ ] Parallel agent execution
- [ ] Lambda right-sized memory
- [ ] VPC endpoints (no NAT Gateway)

### Infrastructure

- [ ] CloudFront CDN for static assets
- [ ] API Gateway caching (future)
- [ ] DynamoDB DAX (future)
- [ ] Lambda provisioned concurrency (if needed)

---

## Testing

### Unit Tests

```bash
# Frontend
cd apps/web
pnpm test

# Backend
cd services/backend
pnpm test
```

### Integration Tests

```bash
# E2E tests
cd apps/web
pnpm test:e2e

# Backend E2E
cd services/backend
pnpm test:e2e
```

### Manual Testing

1. **Upload Flow**
   - Upload image → Verify S3 upload → Verify card created
2. **Analysis Flow**
   - Trigger revalue → Wait 20s → Verify results

3. **Vault Flow**
   - List cards → View card → Delete card

4. **Error Handling**
   - Upload invalid file → Verify error message
   - Trigger revalue twice → Verify idempotency

---

## Deployment

### Frontend (Amplify)

```bash
# Automatic deployment on git push to main
git push origin main

# Manual deployment
cd apps/web
pnpm build
# Upload to Amplify console
```

### Backend (Lambda)

```bash
# Build Lambda functions
cd services/backend
pnpm build

# Deploy via Terraform
cd infra/terraform/envs/hackathon
terraform apply
```

### Infrastructure (Terraform)

```bash
cd infra/terraform/envs/hackathon

# Plan changes
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan

# Verify deployment
terraform output
```

---

## Useful Links

- **AWS Console:** https://console.aws.amazon.com
- **API Gateway:** https://console.aws.amazon.com/apigateway
- **Lambda:** https://console.aws.amazon.com/lambda
- **Step Functions:** https://console.aws.amazon.com/states
- **DynamoDB:** https://console.aws.amazon.com/dynamodb
- **CloudWatch:** https://console.aws.amazon.com/cloudwatch
- **Cognito:** https://console.aws.amazon.com/cognito

---

## Support

For issues or questions:

1. Check [API Flow Documentation](./API_FLOW.md)
2. Check [Auto-Trigger Guide](./AUTO_TRIGGER_REVALUE.md)
3. Review CloudWatch logs
4. Contact DevOps team

---

**Last Updated:** 2024-01-15  
**Version:** 1.0.0
