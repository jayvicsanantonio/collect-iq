# CollectIQ Documentation

Welcome to the CollectIQ documentation! This directory contains comprehensive guides for understanding and working with the CollectIQ platform.

---

## 📚 Documentation Index

### Getting Started

- **[Current Implementation](../CURRENT_IMPLEMENTATION.md)** - ✅ What's currently implemented (start here!)
- **[Quick Start](../QUICK_START.md)** - Deploy in 3 steps
- **[Quick Reference](./QUICK_REFERENCE.md)** - Fast lookup for common tasks, commands, and configurations
- **[Project Specification](./Project%20Specification.md)** - High-level overview of the project
- **[Market Opportunity](./Market%20Opportunity.md)** - Business context and market analysis

### Architecture & API

- **[API Flow Documentation](./API_FLOW.md)** - Complete guide to Lambda functions, endpoints, and data flow
- **[Auto-Trigger Revaluation Guide](./AUTO_TRIGGER_REVALUE.md)** - How to automatically trigger AI analysis after upload

### Domain-Specific Guides

- **[Frontend/](./Frontend/)** - Next.js app architecture, components, and UI patterns
- **[Backend/](./Backend/)** - Lambda functions, Step Functions, and AI agents
- **[DevOps/](./DevOps/)** - Infrastructure, deployment, and monitoring

### Product Requirements

- **[Hackathon - Product Requirements](./Hackathon%20-%20Product%20Requirements.md)** - MVP scope for hackathon
- **[Venture - Product Requirements](./Venture%20-%20Product%20Requirements.md)** - Long-term product vision

---

## 🚀 Quick Start

### For Developers

1. **Understand the architecture:**
   - Read [API Flow Documentation](./API_FLOW.md)
   - Review [Quick Reference](./QUICK_REFERENCE.md)

2. **Set up your environment:**

   ```bash
   # Clone repository
   git clone https://github.com/your-org/collect-iq.git
   cd collect-iq

   # Install dependencies
   pnpm install

   # Copy environment variables
   cp apps/web/.env.example apps/web/.env.local
   # Fill in your values

   # Start development server
   pnpm web:dev
   ```

3. **Enable auto-trigger (optional):**
   - Follow [Auto-Trigger Guide](./AUTO_TRIGGER_REVALUE.md)
   - Set `NEXT_PUBLIC_AUTO_TRIGGER_REVALUE=true` in `.env.local`

### For DevOps

1. **Deploy infrastructure:**

   ```bash
   cd infra/terraform/envs/hackathon
   terraform init
   terraform plan
   terraform apply
   ```

2. **Configure services:**
   - Set up Cognito user pool
   - Configure API Gateway
   - Deploy Lambda functions
   - Create Step Functions state machine

3. **Monitor deployment:**
   - Check CloudWatch dashboards
   - Set up alarms
   - Review logs

---

## 🏗️ Architecture Overview

### High-Level Flow

```
User → Next.js Frontend → API Gateway → Lambda Functions
                                            ↓
                                    Step Functions
                                            ↓
                        ┌───────────────────┴───────────────────┐
                        ↓                                       ↓
                  Rekognition                            Bedrock (Claude)
                        ↓                                       ↓
                        └───────────────────┬───────────────────┘
                                            ↓
                                      DynamoDB + S3
```

### Key Components

- **Frontend:** Next.js 14 with App Router, Tailwind CSS, shadcn/ui
- **API:** API Gateway HTTP API with JWT authentication
- **Compute:** AWS Lambda (Node.js 20)
- **Orchestration:** Step Functions for multi-agent workflow
- **AI/ML:** Amazon Rekognition + Amazon Bedrock (Claude)
- **Database:** DynamoDB (single-table design)
- **Storage:** S3 with presigned URLs
- **Auth:** Amazon Cognito with OAuth 2.0

---

## 📖 Key Concepts

### Lambda Functions

CollectIQ uses 12 Lambda functions:

**API Handlers (7):**

1. `upload_presign` - Generate S3 upload URLs
2. `cards_create` - Create card records
3. `cards_list` - List user's cards
4. `cards_get` - Get card details
5. `cards_delete` - Delete cards
6. `cards_revalue` - Trigger AI analysis
7. `healthz` - Health check

**Orchestration (5):** 8. `rekognition_extract` - Extract visual features 9. `pricing_agent` - Fetch market pricing 10. `authenticity_agent` - Verify authenticity 11. `aggregator` - Merge results 12. `error_handler` - Handle errors

### Step Functions Workflow

The AI analysis workflow runs in 3 stages:

1. **Extraction** (5-10s) - Rekognition extracts visual features
2. **Parallel Analysis** (8-15s) - Pricing and authenticity agents run simultaneously
3. **Aggregation** (2-3s) - Results merged and saved to DynamoDB

**Total time:** 15-25 seconds

### Auto-Trigger Options

**Option 1: Frontend Trigger (Recommended for MVP)**

- Simple implementation
- Easy to test and debug
- User-controlled

**Option 2: EventBridge Trigger (Recommended for Production)**

- Decoupled architecture
- Event-driven
- Scalable

See [Auto-Trigger Guide](./AUTO_TRIGGER_REVALUE.md) for implementation details.

---

## 🔧 Configuration

### Environment Variables

**Frontend (`apps/web/.env.local`):**

```bash
NEXT_PUBLIC_API_URL=https://api.collectiq.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_AUTO_TRIGGER_REVALUE=true
NEXT_PUBLIC_REVALUE_FORCE_REFRESH=false
```

**Backend (Lambda environment variables):**

```bash
REGION=us-east-1
DDB_TABLE=collectiq-hackathon-cards
BUCKET_UPLOADS=collectiq-hackathon-uploads-123456789012
STEP_FUNCTIONS_ARN=arn:aws:states:us-east-1:123456789012:stateMachine:...
```

### Feature Flags

**Backend Configuration:**

Auto-trigger is controlled via backend Lambda environment variables:

```bash
# Lambda: cards_create
AUTO_TRIGGER_REVALUE=true  # Enable auto-trigger via EventBridge
EVENT_BUS_NAME=collectiq-hackathon-events
```

**Frontend:**

No frontend feature flags needed - auto-trigger is handled entirely by the backend via EventBridge.

---

## 🧪 Testing

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
# Frontend E2E
cd apps/web
pnpm test:e2e

# Backend E2E
cd services/backend
pnpm test:e2e
```

### Manual Testing

1. Upload a card image
2. Verify auto-trigger starts analysis
3. Wait for results (~20 seconds)
4. Verify pricing and authenticity data

---

## 📊 Monitoring

### CloudWatch Dashboards

- API Gateway metrics (requests, latency, errors)
- Lambda metrics (invocations, duration, errors)
- Step Functions metrics (executions, success rate)
- DynamoDB metrics (read/write capacity)

### Key Metrics to Watch

- **API Gateway 5xx errors:** Should be < 1%
- **Lambda errors:** Should be < 5%
- **Step Functions failures:** Should be < 10%
- **Average execution time:** Should be < 30s

### Alarms

Set up CloudWatch alarms for:

- High error rates
- High latency (p99 > 3s)
- Throttling events
- Failed executions

---

## 💰 Cost Optimization

### Per Card Analysis

| Service          | Cost         |
| ---------------- | ------------ |
| Rekognition      | $0.001       |
| Bedrock (Claude) | $0.003       |
| Lambda           | $0.0000014   |
| Step Functions   | $0.000025    |
| API Gateway      | $0.0000035   |
| DynamoDB         | $0.0000001   |
| S3               | $0.00001     |
| **Total**        | **~$0.0041** |

### Monthly Estimates

- 1,000 cards: $4.10
- 10,000 cards: $41.00
- 100,000 cards: $410.00

### Optimization Tips

1. Cache pricing data (14-day TTL)
2. Use DynamoDB on-demand pricing
3. Right-size Lambda memory
4. Use VPC endpoints (avoid NAT Gateway)
5. Enable CloudFront CDN for static assets

---

## 🔒 Security

### Authentication & Authorization

- JWT authentication via Cognito
- User-scoped data isolation
- Card ownership verification
- Presigned URLs (60s expiration)

### Data Protection

- S3 encryption at rest (SSE-S3)
- DynamoDB encryption at rest
- TLS 1.2+ for all API calls
- Secrets in AWS Secrets Manager

### Best Practices

- Follow least privilege IAM policies
- Enable CloudWatch logging
- Set log retention to 30 days
- Regular security audits
- Dependency vulnerability scanning

---

## 🚢 Deployment

### Frontend (Amplify)

```bash
# Automatic on git push
git push origin main

# Manual
cd apps/web
pnpm build
# Upload to Amplify console
```

### Backend (Lambda)

```bash
# Build
cd services/backend
pnpm build

# Deploy via Terraform
cd infra/terraform/envs/hackathon
terraform apply
```

### Infrastructure (Terraform)

```bash
cd infra/terraform/envs/hackathon
terraform init
terraform plan
terraform apply
```

---

## 🐛 Troubleshooting

### Common Issues

**Card stuck in processing:**

- Check Step Functions execution status
- Review Lambda CloudWatch logs
- Verify DynamoDB has partial results

**Upload fails:**

- File too large (> 12MB)
- Invalid format (not JPG/PNG/HEIC)
- Presigned URL expired (> 60s)

**Authentication errors:**

- JWT token expired
- User doesn't own resource
- Cognito misconfiguration

See [Quick Reference](./QUICK_REFERENCE.md) for detailed troubleshooting steps.

---

## 📝 Contributing

### Code Style

- TypeScript strict mode disabled (non-strict)
- ESLint v9 flat config
- Prettier for formatting
- Conventional commits

### Pull Request Process

1. Create feature branch
2. Write tests
3. Update documentation
4. Submit PR with description
5. Pass CI/CD checks
6. Get approval from 2 reviewers

### Documentation Updates

When making changes:

1. Update relevant documentation
2. Add examples if needed
3. Update version numbers
4. Update "Last Updated" date

---

## 🆘 Support

### Getting Help

1. Check documentation in this directory
2. Review CloudWatch logs
3. Check AWS Console for service status
4. Contact DevOps team

### Useful Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Step Functions Documentation](https://docs.aws.amazon.com/step-functions/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

---

## 📅 Roadmap

### Phase 1: MVP (Current)

- [x] Basic upload and analysis
- [x] Manual trigger workflow
- [ ] Auto-trigger implementation
- [ ] Production deployment

### Phase 2: Enhancement

- [ ] Batch upload
- [ ] Real-time notifications
- [ ] Price alerts
- [ ] Export functionality

### Phase 3: Scale

- [ ] Multi-region deployment
- [ ] GraphQL API
- [ ] WebSocket for live updates
- [ ] Mobile app

---

## 📄 License

Copyright © 2024 CollectIQ. All rights reserved.

---

## 👥 Team

- **Engineering:** CollectIQ Engineering Team
- **DevOps:** CollectIQ DevOps Team
- **Product:** CollectIQ Product Team

---

**Last Updated:** 2024-01-15  
**Version:** 1.0.0  
**Documentation Maintained By:** CollectIQ Engineering Team

For questions or suggestions, please contact the engineering team.
