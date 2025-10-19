# CORS Fix for API Gateway

## Problem

The frontend was experiencing CORS errors when calling the `/upload/presign` endpoint:

```
Access to fetch at 'https://22e7eyyxqe.execute-api.us-east-1.amazonaws.com/upload/presign'
from origin 'https://main.ddtufp5of4bf.amplifyapp.com' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause

While API Gateway had CORS configured at the infrastructure level, the Lambda functions were not returning the required CORS headers in their responses. Browsers require these headers to be present in the actual HTTP response from the Lambda function.

## Solution

Updated `services/backend/src/utils/response-headers.ts` to include CORS headers in all API responses:

```typescript
'Access-Control-Allow-Origin': '*',
'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
```

These headers are now automatically included in all responses via the `getSecurityHeaders()` function, which is used by all Lambda handlers.

## Deployment

### Option 1: Using Terraform (Recommended)

If you have Terraform installed:

```bash
./scripts/deploy-terraform.sh
```

Or manually:

```bash
# Build backend
cd services/backend
pnpm build:prod
cd ../..

# Deploy with Terraform
cd infra/terraform/envs/hackathon
terraform apply -auto-approve
```

### Option 2: Using AWS CLI

If you have AWS CLI installed:

```bash
./scripts/deploy-lambda-functions.sh
```

### Option 3: Via Git Push

If you have a CI/CD pipeline configured:

```bash
git add .
git commit -m "fix: Add CORS headers to Lambda responses"
git push origin main
```

## Files Changed

- `services/backend/src/utils/response-headers.ts` - Added CORS headers to all responses
- `services/backend/dist/handlers/*.mjs` - Rebuilt with updated headers (auto-generated)
- `scripts/deploy-lambda-functions.sh` - AWS CLI deployment script (new)
- `scripts/deploy-terraform.sh` - Terraform deployment script (new)

## Testing

After deployment, test the upload flow:

1. Navigate to https://main.ddtufp5of4bf.amplifyapp.com/upload
2. Sign in with Cognito
3. Upload a card image
4. Verify no CORS errors in browser console
5. Check that presigned URL is generated successfully

## Notes

- The `Access-Control-Allow-Origin: *` setting allows requests from any origin. For production, you should restrict this to your specific Amplify domain.
- All Lambda handlers automatically inherit these headers through the `getJsonHeaders()` utility function.
- The fix applies to all API endpoints, not just `/upload/presign`.

## Production Considerations

For production deployment, update the CORS origin to be more restrictive:

```typescript
'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://main.ddtufp5of4bf.amplifyapp.com',
```

And set the `ALLOWED_ORIGIN` environment variable in your Lambda function configuration.
