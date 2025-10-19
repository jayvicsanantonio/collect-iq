# Debugging Upload 500 Error

The Lambda code has been fixed and deployed, but you're still getting a 500 error. Here's how to debug it:

## Step 1: Check CloudWatch Logs

The most important thing is to see the actual error from the Lambda. You need to check CloudWatch Logs.

### Option A: AWS Console

1. Go to: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups
2. Find log group: `/aws/lambda/collectiq-hackathon-upload-presign`
3. Click on the most recent log stream
4. Look for ERROR messages

### Option B: Install AWS CLI

```bash
brew install awscli
aws configure  # Enter your credentials
aws logs tail /aws/lambda/collectiq-hackathon-upload-presign --follow --region us-east-1
```

Then try uploading again and watch the logs in real-time.

## Step 2: Check Lambda Configuration

Verify the environment variables are set correctly:

```bash
aws lambda get-function-configuration \
  --function-name collectiq-hackathon-upload-presign \
  --region us-east-1 \
  --query 'Environment.Variables'
```

Expected output:

```json
{
  "REGION": "us-east-1",
  "BUCKET_UPLOADS": "collectiq-hackathon-uploads",
  "MAX_UPLOAD_MB": "12",
  "ALLOWED_UPLOAD_MIME": "image/jpeg,image/png,image/heic",
  "KMS_KEY_ID": ""
}
```

## Step 3: Test Lambda Directly

Create a test event to invoke the Lambda directly:

```bash
# Create test event file
cat > test-presign-event.json << 'EOF'
{
  "version": "2.0",
  "routeKey": "POST /upload/presign",
  "rawPath": "/upload/presign",
  "rawQueryString": "",
  "headers": {
    "content-type": "application/json"
  },
  "requestContext": {
    "accountId": "123456789012",
    "apiId": "test",
    "domainName": "test.execute-api.us-east-1.amazonaws.com",
    "domainPrefix": "test",
    "http": {
      "method": "POST",
      "path": "/upload/presign",
      "protocol": "HTTP/1.1",
      "sourceIp": "127.0.0.1",
      "userAgent": "test"
    },
    "requestId": "test-request-id",
    "routeKey": "POST /upload/presign",
    "stage": "$default",
    "time": "01/Jan/2024:00:00:00 +0000",
    "timeEpoch": 1704067200000,
    "authorizer": {
      "jwt": {
        "claims": {
          "sub": "test-user-123",
          "email": "test@example.com",
          "cognito:username": "testuser",
          "iat": 1704067200,
          "exp": 1704070800
        }
      }
    }
  },
  "body": "{\"filename\":\"test.jpg\",\"contentType\":\"image/jpeg\",\"sizeBytes\":1024000}",
  "isBase64Encoded": false
}
EOF

# Invoke Lambda
aws lambda invoke \
  --function-name collectiq-hackathon-upload-presign \
  --region us-east-1 \
  --payload file://test-presign-event.json \
  --cli-binary-format raw-in-base64-out \
  response.json

# Check response
cat response.json | jq .
```

## Step 4: Common Issues

### Issue 1: Missing JWT Claims

If the error is "Missing JWT claims", the API Gateway JWT authorizer might not be configured correctly.

**Fix**: Check API Gateway authorizer configuration:

```bash
aws apigatewayv2 get-authorizers \
  --api-id 22e7eyyxqe \
  --region us-east-1
```

### Issue 2: S3 Bucket Permissions

If the error is about S3 permissions, the Lambda role might not have access to the bucket.

**Fix**: Check Lambda role has S3 PutObject permission for the uploads bucket.

### Issue 3: VPC Configuration

If the Lambda is in a VPC without NAT Gateway, it can't reach S3.

**Fix**: Either add NAT Gateway or use VPC endpoints for S3.

### Issue 4: Empty Request Body

If the error is "Request body is required", the API Gateway might not be passing the body correctly.

**Fix**: Check that the request is sending JSON body with filename, contentType, and sizeBytes.

## Step 5: Temporary Workaround

If you need to bypass the issue temporarily, you can:

1. Remove JWT auth requirement from the presign endpoint (NOT RECOMMENDED for production)
2. Add more detailed error logging to the Lambda
3. Return the actual error message in the response (for debugging only)

## What We've Fixed So Far

1. ✅ Changed `AWS_REGION` to `REGION` in Terraform (AWS_REGION is reserved)
2. ✅ Made `KMS_KEY_ID` optional with empty string default
3. ✅ Made KMS encryption conditional (only when KMS_KEY_ID is provided)
4. ✅ Fixed TypeScript types
5. ✅ Built and deployed the Lambda

## Next Steps

**You MUST check CloudWatch Logs** to see the actual error. Without the logs, we're guessing. Install AWS CLI and run:

```bash
aws logs tail /aws/lambda/collectiq-hackathon-upload-presign --follow --region us-east-1
```

Then try uploading and share the error message you see.
