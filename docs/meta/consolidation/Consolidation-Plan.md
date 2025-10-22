# Documentation Consolidation Plan

**Date**: October 22, 2025  
**Scope**: Backend, Packages, and Infrastructure Documentation

## Overview

This document outlines the plan to consolidate all markdown documentation from:

- `services/backend/` - Backend service documentation
- `packages/` - Shared packages documentation
- `infra/terraform/` - Infrastructure documentation

## Current State Analysis

### Backend Documentation (services/backend/)

**Root Level** (13 files):

- README.md
- DEPLOYMENT_GUIDE.md
- ENVIRONMENT_VARIABLES.md
- IAM_REQUIREMENTS.md
- E2E_TEST_SETUP.md
- API_CARD_METADATA.md
- BACKEND_JWT_VERIFICATION.md
- JWT_VERIFICATION_SUMMARY.md
- CARD_DETECTION_FEATURE.md
- OCR_REASONING_TROUBLESHOOTING.md
- .task-completion.md (4 files)

**Source Level** (4 files):

- src/adapters/README.md
- src/adapters/README-rekognition.md
- src/utils/SECURITY_HEADERS.md
- src/utils/idempotency-example.md
- src/tests/e2e/README.md
- src/tests/e2e/QUICK_START.md

### Packages Documentation (packages/)

**Telemetry** (3 files):

- README.md
- USAGE.md
- .implementation-summary.md

**Shared** (1 file):

- README.md

### Infrastructure Documentation (infra/terraform/)

**Root Level** (3 files):

- README.md
- QUICK_START.md
- SETUP.md

**Environment Level** (2 files):

- envs/ENVIRONMENT_STRATEGY.md
- envs/hackathon/README.md
- envs/hackathon/.task-4-completion.md

**Hackathon Docs** (12 files):

- envs/hackathon/docs/DEPLOYMENT_GUIDE.md
- envs/hackathon/docs/LAMBDA_DEPLOYMENT.md
- envs/hackathon/docs/QUICK_DEPLOY.md
- envs/hackathon/docs/QUICK_START.md
- envs/hackathon/docs/QUICK_TEST_WORKFLOW.md
- envs/hackathon/docs/STEP_FUNCTIONS_DEPLOYMENT.md
- envs/hackathon/docs/STEP_FUNCTIONS_WORKFLOW.md
- envs/hackathon/docs/TASK_1_COMPLETION.md
- envs/hackathon/docs/TASK_3_COMPLETION.md
- envs/hackathon/docs/TASK_5_COMPLETION.md
- envs/hackathon/docs/TASK_6_COMPLETION.md
- envs/hackathon/docs/XRAY_TRACING.md

**Module Level** (15 files):

- modules/\*/README.md (one per module)
- modules/api_gateway_http/DEPLOYMENT.md
- modules/cloudwatch_dashboards/OCR_REASONING_MONITORING.md
- modules/lambda_fn/IAM_PERMISSIONS.md

## Proposed Structure

```
docs/
├── README.md                           # Main documentation index
├── backend/
│   ├── README.md                       # Backend overview
│   ├── getting-started/
│   │   ├── QUICK_START.md
│   │   ├── ENVIRONMENT_VARIABLES.md
│   │   └── IAM_REQUIREMENTS.md
│   ├── development/
│   │   ├── API_ENDPOINTS.md            # Consolidated API docs
│   │   ├── AUTHENTICATION.md           # JWT verification
│   │   ├── TESTING.md                  # E2E testing guide
│   │   └── DEPLOYMENT.md               # Deployment guide
│   ├── architecture/
│   │   ├── ADAPTERS.md                 # Pricing & Rekognition adapters
│   │   ├── AGENTS.md                   # AI agents architecture
│   │   ├── ORCHESTRATION.md            # Step Functions workflow
│   │   └── DATA_MODELS.md              # DynamoDB schemas
│   ├── features/
│   │   ├── CARD_DETECTION.md
│   │   ├── OCR_REASONING.md
│   │   ├── PRICING.md
│   │   └── AUTHENTICITY.md
│   └── troubleshooting/
│       └── OCR_REASONING.md
│
├── packages/
│   ├── README.md                       # Packages overview
│   ├── shared/
│   │   └── README.md                   # Shared types/schemas
│   └── telemetry/
│       ├── README.md                   # Telemetry overview
│       └── USAGE.md                    # Usage guide
│
├── infrastructure/
│   ├── README.md                       # Infrastructure overview
│   ├── getting-started/
│   │   ├── QUICK_START.md
│   │   ├── SETUP.md
│   │   └── ENVIRONMENT_STRATEGY.md
│   ├── deployment/
│   │   ├── DEPLOYMENT_GUIDE.md
│   │   ├── LAMBDA_DEPLOYMENT.md
│   │   ├── QUICK_DEPLOY.md
│   │   └── STEP_FUNCTIONS_DEPLOYMENT.md
│   ├── workflows/
│   │   ├── STEP_FUNCTIONS_WORKFLOW.md
│   │   └── QUICK_TEST_WORKFLOW.md
│   ├── monitoring/
│   │   ├── XRAY_TRACING.md
│   │   └── OCR_REASONING_MONITORING.md
│   └── modules/
│       ├── README.md                   # Modules overview
│       ├── AMPLIFY_HOSTING.md
│       ├── API_GATEWAY.md
│       ├── BEDROCK_ACCESS.md
│       ├── CLOUDWATCH_DASHBOARDS.md
│       ├── COGNITO_USER_POOL.md
│       ├── DYNAMODB.md
│       ├── EVENTBRIDGE_BUS.md
│       ├── LAMBDA_FUNCTION.md
│       ├── LAMBDA_SHARP_LAYER.md
│       ├── REKOGNITION_ACCESS.md
│       ├── S3_UPLOADS.md
│       ├── SSM_SECRETS.md
│       ├── STEP_FUNCTIONS.md
│       └── VPC.md
│
└── CONSOLIDATION_SUMMARY.md            # This file
```

## Consolidation Strategy

### Phase 1: Create New Structure

1. Create `docs/backend/`, `docs/packages/`, `docs/infrastructure/` directories
2. Create subdirectories for each category
3. Create index files (README.md) for each section

### Phase 2: Consolidate & Migrate

1. **Backend Documentation**
   - Merge duplicate deployment guides
   - Consolidate JWT verification docs
   - Merge API documentation
   - Consolidate testing guides
   - Move adapter/agent docs to architecture section

2. **Packages Documentation**
   - Keep telemetry docs together
   - Consolidate implementation summaries

3. **Infrastructure Documentation**
   - Merge duplicate quick start guides
   - Consolidate deployment guides
   - Merge module READMEs into single comprehensive docs
   - Move monitoring docs together

### Phase 3: Remove Duplicates

1. Delete task completion files (historical, not needed)
2. Remove duplicate quick start guides
3. Remove redundant deployment guides
4. Clean up module-level READMEs (consolidate into single docs)

### Phase 4: Update References

1. Update all internal links
2. Update main README.md
3. Update package.json scripts if needed
4. Update CI/CD references

## Files to Remove

### Backend

- `.task-completion.md` (4 files) - Historical task tracking
- `JWT_VERIFICATION_SUMMARY.md` - Duplicate of BACKEND_JWT_VERIFICATION.md
- `src/adapters/README-rekognition.md` - Merge into main adapters doc

### Infrastructure

- `envs/hackathon/.task-4-completion.md` - Historical
- `envs/hackathon/docs/TASK_*.md` (4 files) - Historical task tracking
- Duplicate QUICK_START.md files (keep one consolidated version)

### Packages

- `.implementation-summary.md` - Merge into main README

## Benefits

1. **Single Source of Truth**: All documentation in one organized location
2. **Better Organization**: Logical hierarchy by domain and purpose
3. **Reduced Duplication**: No more duplicate guides
4. **Easier Navigation**: Clear structure for finding information
5. **Improved Maintenance**: One place to update documentation
6. **Better Discoverability**: New developers know where to look

## Next Steps

1. Execute consolidation plan
2. Create comprehensive index
3. Update all cross-references
4. Remove old files
5. Update main README
6. Notify team of new structure
