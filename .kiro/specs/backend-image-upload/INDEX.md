# Backend Image Upload Specification - Complete Index

## 📦 Overview

This directory contains the complete specification for CollectIQ's backend image upload system with defense-in-depth validation. The system enforces strict constraints across three layers: presigned URL generation, S3 bucket policy enforcement, and post-upload ingestion verification.

**Status**: Requirements ✅ | Design ✅ | Tasks ✅ | Implementation ⏳

---

## 📚 Core Specification Documents

### 1. [requirements.md](./requirements.md)

**13 requirements with 65 EARS-compliant acceptance criteria**

Covers:

- Presigned URL generation with validation
- S3 bucket policy enforcement
- Post-upload magic number validation
- File size verification
- Metadata extraction and storage
- HEIC format handling
- RFC 7807 error responses
- Configuration management
- Observability and monitoring
- Step Functions integration
- Security and compliance
- Rate limiting
- Authentication and authorization

**Use for**: Understanding what needs to be built and why

---

### 2. [design.md](./design.md)

**Complete architecture and component design**

Covers:

- High-level architecture with flow diagrams
- Defense-in-depth validation layers
- 4 Lambda function designs (presign, ingestion, HEIC transcode, config)
- DynamoDB data models (upload & rejection records)
- RFC 7807 error handling
- Testing strategy (unit, integration, load, E2E)
- Security considerations
- Observability (metrics, logs, X-Ray)
- Performance optimization
- Deployment architecture
- Configuration management

**Use for**: Understanding how the system works and architectural decisions

---

### 3. [tasks.md](./tasks.md)

**16 implementation tasks with 60+ sub-tasks**

Organized into phases:

1. Project structure and utilities
2. Presign handler (refactor existing)
3. S3 bucket configuration
4. Ingestion handler
5. HEIC transcode handler
6. Config endpoint
7. Shared utilities
8. API Gateway configuration
9. EventBridge rules
10. DynamoDB setup
11. Authentication
12. Observability
13. Integration tests
14. Terraform deployment
15. Acceptance testing
16. Documentation

**Use for**: Step-by-step implementation guide

---

### 4. [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)

**Current implementation progress and analysis**

Covers:

- What's already implemented (30% complete)
- What needs to be done
- Existing code analysis
- Breaking changes warning
- Priority implementation order
- Estimated effort (19-29 hours)
- Quick wins

**Use for**: Understanding current state and what to work on next

---

## 📖 Technical Reference Documents

### 5. [technical-spec.md](./technical-spec.md)

**1,100+ lines of detailed technical specification**

Covers:

- Upload constraints (12 MB, JPEG/PNG/HEIC)
- Three-layer defense architecture with code examples
- Layer 1: Presign validation (TypeScript examples)
- Layer 2: S3 bucket policy (JSON examples)
- Layer 3: Post-upload validation (TypeScript examples)
- HEIC handling and transcoding
- Metadata extraction
- Error model with examples
- Security and compliance
- Observability patterns

**Use for**: Implementation reference with copy-paste ready code

---

### 6. [presign-examples.md](./presign-examples.md)

**800+ lines of S3 presigned POST policy examples**

Covers:

- Basic and advanced policy patterns
- Per-type presigned URL generation
- Policy condition reference (content-length-range, eq, starts-with)
- S3 rejection scenarios with actual responses
- Bucket policy enforcement examples
- Client upload code (JavaScript, cURL)
- Terraform implementation
- Testing strategies

**Use for**: Implementing presign handlers, debugging S3 403 errors

---

### 7. [error-catalog.md](./error-catalog.md)

**900+ lines of RFC 7807 error contract**

Covers:

- Standard error response structure
- Upload errors (400, 413, 415)
- Authentication errors (401, 403)
- Rate limiting (429)
- Error type URI catalog
- Client handling patterns (TypeScript, React)
- Logging and monitoring
- Testing examples

**Use for**: Frontend error handling, API client implementation

---

### 8. [openapi.yaml](./openapi.yaml)

**400+ lines of OpenAPI 3.1 specification**

Covers:

- POST /api/v1/upload/presign endpoint
- GET /api/v1/config endpoint
- Request/response schemas
- Error response schemas
- JWT authentication
- Examples for all scenarios

**Use for**: Generating API clients, documentation sites, contract testing

---

### 9. [acceptance-tests.md](./acceptance-tests.md)

**700+ lines of comprehensive test scenarios**

Covers:

- 19 acceptance criteria across 8 categories
- Layer 1: Presign validation tests (4 tests)
- Layer 2: S3 policy enforcement tests (3 tests)
- Layer 3: Post-upload validation tests (3 tests)
- HEIC handling tests
- Configuration tests
- Observability tests
- Performance tests
- Security tests
- Complete test commands and assertions

**Use for**: QA testing, CI/CD validation, deployment sign-off

---

### 10. [quick-reference.md](./quick-reference.md)

**300+ lines developer cheat sheet**

Covers:

- Upload flow diagram
- Constraints summary
- Environment variables
- API endpoint examples
- Error response examples
- CloudWatch metrics
- Debugging commands
- Testing snippets
- Security checklist
- Common issues and fixes

**Use for**: Daily development, debugging, quick lookups

---

## 🎯 Key Features

- **Three-Layer Validation**: Presign → S3 Policy → Ingestion
- **12 MB Limit**: Configurable via MAX_UPLOAD_MB
- **JPEG/PNG/HEIC**: Strict allowlist enforcement
- **HEIC Support**: Accept + background transcode to JPEG
- **RFC 7807 Errors**: Consistent, actionable error responses
- **Observability**: 8 CloudWatch metrics, structured logs, X-Ray tracing
- **Security**: JWT auth, user-scoped keys, encryption at rest
- **Rate Limiting**: 10 req/min per user

---

## 🚀 Getting Started

### For Developers

1. Read [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) to understand current state
2. Review [requirements.md](./requirements.md) and [design.md](./design.md) for context
3. Open [tasks.md](./tasks.md) and start with Phase 1 tasks
4. Reference [technical-spec.md](./technical-spec.md) for implementation details
5. Use [presign-examples.md](./presign-examples.md) for S3 policy patterns
6. Check [quick-reference.md](./quick-reference.md) for daily reference

### For QA Engineers

1. Start with [acceptance-tests.md](./acceptance-tests.md)
2. Reference [error-catalog.md](./error-catalog.md) for expected error responses
3. Use [openapi.yaml](./openapi.yaml) for contract testing

### For DevOps Engineers

1. Review [design.md](./design.md) for infrastructure requirements
2. Check [technical-spec.md](./technical-spec.md) for Terraform examples
3. Reference [presign-examples.md](./presign-examples.md) for bucket policies
4. See [quick-reference.md](./quick-reference.md) for environment variables

### For Product Managers

1. Read [requirements.md](./requirements.md) for feature overview
2. Review [acceptance-tests.md](./acceptance-tests.md) for acceptance criteria
3. Check [error-catalog.md](./error-catalog.md) for user-facing error messages

---

## 📊 Implementation Progress

**Overall**: ~30% Complete

- ✅ **Complete**: Project structure, utilities, authentication
- ⚠️ **Partial**: Presign handler (needs refactoring to use POST)
- ❌ **Not Started**: S3 bucket, ingestion handler, HEIC transcode, config endpoint

**Next Steps**:

1. Refactor presign handler to use presigned POST (Task 2)
2. Create S3 bucket with policies (Task 3)
3. Implement ingestion handler (Task 4)
4. Configure EventBridge triggers (Task 9)

See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for detailed breakdown.

---

## 🏗️ Architecture

```
┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌──────────────┐
│  Client  │────▶│ API Gateway │────▶│ Presign  │────▶│    S3    │────▶│  Ingestion   │
│          │     │   + JWT     │     │  Lambda  │     │  Bucket  │     │    Lambda    │
└──────────┘     └─────────────┘     └──────────┘     └──────────┘     └──────────────┘
                        │                   │                │                   │
                        │                   │                │                   │
                        ▼                   ▼                ▼                   ▼
                   Cognito            CloudWatch        Bucket           EventBridge
                   Validate           Metrics           Policy           Trigger
                                                                              │
                                                                              ▼
                                                                        ┌──────────────┐
                                                                        │ DynamoDB +   │
                                                                        │ Step Funcs   │
                                                                        └──────────────┘
```

### Defense Layers

1. **Layer 1 (Presign)**: Validate type & size, return 400 if invalid
2. **Layer 2 (S3 Policy)**: Enforce content-length-range & Content-Type, return 403 if invalid
3. **Layer 3 (Ingestion)**: Magic number check, delete if invalid, emit metrics

---

## 📝 Configuration

```bash
# Upload constraints
MAX_UPLOAD_MB=12
ALLOWED_UPLOAD_MIME=image/jpeg,image/png,image/heic
PRESIGN_TTL_SECONDS=300

# AWS resources
UPLOAD_BUCKET=collectiq-uploads-hackathon
TABLE_NAME=collectiq-hackathon
INGESTION_STATE_MACHINE_ARN=arn:aws:states:...

# Observability
CLOUDWATCH_NAMESPACE=CollectIQ/Uploads
LOG_LEVEL=INFO
```

See [quick-reference.md](./quick-reference.md) for complete configuration reference.

---

## 🔗 Related Documentation

### Project-Wide Documentation

- [Main Project README](../../../README.md)
- [Backend README](../../../services/backend/README.md)
- [Environment Variables](../../../services/backend/ENVIRONMENT_VARIABLES.md)

### Other Specs

- [Frontend Image Upload Spec](../../collectiq-frontend/image-upload-validation.md)
- [Backend Core Spec](../../collectiq-backend/)
- [DevOps Spec](../../collectiq-devops/)

### External References

- [AWS S3 Presigned POST](https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-post-example.html)
- [RFC 7807: Problem Details](https://tools.ietf.org/html/rfc7807)
- [file-type Library](https://github.com/sindresorhus/file-type)
- [sharp Library](https://sharp.pixelplumbing.com/)

---

## 📞 Support

- **Spec Questions**: Review requirements.md and design.md
- **Implementation Help**: Check tasks.md and technical-spec.md
- **API Reference**: See openapi.yaml and error-catalog.md
- **Examples**: See presign-examples.md and quick-reference.md
- **Current Status**: See IMPLEMENTATION_STATUS.md

---

**Last Updated**: October 17, 2025  
**Version**: 1.0.0  
**Status**: ✅ Specification Complete | ⏳ Implementation In Progress
