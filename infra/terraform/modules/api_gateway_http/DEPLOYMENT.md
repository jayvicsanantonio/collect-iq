# API Gateway Deployment Guide

This guide provides step-by-step instructions for deploying the CollectIQ API Gateway configuration.

## Prerequisites

Before deploying the API Gateway, ensure you have:

1. **Lambda Functions Deployed**: All handler Lambda functions must exist
   - upload_presign
   - cards_create
   - cards_list
   - cards_get
   - cards_delete
   - cards_revalue
   - healthz

2. **Cognito User Pool**: User pool and client must be configured
   - User Pool ID
   - Client ID
   - JWKS URL will be auto-generated

3. **Terraform State**: Backend state storage configured
   - S3 bucket for state
   - DynamoDB table for locking

## Deployment Steps

### 1. Configure Variables

Create a `terraform.tfvars` file in your environment directory:

```hcl
# Environment
stage      = "dev"
aws_region = "us-east-1"

# Cognito
cognito_user_pool_id = "us-east-1_XXXXXXXXX"
cognito_client_id    = "xxxxxxxxxxxxxxxxxxxxxxxxxx"

# CORS
cors_allowed_origins = [
  "http://localhost:3000",
  "https://dev.collectiq.app"
]

# Lambda Functions (from Lambda module outputs)
lambda_upload_presign_invoke_arn    = "arn:aws:lambda:us-east-1:123456789012:function:dev-upload-presign"
lambda_upload_presign_function_name = "dev-upload-presign"

lambda_cards_create_invoke_arn      = "arn:aws:lambda:us-east-1:123456789012:function:dev-cards-create"
lambda_cards_create_function_name   = "dev-cards-create"

lambda_cards_list_invoke_arn        = "arn:aws:lambda:us-east-1:123456789012:function:dev-cards-list"
lambda_cards_list_function_name     = "dev-cards-list"

lambda_cards_get_invoke_arn         = "arn:aws:lambda:us-east-1:123456789012:function:dev-cards-get"
lambda_cards_get_function_name      = "dev-cards-get"

lambda_cards_delete_invoke_arn      = "arn:aws:lambda:us-east-1:123456789012:function:dev-cards-delete"
lambda_cards_delete_function_name   = "dev-cards-delete"

lambda_cards_revalue_invoke_arn     = "arn:aws:lambda:us-east-1:123456789012:function:dev-cards-revalue"
lambda_cards_revalue_function_name  = "dev-cards-revalue"

lambda_healthz_invoke_arn           = "arn:aws:lambda:us-east-1:123456789012:function:dev-healthz"
lambda_healthz_function_name        = "dev-healthz"

# Throttling (optional)
throttling_burst_limit = 5000
throttling_rate_limit  = 2000

# Logging (optional)
log_retention_days = 30

# Tags
tags = {
  Environment = "dev"
  Project     = "CollectIQ"
  ManagedBy   = "Terraform"
}
```

### 2. Initialize Terraform

```bash
cd infra/terraform/envs/dev  # or your environment directory
terraform init
```

### 3. Plan Deployment

Review the changes Terraform will make:

```bash
terraform plan
```

Expected resources to be created:

- 1 API Gateway HTTP API
- 1 JWT Authorizer
- 1 API Gateway Stage
- 7 API Gateway Integrations
- 7 API Gateway Routes
- 7 Lambda Permissions
- 1 CloudWatch Log Group
- (Optional) Custom domain and mapping

### 4. Apply Configuration

Deploy the API Gateway:

```bash
terraform apply
```

Review the plan and type `yes` to confirm.

### 5. Verify Deployment

After deployment, Terraform will output:

- `api_endpoint`: Base API URL
- `stage_invoke_url`: Full invoke URL
- `api_id`: API Gateway ID

Test the health check endpoint (no auth required):

```bash
curl https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/healthz
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "collectiq-backend",
  "version": "1.0.0"
}
```

### 6. Test Authenticated Endpoints

Get a JWT token from Cognito:

```bash
# Sign in to get tokens
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id YOUR_CLIENT_ID \
  --auth-parameters USERNAME=user@example.com,PASSWORD=YourPassword123!
```

Test an authenticated endpoint:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/cards
```

## Post-Deployment Configuration

### Update Frontend Environment Variables

Add the API endpoint to your frontend `.env.local`:

```bash
NEXT_PUBLIC_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com
```

### Configure Custom Domain (Optional)

If using a custom domain:

1. Create ACM certificate in `us-east-1`
2. Validate certificate via DNS
3. Add certificate ARN to `terraform.tfvars`:
   ```hcl
   custom_domain_name = "api.collectiq.app"
   certificate_arn    = "arn:aws:acm:us-east-1:123456789012:certificate/..."
   ```
4. Apply Terraform changes
5. Create Route 53 record pointing to API Gateway domain

### Set Up Monitoring

Create CloudWatch alarms for:

```bash
# High error rate
aws cloudwatch put-metric-alarm \
  --alarm-name "dev-api-high-error-rate" \
  --alarm-description "API error rate > 5%" \
  --metric-name 4XXError \
  --namespace AWS/ApiGateway \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold

# High latency
aws cloudwatch put-metric-alarm \
  --alarm-name "dev-api-high-latency" \
  --alarm-description "API P95 latency > 1000ms" \
  --metric-name Latency \
  --namespace AWS/ApiGateway \
  --statistic p95 \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 1000 \
  --comparison-operator GreaterThanThreshold
```

## Troubleshooting

### 401 Unauthorized Errors

**Symptom**: All authenticated requests return 401

**Possible Causes**:

1. JWT token expired
2. Wrong Cognito User Pool ID
3. Wrong Client ID in authorizer
4. Token not in Authorization header

**Solution**:

```bash
# Verify authorizer configuration
aws apigatewayv2 get-authorizer \
  --api-id YOUR_API_ID \
  --authorizer-id YOUR_AUTHORIZER_ID

# Check JWKS URL is correct
# Should be: https://cognito-idp.{region}.amazonaws.com/{poolId}/.well-known/jwks.json
```

### CORS Errors

**Symptom**: Browser shows CORS policy errors

**Possible Causes**:

1. Origin not in allowed list
2. Missing credentials flag
3. Preflight request failing

**Solution**:

```bash
# Test preflight request
curl -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization" \
  https://your-api-url.com/cards

# Should return CORS headers
```

### Lambda Not Invoked

**Symptom**: API returns 500 or integration timeout

**Possible Causes**:

1. Lambda permission missing
2. Lambda function doesn't exist
3. Lambda execution role issues

**Solution**:

```bash
# Check Lambda permissions
aws lambda get-policy \
  --function-name dev-cards-create

# Should show API Gateway as allowed principal

# Test Lambda directly
aws lambda invoke \
  --function-name dev-cards-create \
  --payload '{"requestContext":{"authorizer":{"jwt":{"claims":{"sub":"test"}}}}}' \
  response.json
```

### High Latency

**Symptom**: Requests taking > 1 second

**Possible Causes**:

1. Lambda cold starts
2. Lambda timeout too high
3. Downstream service slow

**Solution**:

```bash
# Check CloudWatch Insights
aws logs start-query \
  --log-group-name /aws/apigateway/dev-collectiq-api \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, @message, integrationLatency | sort @timestamp desc | limit 20'
```

## Rollback

If deployment fails or causes issues:

```bash
# Rollback to previous state
terraform apply -target=module.api_gateway -var-file=previous.tfvars

# Or destroy and redeploy
terraform destroy -target=module.api_gateway
terraform apply
```

## Security Checklist

Before going to production:

- [ ] CORS origins restricted to production domains
- [ ] Custom domain with valid SSL certificate
- [ ] CloudWatch alarms configured
- [ ] API Gateway logs enabled
- [ ] Throttling limits set appropriately
- [ ] Lambda functions have minimal IAM permissions
- [ ] JWT authorizer configured correctly
- [ ] Security headers present in all responses
- [ ] Rate limiting tested
- [ ] Load testing completed

## Next Steps

After successful deployment:

1. Update frontend to use new API endpoint
2. Test all endpoints with real data
3. Monitor CloudWatch metrics
4. Set up CI/CD pipeline for updates
5. Document API for frontend team
6. Configure WAF rules (optional)
7. Set up API usage plans (optional)

## Support

For issues or questions:

- Check CloudWatch logs: `/aws/apigateway/dev-collectiq-api`
- Review Lambda logs: `/aws/lambda/dev-{function-name}`
- Consult Terraform state: `terraform show`
- Review module README: `README.md`
