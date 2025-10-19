---
title: CollectIQ — Backend Project Specification
---

Purpose: Define the backend architecture and implementation using AWS Lambda behind Amazon API Gateway, provisioned via Terraform. This doc covers project setup, coding standards, auth, APIs, data model, real-time pricing ingestion, authenticity pipeline, multi-agent orchestration, testing, observability, and interfaces with DevOps.

# 1. Architecture Overview

• Entry: Amazon API Gateway (HTTP API) terminates requests and routes to Lambda functions. • Auth: API Gateway JWT Authorizer (Cognito User Pool) validates tokens before invoking Lambdas. • Compute: Node.js 20 Lambdas (TypeScript) for presign, cards CRUD, revalue (orchestration entry), pricing adapters, authenticity. • Orchestration: AWS Step Functions coordinates tasks; it invokes Amazon Rekognition first for CV/OCR feature extraction, then calls Amazon Bedrock (Supervisor/Sub‑agents) for reasoning. Events flow via EventBridge. • Storage: S3 (uploads, private), DynamoDB (single-table), Secrets in SSM/Secrets Manager. • AI: Rekognition runs BEFORE Bedrock to produce a FeatureEnvelope (OCR + visual signals). Bedrock consumes that envelope to generate authenticity scores and valuation reasoning.

# 2. Tech Stack & Principles

• Language/Runtime: TypeScript on Node.js 20 (ESM), not strict.

• Build: esbuild; one handler per Lambda; optional shared layer for utils.

• Validation: Zod at the edge with type inference inward.

• Error Model: RFC 7807 (problem+json).

• Security: Cognito JWT authorizer; least-privilege IAM; presigned S3; KMS at rest; HTTPS-only.

• Performance: P95 \< 400ms hot paths; long tasks via Step Functions.

• Reliability: idempotency keys on POST; retries/backoff; circuit breakers for sources.

# 3. Repository & Code Layout

services/backend/  
src/  
handlers/ (API Gateway handlers)  
upload_presign.ts  
cards_create.ts  
cards_list.ts  
cards_get.ts  
cards_delete.ts  
cards_revalue.ts  
agents/ (pricing_agent.ts, authenticity_agent.ts, aggregator.ts)  
orchestration/ (revalue.asl.json, orchestrator.ts)  
adapters/ (rekognition.ts, bedrock.ts, pricing/{ebay.ts, tcgplayer.ts, pricecharting.ts})  
store/ (ddb.ts, queries.ts, models.ts)  
auth/ (jwt.ts)  
utils/ (problem.ts, log.ts, tracing.ts, constants.ts)  
tests/ (unit/, integration/, e2e/)  
index.ts  
esbuild.mjs  
vitest.config.ts  
tsconfig.json
package.json  
infra/terraform/ owned by DevOps; Backend supplies IAM needs & env var contracts.

# 4. Environment & Configuration

# 5. Authentication & Authorization

• API Gateway JWT authorizer (Cognito) required for all routes except /healthz.

• Handlers re-parse claims to extract sub/email; enforce ownership on every read/write.

• 401/403 return RFC 7807 with remediation text.

# 6. Data Model (DynamoDB Single-Table)

Table: {stage}-CollectIQ  
PK = USER#{sub}  
SK = CARD#{cardId} (card) or PRICE#{iso8601} (snapshot)  
Attrs: userId(sub), cardId, name, set, number, rarity, conditionEstimate, frontS3Key, backS3Key, idConfidence, authenticityScore, authenticitySignals{}, valueLow, valueMedian, valueHigh, compsCount, windowDays, sources\[\], createdAt, updatedAt  
GSIs: GSI1(userId#createdAt), GSI2(set#rarity).

# 7. APIs (Lambda + API Gateway)

• POST /upload/presign → upload_presign.ts  
• POST /cards → cards_create.ts  
• GET /cards → cards_list.ts  
• GET /cards/{id} → cards_get.ts  
• DELETE /cards/{id} → cards_delete.ts  
• POST /cards/{id}/revalue → cards_revalue.ts (starts Step Functions; 202)  
• GET /healthz → public

# 8. Real-Time Pricing Ingestion & Fusion

interface PriceSource { fetchComps(q: PriceQuery): Promise\<RawComp\[\]\> }  
Normalize (conditions, currency, IQR), Fuse (low/median/high, compsCount, volatility, confidence), Cache (in-memory + DDB snapshot), rate-limit/backoff, circuit breaker.

# 9. Authenticity Pipeline

Rekognition is invoked first to extract visual/ocr features and produce a FeatureEnvelope used by Bedrock: FeatureEnvelope := { ocr: \[...\], borders: {ratios, symmetry}, holoVariance: number, fontMetrics: {kerning, alignment}, quality: {blur, glare}, imageMeta: {...} } Bedrock then combines these signals with card metadata to produce authenticityScore ∈ \[0,1\] with a short rationale. Scores \< 0.85 are flagged; component signals are persisted for transparency and future learning.

# 10. Orchestration (Multi-Agent)

cards_revalue starts a Step Functions execution with input { userId, cardId, s3Keys{front,back?}, requestId }. Workflow: • Task 1 — RekognitionExtract: Lambda calls Rekognition and returns FeatureEnvelope. • Parallel — PricingAgent and AuthenticityAgent (Bedrock) run concurrently; AuthenticityAgent consumes the FeatureEnvelope. • Join — Aggregator merges results, persists to DynamoDB, emits EventBridge events. • Error handling — retries/backoff per task, DLQ for persistent failures, partial result persistence allowed.

# 11. Coding Standards & Patterns

• Thin handlers → domain → adapters; pure functions; ProblemDetails; idempotency via DDB tokens; structured JSON logs (no PII).

# 12. Observability

CloudWatch logs/metrics; X-Ray traces; dashboards per endpoint/agent; alarms via DevOps.

# 13. Testing

Unit, integration (S3/DDB/Step Functions with mocks), E2E API (auth→upload→identify→value→save), error/rate-limit scenarios.

# 14. Interfaces with DevOps

Provide handler names, IAM needs, env var names, memory/timeout hints, optional OpenAPI; consume Terraform outputs.

AWS_REGION=  
DDB_TABLE=  
BUCKET_UPLOADS=  
COGNITO_USER_POOL_ID=  
COGNITO_CLIENT_ID=  
JWKS_URL=  
ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic  
MAX_UPLOAD_MB=12  
EBAY_APP_ID= (SSM/Secrets)  
TCGPLAYER_PUBLIC_KEY= (SSM/Secrets)  
TCGPLAYER_PRIVATE_KEY= (SSM/Secrets)  
PRICECHARTING_KEY= (SSM/Secrets)  
CACHE_TTL_SECONDS=300  
IDEMPOTENCY_TTL_SECONDS=600  
STEP_FUNCTIONS_ARN=  
EVENT_BUS_NAME=  
BEDROCK_MODEL_ID=\<e.g., anthropic.claude-3-sonnet\>  
BEDROCK_MAX_TOKENS=2048  
BEDROCK_TEMPERATURE=0.2
