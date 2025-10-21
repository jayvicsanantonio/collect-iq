# Requirements Document

## Introduction

CollectIQ DevOps is responsible for provisioning, managing, and maintaining the complete AWS infrastructure for an AI-powered Pokémon TCG card identification, authentication, and valuation platform. The infrastructure supports a serverless, multi-agent architecture with Next.js frontend on AWS Amplify, Lambda-based backend APIs, and Step Functions orchestrating AI workflows using Amazon Rekognition (for visual feature extraction) and Amazon Bedrock (for reasoning and valuation).

The DevOps specification ensures infrastructure-as-code (Terraform), automated CI/CD pipelines, comprehensive observability, security best practices, and cost optimization strategies. As a hackathon project, the system is designed for a single environment with a target budget of ~$50/month while maintaining security, reliability, and operational excellence.

This document defines the functional and non-functional requirements for infrastructure provisioning, deployment automation, monitoring, security, and cost management for the hackathon environment.

## Requirements

### Requirement 1: Infrastructure as Code with Terraform

**User Story:** As a DevOps engineer, I want all AWS infrastructure defined in Terraform modules so that I can version control, review, and reproducibly deploy resources across environments.

#### Acceptance Criteria

1. WHEN infrastructure is provisioned THEN the system SHALL use Terraform modules organized by service (amplify_hosting, api_gateway_http, cognito_user_pool, etc.)
2. WHEN Terraform state is managed THEN the system SHALL use S3 backend with versioning enabled and DynamoDB state locking
3. WHEN resources are created THEN the system SHALL apply consistent tags: {Project=CollectIQ, Environment=hackathon, Owner}
4. WHEN Terraform code is committed THEN the system SHALL enforce terraform fmt, validate, and plan checks in CI
5. WHEN infrastructure changes are applied THEN the system SHALL support manual approval for terraform apply
6. WHEN Terraform modules are developed THEN the system SHALL pass tflint and checkov security scans before merge

### Requirement 2: AWS Amplify Hosting for Next.js Frontend

**User Story:** As a frontend developer, I want the Next.js application automatically deployed to AWS Amplify so that users can access the web interface with SSR/ISR support and custom domain.

#### Acceptance Criteria

1. WHEN the Next.js app is deployed THEN the system SHALL use AWS Amplify Hosting with SSR/ISR enabled
2. WHEN code is pushed to the repository THEN the system SHALL trigger automatic builds and deployments
3. WHEN pull requests are created THEN the system SHALL generate preview environments for testing
4. WHEN the app is accessed THEN the system SHALL serve it via Amplify default domain with SSL
5. WHEN environment variables are needed THEN the system SHALL inject them from Terraform outputs (API base URL, Cognito IDs, region)
6. WHEN builds fail THEN the system SHALL trigger CloudWatch alarms for notification
7. WHEN the app is deployed THEN the system SHALL configure CORS to allow API Gateway origins

### Requirement 3: Amazon Cognito User Pool and Hosted UI

**User Story:** As a user, I want to authenticate securely via Cognito Hosted UI so that I can access my personal card vault with email verification and optional MFA.

#### Acceptance Criteria

1. WHEN Cognito is provisioned THEN the system SHALL create a user pool with email-based sign-up
2. WHEN Hosted UI is configured THEN the system SHALL set up OAuth 2.0 with authorization code flow and PKCE
3. WHEN callback URLs are configured THEN the system SHALL restrict them to Amplify domain and custom domain only
4. WHEN users sign up THEN the system SHALL enforce email verification before granting access
5. WHEN MFA is enabled THEN the system SHALL support optional TOTP-based multi-factor authentication
6. WHEN the user pool is created THEN the system SHALL configure password policies (min 8 chars, uppercase, lowercase, number, special char)
7. WHEN app clients are created THEN the system SHALL generate client IDs for frontend OAuth integration
8. WHEN the Hosted UI domain is provisioned THEN the system SHALL use a Cognito-managed domain or custom domain

### Requirement 4: API Gateway with JWT Authorizer

**User Story:** As a backend developer, I want API Gateway to validate Cognito JWTs automatically so that only authenticated users can access protected endpoints.

#### Acceptance Criteria

1. WHEN API Gateway is provisioned THEN the system SHALL use HTTP API (not REST API) for cost efficiency
2. WHEN routes are configured THEN the system SHALL map endpoints to Lambda functions (presign, cards CRUD, revalue)
3. WHEN JWT authorizer is configured THEN the system SHALL validate tokens using Cognito JWKS URL
4. WHEN the /healthz endpoint is accessed THEN the system SHALL allow unauthenticated access
5. WHEN all other endpoints are accessed THEN the system SHALL require valid JWT in Authorization header
6. WHEN API Gateway logs are enabled THEN the system SHALL send access logs to CloudWatch with request/response details
7. WHEN throttling is configured THEN the system SHALL set rate limits to 100 req/s for cost control
8. WHEN CORS is configured THEN the system SHALL allow requests from Amplify origin with credentials

### Requirement 5: Lambda Functions for Backend APIs

**User Story:** As a backend developer, I want Lambda functions deployed with proper IAM roles and environment variables so that they can process API requests securely and efficiently.

#### Acceptance Criteria

1. WHEN Lambda functions are deployed THEN the system SHALL package them with esbuild for optimal bundle size
2. WHEN Lambda functions are created THEN the system SHALL assign least-privilege IAM roles per function
3. WHEN environment variables are set THEN the system SHALL inject DynamoDB table name, S3 bucket, Cognito IDs, API keys from Secrets Manager
4. WHEN Lambda memory is allocated THEN the system SHALL use 512MB-1024MB based on function requirements
5. WHEN Lambda timeout is set THEN the system SHALL configure 30 seconds for API handlers, 5 minutes for orchestration tasks
6. WHEN Lambda functions are invoked THEN the system SHALL enable X-Ray tracing for distributed tracing
7. WHEN Lambda aliases are used THEN the system SHALL support canary/linear deployments with CloudWatch alarm-based rollback
8. WHEN Lambda functions are deployed THEN the system SHALL include: upload_presign, cards_create, cards_list, cards_get, cards_delete, cards_revalue, rekognition_extract, pricing_agent, authenticity_agent, aggregator

### Requirement 6: DynamoDB Single-Table Design

**User Story:** As a backend developer, I want a DynamoDB table with GSIs provisioned so that I can store user-scoped card data with efficient query patterns.

#### Acceptance Criteria

1. WHEN DynamoDB table is created THEN the system SHALL use single-table design with name hackathon-CollectIQ
2. WHEN primary key is defined THEN the system SHALL use PK=USER#{sub} and SK=CARD#{cardId} | PRICE#{iso8601}
3. WHEN GSI1 is created THEN the system SHALL index on userId with sort key createdAt for vault listings
4. WHEN GSI2 is created THEN the system SHALL index on set#rarity with sort key valueMedian for analytics
5. WHEN billing mode is set THEN the system SHALL use on-demand capacity for variable workloads
6. WHEN point-in-time recovery is enabled THEN the system SHALL configure PITR for disaster recovery
7. WHEN encryption is configured THEN the system SHALL enable encryption at rest with AWS managed keys
8. WHEN TTL is configured THEN the system SHALL enable TTL attribute for automatic expiration of cached pricing data

### Requirement 7: S3 Bucket for Secure Uploads

**User Story:** As a user, I want to upload card images securely to S3 so that the system can process them without exposing my credentials.

#### Acceptance Criteria

1. WHEN S3 bucket is created THEN the system SHALL name it hackathon-collectiq-uploads-{accountId}
2. WHEN bucket security is configured THEN the system SHALL enable Block Public Access for all settings
3. WHEN encryption is configured THEN the system SHALL use SSE-S3 for server-side encryption
4. WHEN bucket policy is set THEN the system SHALL enforce aws:SecureTransport (HTTPS only)
5. WHEN CORS is configured THEN the system SHALL allow PUT requests from presigned URLs
6. WHEN lifecycle policies are set THEN the system SHALL transition uploads/ to Glacier after 90 days and delete after 365 days
7. WHEN authentic samples are stored THEN the system SHALL keep authentic-samples/ prefix without expiration
8. WHEN IAM policies are configured THEN the system SHALL grant Lambda read access and presigned URL generation capability

### Requirement 8: Step Functions Multi-Agent Orchestration

**User Story:** As a system architect, I want Step Functions to orchestrate AI workflows so that Rekognition extracts features before Bedrock performs reasoning.

#### Acceptance Criteria

1. WHEN Step Functions state machine is created THEN the system SHALL define workflow: RekognitionExtract → ParallelAgents (Pricing + Authenticity) → Aggregator
2. WHEN RekognitionExtract task runs THEN the system SHALL invoke Lambda that calls Rekognition DetectText and DetectLabels
3. WHEN FeatureEnvelope is produced THEN the system SHALL pass it to parallel branches for pricing and authenticity agents
4. WHEN PricingAgent runs THEN the system SHALL fetch live comps from eBay, TCGPlayer, PriceCharting and compute valuation
5. WHEN AuthenticityAgent runs THEN the system SHALL invoke Bedrock with FeatureEnvelope to produce authenticityScore and rationale
6. WHEN Aggregator runs THEN the system SHALL merge results, persist to DynamoDB, and emit EventBridge events
7. WHEN tasks fail THEN the system SHALL retry with exponential backoff (3 attempts, backoff rate 2.0)
8. WHEN persistent failures occur THEN the system SHALL route to error handler Lambda and send to DLQ
9. WHEN state machine is configured THEN the system SHALL enable CloudWatch Logs for execution history

### Requirement 9: Amazon Rekognition Integration

**User Story:** As an AI engineer, I want Lambda functions to invoke Rekognition for visual feature extraction so that card images can be analyzed before AI reasoning.

#### Acceptance Criteria

1. WHEN Lambda IAM role is configured THEN the system SHALL grant rekognition:DetectText and rekognition:DetectLabels permissions
2. WHEN S3 bucket policy is set THEN the system SHALL allow Rekognition read access via Lambda execution role
3. WHEN Rekognition is invoked THEN the system SHALL process images from S3 keys provided in Step Functions input
4. WHEN FeatureEnvelope is generated THEN the system SHALL include OCR blocks, border metrics, holographic variance, font metrics, and quality signals
5. WHEN Rekognition quotas are monitored THEN the system SHALL track API usage and set CloudWatch alarms for approaching limits
6. WHEN region alignment is required THEN the system SHALL ensure Rekognition is available in the same region as other services

### Requirement 10: Amazon Bedrock Integration

**User Story:** As an AI engineer, I want Lambda functions to invoke Bedrock for valuation and authenticity reasoning so that AI-generated insights can be provided to users.

#### Acceptance Criteria

1. WHEN Bedrock is enabled THEN the system SHALL enable foundation models in the AWS region (e.g., Claude 3 Sonnet)
2. WHEN Lambda IAM role is configured THEN the system SHALL grant bedrock:InvokeModel permissions
3. WHEN Bedrock is invoked THEN the system SHALL pass FeatureEnvelope and card metadata to supervisor/sub-agents
4. WHEN valuation agent runs THEN the system SHALL consume pricing fusion outputs and generate 2-3 sentence summary
5. WHEN authenticity agent runs THEN the system SHALL produce authenticityScore (0-1) and human-readable rationale
6. WHEN Bedrock quotas are monitored THEN the system SHALL track token consumption and set CloudWatch alarms
7. WHEN Lambda timeout is configured THEN the system SHALL allow sufficient time for Bedrock inference (up to 5 minutes)

### Requirement 11: EventBridge Domain Event Bus

**User Story:** As a system architect, I want EventBridge to emit domain events so that downstream systems can react to card updates asynchronously.

#### Acceptance Criteria

1. WHEN EventBridge bus is created THEN the system SHALL name it hackathon-collectiq-events
2. WHEN events are emitted THEN the system SHALL publish CardValuationUpdated and AuthenticityFlagged events
3. WHEN event rules are configured THEN the system SHALL route events to target Lambda functions or SQS queues
4. WHEN DLQ is configured THEN the system SHALL create SQS dead-letter queue for failed event deliveries
5. WHEN event schema is defined THEN the system SHALL include userId, cardId, timestamp, and event-specific payload
6. WHEN EventBridge is monitored THEN the system SHALL track event delivery success/failure rates in CloudWatch

### Requirement 12: Secrets Management with AWS Secrets Manager

**User Story:** As a security engineer, I want external API keys stored in Secrets Manager so that they are encrypted, rotated, and never hardcoded.

#### Acceptance Criteria

1. WHEN secrets are created THEN the system SHALL store eBay, TCGPlayer, and PriceCharting API keys in Secrets Manager
2. WHEN Lambda functions access secrets THEN the system SHALL retrieve them at runtime using IAM permissions
3. WHEN secrets are rotated THEN the system SHALL enable automatic rotation schedules where supported
4. WHEN secrets are accessed THEN the system SHALL cache them in Lambda memory for execution lifetime
5. WHEN IAM policies are configured THEN the system SHALL grant secretsmanager:GetSecretValue only to specific Lambda roles
6. WHEN secrets are encrypted THEN the system SHALL use AWS managed KMS keys

### Requirement 13: Observability with CloudWatch and X-Ray

**User Story:** As a DevOps engineer, I want comprehensive monitoring and tracing so that I can diagnose issues and optimize performance.

#### Acceptance Criteria

1. WHEN CloudWatch dashboards are created THEN the system SHALL display API 4xx/5xx rates, latency, Lambda errors, Step Functions executions, DynamoDB throttles
2. WHEN CloudWatch alarms are configured THEN the system SHALL alert on: API 5xx > 5% for 5 minutes, Lambda error rate > 10%, Step Functions failed executions, DLQ depth > 10
3. WHEN X-Ray tracing is enabled THEN the system SHALL instrument all Lambda functions and Step Functions
4. WHEN logs are written THEN the system SHALL use structured JSON format with requestId, userId, operation fields
5. WHEN log retention is set THEN the system SHALL retain logs for 30 days
6. WHEN metrics are emitted THEN the system SHALL publish custom metrics for Bedrock invocations, Rekognition calls, authenticity score distribution
7. WHEN cost monitoring is enabled THEN the system SHALL set AWS Budget alerts at $50 threshold

### Requirement 14: CI/CD Pipelines

**User Story:** As a developer, I want automated CI/CD pipelines so that code changes are tested, validated, and deployed safely.

#### Acceptance Criteria

1. WHEN backend code is pushed THEN the system SHALL run: lint → typecheck → unit tests → integration tests → package Lambdas → upload artifacts
2. WHEN infrastructure code is pushed THEN the system SHALL run: terraform fmt → validate → plan → optional approval gate → apply
3. WHEN frontend code is pushed THEN the system SHALL trigger Amplify auto-build and deployment
4. WHEN PR previews are created THEN the system SHALL deploy ephemeral Amplify environments
5. WHEN Lambda deployments use aliases THEN the system SHALL support canary (10% traffic) or linear (10% every 10 minutes) rollouts
6. WHEN CloudWatch alarms breach THEN the system SHALL automatically rollback Lambda deployments
7. WHEN smoke tests are run THEN the system SHALL verify /healthz endpoint and basic API functionality post-deployment

### Requirement 15: Security and IAM Best Practices

**User Story:** As a security engineer, I want least-privilege IAM policies and encryption so that the system is secure by default.

#### Acceptance Criteria

1. WHEN IAM roles are created THEN the system SHALL assign separate roles per Lambda function with minimum required permissions
2. WHEN S3 access is granted THEN the system SHALL scope policies to specific bucket ARNs and prefixes
3. WHEN DynamoDB access is granted THEN the system SHALL scope policies to table and index ARNs
4. WHEN encryption is configured THEN the system SHALL enable KMS encryption for S3, DynamoDB, Secrets Manager, and CloudWatch Logs
5. WHEN bucket policies are set THEN the system SHALL enforce TLS (aws:SecureTransport) and deny public access
6. WHEN API Gateway is configured THEN the system SHALL enforce HTTPS only
7. WHEN audit logging is enabled THEN the system SHALL enable CloudTrail for all API calls

### Requirement 16: Cost Optimization and Budget Management

**User Story:** As a product owner, I want cost optimization strategies implemented so that AWS spend remains within budget as the system scales.

#### Acceptance Criteria

1. WHEN Lambda memory is allocated THEN the system SHALL use 256-512MB for lightweight functions to minimize cost
2. WHEN DynamoDB is configured THEN the system SHALL use on-demand billing for variable workloads
3. WHEN Step Functions are used THEN the system SHALL prefer Express workflows for high-volume, short-duration tasks
4. WHEN logs are written THEN the system SHALL control verbosity and use info-level logging
5. WHEN pricing data is cached THEN the system SHALL use DynamoDB TTL to minimize external API calls
6. WHEN AWS Budgets are set THEN the system SHALL configure alerts at 80% and 100% of $50 monthly budget
7. WHEN cost tagging is enabled THEN the system SHALL tag all resources for cost allocation reporting
8. WHEN free tier is available THEN the system SHALL maximize usage of Lambda, DynamoDB, and S3 free tier limits

### Requirement 17: Environment Configuration

**User Story:** As a DevOps engineer, I want a single hackathon environment configuration so that infrastructure is simple and cost-effective.

#### Acceptance Criteria

1. WHEN the environment is created THEN the system SHALL maintain a single Terraform state file for the hackathon environment
2. WHEN resources are named THEN the system SHALL prefix with hackathon (hackathon-CollectIQ)
3. WHEN environment variables are set THEN the system SHALL use hackathon-specific values for API keys, domains, and quotas
4. WHEN Terraform outputs are generated THEN the system SHALL provide values to frontend and backend
5. WHEN testing is performed THEN the system SHALL use the hackathon environment for all workloads

### Requirement 18: Disaster Recovery and Backup

**User Story:** As a system administrator, I want backup and recovery mechanisms so that data can be restored in case of failure.

#### Acceptance Criteria

1. WHEN DynamoDB PITR is enabled THEN the system SHALL support point-in-time recovery for up to 35 days
2. WHEN S3 versioning is enabled THEN the system SHALL retain previous versions of uploaded images
3. WHEN Terraform state is stored THEN the system SHALL enable S3 versioning for state file recovery
4. WHEN RTO/RPO are defined THEN the system SHALL target RTO < 4 hours and RPO < 1 hour

### Requirement 19: Runbooks and Operational Procedures

**User Story:** As an on-call engineer, I want runbooks for common incidents so that I can quickly resolve issues.

#### Acceptance Criteria

1. WHEN alarms trigger THEN the system SHALL provide runbooks mapping alarms to services and remediation steps
2. WHEN Rekognition/Bedrock quotas are exceeded THEN the system SHALL document quota increase request procedures
3. WHEN Lambda functions fail THEN the system SHALL provide debugging steps using CloudWatch Logs and X-Ray traces
4. WHEN Step Functions executions are stuck THEN the system SHALL document manual intervention procedures
5. WHEN secrets need rotation THEN the system SHALL provide step-by-step rotation procedures
6. WHEN rollback is needed THEN the system SHALL document Lambda alias rollback and Terraform state revert procedures

### Requirement 20: Performance and Scalability Targets

**User Story:** As a product owner, I want the system to scale automatically so that it can handle growth from hackathon to production.

#### Acceptance Criteria

1. WHEN API latency is measured THEN the system SHALL achieve P95 < 400ms for hot path APIs (presign, list, get)
2. WHEN Lambda concurrency is configured THEN the system SHALL set reserved concurrency to prevent account-level throttling
3. WHEN DynamoDB is queried THEN the system SHALL use GSIs for efficient access patterns
4. WHEN Step Functions execute THEN the system SHALL complete workflows in < 30 seconds for typical card analysis
5. WHEN the system scales THEN the system SHALL support 100k API calls/month for the hackathon
6. WHEN Amplify serves traffic THEN the system SHALL handle concurrent users with CDN caching
