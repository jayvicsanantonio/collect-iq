# Lambda Function IAM Permissions

## Overview

This document describes the IAM permissions structure for Lambda functions deployed using the `lambda_fn` module. The module follows AWS best practices and the principle of least privilege.

## Automatic Policy Attachments

### 1. Basic Execution Role (Always Attached)

**Policy:** `arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`

**Permissions:**

- `logs:CreateLogGroup`
- `logs:CreateLogStream`
- `logs:PutLogEvents`

**Purpose:** Allows Lambda to write logs to CloudWatch Logs.

**Resource Scope:** Function's own log group (`/aws/lambda/${function_name}`)

### 2. X-Ray Tracing (Conditional)

**Policy:** `arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess`

**Permissions:**

- `xray:PutTraceSegments`
- `xray:PutTelemetryRecords`

**Purpose:** Allows Lambda to send trace data to AWS X-Ray for distributed tracing.

**Condition:** Attached when `enable_xray_tracing = true`

**Resource Scope:** All resources (required for X-Ray daemon)

### 3. VPC Execution (Conditional)

**Policy:** `arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole`

**Permissions:**

- `ec2:CreateNetworkInterface`
- `ec2:DescribeNetworkInterfaces`
- `ec2:DeleteNetworkInterface`
- `ec2:DescribeSecurityGroups`
- `ec2:DescribeSubnets`
- `ec2:DescribeVpcs`

**Purpose:** Allows Lambda to create and manage ENIs for VPC access.

**Condition:** Attached when `vpc_subnet_ids` is provided

**Resource Scope:** VPC resources in the specified subnets and security groups

## Custom Permissions

### Custom IAM Policy (Inline)

**Variable:** `custom_iam_policy_json`

**Purpose:** Allows attaching a custom inline IAM policy for function-specific permissions.

**Example Use Cases:**

- DynamoDB table access
- S3 bucket operations
- EventBridge PutEvents
- Step Functions execution

**Best Practice:** Use this for permissions that are unique to a specific Lambda function.

### Additional Policy ARNs

**Variable:** `additional_policy_arns`

**Purpose:** Allows attaching existing IAM policies by ARN.

**Example Use Cases:**

- Bedrock model invocation
- Rekognition operations
- Secrets Manager access
- Shared policies across multiple functions

**Best Practice:** Use this for reusable policies that are shared across multiple Lambda functions.

## Least-Privilege Guidelines

### ✅ DO

1. **Restrict to Specific Resources**

   ```hcl
   resources = [
     "arn:aws:dynamodb:${region}:${account}:table/${table_name}"
   ]
   ```

2. **Use Specific Actions**

   ```hcl
   actions = [
     "dynamodb:GetItem",
     "dynamodb:PutItem"
   ]
   ```

3. **Add Conditions When Possible**
   ```hcl
   condition {
     test     = "StringEquals"
     variable = "dynamodb:LeadingKeys"
     values   = ["USER#${cognito:sub}"]
   }
   ```

### ❌ DON'T

1. **Avoid Wildcard Resources**

   ```hcl
   # Bad
   resources = ["*"]

   # Good
   resources = ["arn:aws:s3:::my-bucket/*"]
   ```

2. **Avoid Wildcard Actions**

   ```hcl
   # Bad
   actions = ["s3:*"]

   # Good
   actions = ["s3:GetObject", "s3:PutObject"]
   ```

3. **Don't Grant Admin Access**
   ```hcl
   # Bad
   actions = ["*"]
   resources = ["*"]
   ```

## Example: OCR Reasoning Agent

```hcl
module "lambda_ocr_reasoning_agent" {
  source = "../../modules/lambda_fn"

  function_name = "ocr-reasoning-agent"

  # Automatic: AWSLambdaBasicExecutionRole (CloudWatch Logs)
  # Automatic: AWSXRayDaemonWriteAccess (X-Ray tracing)
  # Automatic: AWSLambdaVPCAccessExecutionRole (VPC access)

  enable_xray_tracing = true
  vpc_subnet_ids      = ["subnet-xxx"]

  # Custom: Bedrock model invocation (shared policy)
  additional_policy_arns = [
    module.bedrock_access.policy_arn  # bedrock:InvokeModel
  ]

  # No custom inline policy needed for this function
  custom_iam_policy_json = ""
}
```

## IAM Role Structure

```
Lambda Execution Role
├── Trust Policy (AssumeRole)
│   └── Service: lambda.amazonaws.com
│
├── Managed Policies (Attached)
│   ├── AWSLambdaBasicExecutionRole (always)
│   ├── AWSXRayDaemonWriteAccess (if X-Ray enabled)
│   └── AWSLambdaVPCAccessExecutionRole (if VPC configured)
│
├── Custom Inline Policy (Optional)
│   └── Function-specific permissions
│
└── Additional Managed Policies (Optional)
    └── Shared policies (e.g., Bedrock, Rekognition)
```

## Security Considerations

1. **Principle of Least Privilege:** Only grant permissions required for the function to operate.

2. **Resource Scoping:** Always scope permissions to specific resources when possible.

3. **Avoid Cross-Account Access:** Unless explicitly required, don't grant permissions to resources in other AWS accounts.

4. **Regular Audits:** Periodically review Lambda IAM roles to ensure permissions are still necessary.

5. **Use IAM Access Analyzer:** Enable IAM Access Analyzer to identify overly permissive policies.

6. **Separate Policies by Concern:** Use separate policies for different types of access (e.g., one for DynamoDB, one for S3).

## Troubleshooting

### Access Denied Errors

1. Check CloudWatch Logs for the specific permission denied
2. Verify the resource ARN matches the policy
3. Check for typos in action names
4. Ensure the policy is attached to the role
5. Verify the trust policy allows Lambda to assume the role

### Policy Size Limits

- Inline policies: 10,240 characters
- Managed policies: 6,144 characters
- Solution: Split large policies into multiple managed policies

### Policy Evaluation

AWS evaluates policies in this order:

1. Explicit Deny (always wins)
2. Explicit Allow
3. Implicit Deny (default)

## References

- [AWS Lambda Execution Role](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Least Privilege Principle](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege)
