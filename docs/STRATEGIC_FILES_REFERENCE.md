# Strategic Files Reference

This document explains why certain .md files remain in their original locations outside of the `docs/` directory.

## Philosophy

Not all documentation belongs in a centralized `docs/` directory. Some documentation is better kept close to the code it documents, serving as:

- **Package-level overviews** for npm packages
- **Module-level technical references** for specific code modules
- **Inline code documentation** for developers working in specific files
- **Environment-specific deployment guides** for infrastructure

## Backend Strategic Files (5 files)

### Package Documentation

**Location**: `services/backend/README.md`  
**Purpose**: Package-level overview for the backend service  
**Why kept**: Standard npm package convention - developers expect a README at package root  
**Audience**: Developers setting up or contributing to the backend service

### Module Documentation

**Location**: `services/backend/src/adapters/README.md`  
**Purpose**: Overview of all adapter implementations  
**Why kept**: Module-level documentation that belongs with the adapter code  
**Audience**: Developers working on or extending adapters

**Location**: `services/backend/src/adapters/README-rekognition.md`  
**Purpose**: Detailed technical reference for Rekognition adapter  
**Why kept**: Deep technical documentation for a specific adapter implementation  
**Audience**: Developers working on image processing and feature extraction

### Inline Code Documentation

**Location**: `services/backend/src/utils/SECURITY_HEADERS.md`  
**Purpose**: Documentation for security header utilities  
**Why kept**: Inline documentation for security-critical code  
**Audience**: Developers implementing or reviewing security headers

**Location**: `services/backend/src/utils/idempotency-example.md`  
**Purpose**: Code examples for idempotency implementation  
**Why kept**: Inline examples for developers implementing idempotent handlers  
**Audience**: Developers adding new API endpoints

## Packages Strategic Files (3 files)

### Shared Package

**Location**: `packages/shared/README.md`  
**Purpose**: Package documentation for shared types and schemas  
**Why kept**: Standard npm package convention  
**Audience**: Developers using shared types across the monorepo

### Telemetry Package

**Location**: `packages/telemetry/README.md`  
**Purpose**: Package overview for telemetry utilities  
**Why kept**: Standard npm package convention  
**Audience**: Developers implementing logging, metrics, or tracing

**Location**: `packages/telemetry/USAGE.md`  
**Purpose**: Detailed usage guide for telemetry package  
**Why kept**: Package-specific usage documentation  
**Audience**: Developers integrating telemetry into their code

## Infrastructure Strategic Files (28 files)

### Main Infrastructure

**Location**: `infra/terraform/README.md`  
**Purpose**: Main infrastructure overview and getting started guide  
**Why kept**: Entry point for infrastructure documentation  
**Audience**: DevOps engineers and infrastructure developers

### Environment Strategy

**Location**: `infra/terraform/envs/ENVIRONMENT_STRATEGY.md`  
**Purpose**: Strategy document for environment management  
**Why kept**: High-level strategy that applies to all environments  
**Audience**: DevOps team and architects

### Hackathon Environment (9 files)

**Location**: `infra/terraform/envs/hackathon/README.md`  
**Purpose**: Environment-specific overview  
**Why kept**: Environment-specific documentation belongs with environment code  
**Audience**: Developers deploying to hackathon environment

**Location**: `infra/terraform/envs/hackathon/docs/*.md` (8 files)

- `DEPLOYMENT_GUIDE.md` - Hackathon deployment procedures
- `LAMBDA_DEPLOYMENT.md` - Lambda-specific deployment
- `QUICK_DEPLOY.md` - Quick deployment guide
- `QUICK_START.md` - Quick start for hackathon
- `QUICK_TEST_WORKFLOW.md` - Testing workflow
- `STEP_FUNCTIONS_DEPLOYMENT.md` - Step Functions deployment
- `STEP_FUNCTIONS_WORKFLOW.md` - Workflow documentation
- `XRAY_TRACING.md` - X-Ray tracing setup

**Why kept**: Environment-specific deployment and workflow guides  
**Audience**: Developers working specifically with hackathon environment

### Terraform Modules (18 files)

Each Terraform module has its own README and sometimes additional documentation:

**Modules with README.md**:

- `modules/amplify_hosting/README.md`
- `modules/api_gateway_http/README.md`
- `modules/bedrock_access/README.md`
- `modules/cloudwatch_dashboards/README.md`
- `modules/cognito_user_pool/README.md`
- `modules/dynamodb_collectiq/README.md`
- `modules/eventbridge_bus/README.md`
- `modules/lambda_fn/README.md`
- `modules/lambda_sharp_layer/README.md`
- `modules/rekognition_access/README.md`
- `modules/s3_uploads/README.md`
- `modules/ssm_secrets/README.md`
- `modules/step_functions/README.md`
- `modules/vpc/README.md`

**Additional Module Documentation**:

- `modules/api_gateway_http/DEPLOYMENT.md` - API Gateway deployment specifics
- `modules/lambda_fn/IAM_PERMISSIONS.md` - Lambda IAM requirements
- `modules/cloudwatch_dashboards/OCR_REASONING_MONITORING.md` - OCR monitoring setup

**Why kept**: Module-specific documentation belongs with module code  
**Audience**: Infrastructure developers working on specific modules

## When to Use Strategic Files vs. Consolidated Docs

### Use Strategic Files (Keep in Original Location) When:

✅ **Package-level documentation** - README for npm packages  
✅ **Module-level technical details** - Deep dives into specific modules  
✅ **Inline code examples** - Examples for specific utilities  
✅ **Environment-specific procedures** - Deployment guides for specific environments  
✅ **Module-specific configuration** - Terraform module documentation

### Use Consolidated Docs (Move to `docs/`) When:

✅ **Cross-cutting concerns** - Documentation that spans multiple components  
✅ **Getting started guides** - Onboarding documentation  
✅ **Architecture overviews** - System-wide design documentation  
✅ **API documentation** - Complete API reference  
✅ **Troubleshooting guides** - Problem-solving across the system  
✅ **Deployment workflows** - General deployment procedures

## Navigation Guide

### Finding Documentation

**For package usage**:

1. Check package README: `packages/{package}/README.md`
2. Check consolidated docs: `docs/packages/{package}/`

**For module implementation**:

1. Check module README: `services/backend/src/{module}/README.md`
2. Check consolidated docs: `docs/backend/architecture/`

**For infrastructure modules**:

1. Check module README: `infra/terraform/modules/{module}/README.md`
2. Check consolidated overview: `docs/infrastructure/modules/README.md`

**For environment deployment**:

1. Check environment docs: `infra/terraform/envs/{env}/docs/`
2. Check consolidated guide: `docs/infrastructure/deployment/`

### Cross-References

Strategic files often reference consolidated documentation and vice versa:

- **Package READMEs** → Link to detailed guides in `docs/packages/`
- **Module READMEs** → Link to architecture docs in `docs/backend/architecture/`
- **Environment docs** → Link to comprehensive deployment guide in `docs/infrastructure/deployment/`
- **Consolidated docs** → Link back to specific module/package documentation

## Maintenance Guidelines

### Updating Strategic Files

When updating strategic files:

1. **Keep focused** - Only document what's specific to that package/module
2. **Link to consolidated docs** - Reference comprehensive guides in `docs/`
3. **Avoid duplication** - Don't repeat what's in consolidated documentation
4. **Update cross-references** - Keep links between strategic and consolidated docs current

### Adding New Strategic Files

Before adding a new strategic file, ask:

1. Is this package/module-specific? → Keep with code
2. Is this cross-cutting? → Add to `docs/`
3. Is this environment-specific? → Keep with environment
4. Is this a general guide? → Add to `docs/`

## Benefits of This Approach

### ✅ Developer Experience

- **Expected locations** - Developers find READMEs where they expect them
- **Context-aware** - Documentation is close to the code it describes
- **Quick reference** - No need to navigate to central docs for basic info

### ✅ Maintainability

- **Co-located updates** - Update docs when updating code
- **Clear ownership** - Module owners maintain module docs
- **Reduced duplication** - Strategic files focus on specifics, consolidated docs on overview

### ✅ Scalability

- **Modular structure** - Each module/package has its own docs
- **Easy to extend** - New modules bring their own documentation
- **Clear boundaries** - Separation between module-specific and system-wide docs

## Summary

**Strategic files (36 total)**:

- 5 backend files (package + module + inline docs)
- 3 package files (package READMEs)
- 28 infrastructure files (main + environment + module docs)

**Purpose**: Provide context-specific documentation close to the code

**Principle**: Keep documentation where developers expect to find it, while maintaining a comprehensive central hub for cross-cutting concerns and getting started guides.

---

**Last Updated**: October 22, 2025  
**Maintained By**: CollectIQ Documentation Team
