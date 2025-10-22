# Backend Operations Documentation

Complete operations documentation for CollectIQ backend infrastructure, deployment, monitoring, and cost management.

## Overview

This section covers operational aspects of the CollectIQ backend, including infrastructure management, deployment procedures, cost optimization, monitoring, and troubleshooting. The backend uses a fully serverless AWS architecture deployed via Terraform.

## Documentation

### Operations Specification

- [Operations Specification](./Operations-Specification.md) - Complete operations architecture and procedures

### Cost Management

- [AWS Cost Model & Optimization](./AWS-Cost-Model-Optimization.md) - Cost analysis and optimization strategies

## Infrastructure Overview

### AWS Services Used

**Compute & Orchestration**:

- AWS Lambda (Node.js 20) - Serverless backend functions
- AWS Step Functions - Multi-agent workflow orchestration
- Amazon Bedrock (Claude 3.5 Sonnet) - AI/ML inference
- Amazon Rekognition - Image analysis and OCR

**Storage & Database**:

- Amazon S3 - Card image storage with presigned URLs
- Amazon DynamoDB - Single-table design for cards and user data

**API & Networking**:

- Amazon API Gateway (HTTP API) - REST API with JWT authorization
- AWS Amplify - Frontend hosting with CloudFront CDN

**Security & Identity**:

- Amazon Cognito - User authentication with Hosted UI
- AWS IAM - Fine-grained access control
- AWS Secrets Manager - API key management
- AWS KMS - Encryption key management

**Monitoring & Observability**:

- Amazon CloudWatch - Logs, metrics, and dashboards
- AWS X-Ray - Distributed tracing
- CloudWatch Alarms - Automated alerting

**Event Processing**:

- Amazon EventBridge - Event-driven architecture for auto-trigger

## Cost Management

### Monthly Cost Breakdown

Based on 50,000 card valuations per month:

| Service                  | Usage                          | Monthly Cost   |
| ------------------------ | ------------------------------ | -------------- |
| **Lambda**               | 50k invocations × 4 functions  | $11            |
| **Bedrock (Claude 3.5)** | 50k invocations × 1200 tokens  | $75            |
| **Rekognition**          | 50k images (OCR + labels)      | $50            |
| **DynamoDB**             | 200k reads, 100k writes        | $15            |
| **S3**                   | Storage + requests             | $5             |
| **API Gateway**          | 50k requests                   | $5             |
| **Step Functions**       | 50k executions × 4 transitions | $5             |
| **CloudWatch**           | Logs + metrics                 | $10            |
| **Total**                |                                | **$176/month** |

### Cost Optimization Strategies

1. **Lambda Optimization**
   - Right-size memory allocation (256MB-512MB)
   - Use ARM64 architecture (20% cost savings)
   - Minimize cold starts with provisioned concurrency (critical paths only)
   - Optimize bundle sizes with esbuild

2. **Bedrock Optimization**
   - Optimize prompt length (reduce input tokens)
   - Use appropriate model (Claude 3.5 Sonnet for balance)
   - Cache common responses in DynamoDB
   - Batch requests when possible

3. **DynamoDB Optimization**
   - Use on-demand billing for variable workloads
   - Single-table design reduces costs
   - Optimize query patterns to minimize RCUs
   - Enable point-in-time recovery selectively

4. **S3 Optimization**
   - Lifecycle policies to archive old images
   - Intelligent tiering for variable access
   - Delete failed uploads automatically
   - Use presigned URLs to avoid Lambda proxy

5. **Monitoring Optimization**
   - Set appropriate log retention (7-30 days)
   - Use log sampling for high-volume logs
   - Archive old logs to S3 Glacier
   - Use CloudWatch Insights efficiently

## Deployment

### Infrastructure Deployment

See [Infrastructure Documentation](../../infrastructure/README.md) for complete Terraform deployment procedures.

Quick deployment:

```bash
cd infra/terraform/envs/hackathon
terraform init
terraform plan
terraform apply
```

### Backend Deployment

```bash
cd services/backend

# Build all Lambda functions
pnpm build

# Deploy all functions
pnpm deploy

# Deploy specific function
pnpm deploy:pricing-agent
```

### Deployment Verification

```bash
# Test API health
curl https://your-api-gateway-url/healthz

# Test authentication
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://your-api-gateway-url/cards

# Monitor deployment
aws logs tail /aws/lambda/collectiq-hackathon-healthz --follow
```

## Monitoring & Observability

### CloudWatch Dashboards

**Overview Dashboard**:

- API request rate and latency
- Lambda invocations and errors
- Step Functions execution status
- DynamoDB read/write capacity
- Cost trends

**Agent Performance Dashboard**:

- Pricing Agent execution time
- Authenticity Agent accuracy
- OCR Reasoning Agent confidence
- Rekognition Extract latency

**Cost Dashboard**:

- Daily spending by service
- Budget vs actual
- Cost anomalies
- Optimization opportunities

### Key Metrics

**Performance Metrics**:

- API latency: P50, P90, P99
- Lambda duration by function
- Step Functions execution time
- DynamoDB query latency
- S3 upload/download time

**Reliability Metrics**:

- API error rate
- Lambda error count
- Step Functions failures
- DynamoDB throttling events
- Bedrock throttling

**Business Metrics**:

- Cards processed per day
- Average valuation time
- Authenticity detection rate
- User engagement
- API usage by endpoint

### CloudWatch Alarms

**Critical Alarms** (PagerDuty/SMS):

- API error rate > 5%
- Lambda errors > 10/minute
- Step Functions failure rate > 10%
- DynamoDB throttling detected
- Cost > 150% of budget

**Warning Alarms** (Email/Slack):

- API P99 latency > 5 seconds
- Lambda cold start rate > 20%
- Step Functions duration > 30 seconds
- Cost > 120% of budget

### X-Ray Tracing

Enable distributed tracing for debugging:

- End-to-end request tracing
- Service map visualization
- Performance bottleneck identification
- Error root cause analysis

See [X-Ray Tracing Guide](../../infrastructure/monitoring/XRAY_TRACING.md)

## Security Operations

### IAM Best Practices

- **Least Privilege**: Each Lambda has minimal required permissions
- **Service Roles**: Dedicated roles per function
- **No Hardcoded Credentials**: All secrets in Secrets Manager
- **Regular Audits**: Quarterly permission reviews

### Data Security

- **Encryption at Rest**: S3 (SSE-S3), DynamoDB (KMS)
- **Encryption in Transit**: TLS 1.2+ for all API calls
- **User Data Isolation**: Partition key isolation in DynamoDB
- **Secret Management**: API keys in Secrets Manager

### Security Monitoring

- **CloudTrail**: All API calls logged
- **GuardDuty**: Threat detection (production)
- **Security Hub**: Compliance monitoring (production)
- **Config**: Resource compliance tracking

## Disaster Recovery

### Backup Strategy

**DynamoDB**:

- Point-in-time recovery enabled (35-day retention)
- On-demand backups before major changes
- Cross-region replication (production only)

**S3**:

- Versioning enabled
- Cross-region replication (production only)
- Lifecycle policies for cost optimization

**Infrastructure**:

- Terraform state in S3 with versioning
- State locking with DynamoDB
- Git repository for all IaC

### Recovery Procedures

**Scenario 1: Lambda Function Failure**

```bash
# Rollback to previous version
aws lambda update-function-code \
  --function-name collectiq-hackathon-pricing-agent \
  --zip-file fileb://previous-version.zip
```

**Scenario 2: DynamoDB Data Loss**

```bash
# Restore from point-in-time
aws dynamodb restore-table-to-point-in-time \
  --source-table-name collectiq-hackathon \
  --target-table-name collectiq-hackathon-restored \
  --restore-date-time 2025-10-22T12:00:00Z
```

**Scenario 3: Complete Infrastructure Failure**

```bash
# Rebuild from Terraform
cd infra/terraform/envs/hackathon
terraform init
terraform apply
```

### RTO & RPO Targets

- **Recovery Time Objective (RTO)**: < 4 hours
- **Recovery Point Objective (RPO)**: < 1 hour
- **Data Loss Tolerance**: Minimal (point-in-time recovery)

## Troubleshooting

### Common Issues

**High Lambda Costs**:

1. Check CloudWatch metrics for invocation count
2. Review memory allocation (over-provisioned?)
3. Check for retry storms
4. Optimize cold starts

**DynamoDB Throttling**:

1. Check read/write capacity metrics
2. Review query patterns (hot partitions?)
3. Consider on-demand billing
4. Optimize GSI usage

**Step Functions Timeouts**:

1. Check individual Lambda durations
2. Review external API latency
3. Increase timeout settings
4. Add retry logic

**High Bedrock Costs**:

1. Review prompt lengths
2. Check for unnecessary invocations
3. Implement response caching
4. Optimize model selection

### Debug Commands

```bash
# View Lambda logs
aws logs tail /aws/lambda/collectiq-hackathon-pricing-agent --follow

# Check Step Functions execution
aws stepfunctions describe-execution \
  --execution-arn arn:aws:states:...

# Query DynamoDB
aws dynamodb query \
  --table-name collectiq-hackathon \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"USER#123"}}'

# Check API Gateway logs
aws logs tail /aws/apigateway/collectiq-hackathon --follow
```

## Performance Optimization

### Lambda Optimization

- **Memory Allocation**: Test different sizes (256MB, 512MB, 1024MB)
- **Bundle Size**: Use esbuild for minimal bundles
- **Cold Starts**: Provisioned concurrency for critical paths
- **Connection Pooling**: Reuse DynamoDB connections

### DynamoDB Optimization

- **Query Patterns**: Use partition key + sort key efficiently
- **GSI Design**: Minimize GSI count and size
- **Batch Operations**: Use BatchGetItem/BatchWriteItem
- **Caching**: Cache frequently accessed data

### API Gateway Optimization

- **Caching**: Enable response caching (production)
- **Compression**: Enable gzip compression
- **Throttling**: Set appropriate rate limits
- **Regional Endpoints**: Use for lower latency

## Related Documentation

- [Infrastructure Documentation](../../infrastructure/README.md) - Terraform modules and deployment
- [Backend Development](../development/DEPLOYMENT.md) - Development and deployment guides
- [Monitoring Guide](../../infrastructure/monitoring/) - Detailed monitoring setup
- [Configuration Reference](../../configuration/README.md) - Environment variables

## Navigation

- [← Back to Backend Documentation](../README.md)
- [← Back to Main Documentation](../../README.md)

---

**Last Updated**: October 22, 2025  
**Infrastructure**: AWS Serverless  
**IaC Tool**: Terraform  
**Monitoring**: CloudWatch + X-Ray
