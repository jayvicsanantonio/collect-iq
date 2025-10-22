# CollectIQ Documentation

Welcome to the comprehensive documentation for CollectIQ - an AI-powered trading card intelligence platform.

## 📚 Documentation Structure

### [Project Documentation](./project/)

High-level project information, requirements, and specifications.

**Specifications**:

- [Project Specification](./project/specifications/Project-Specification.md) - Complete project spec
- [Project Structure](./project/specifications/Project-Structure.md) - Repository structure
- [Market Opportunity](./project/specifications/Market-Opportunity.md) - Market analysis

**Requirements**:

- [Hackathon Requirements](./project/requirements/) - Hackathon phase requirements
- [Venture Requirements](./project/requirements/) - Venture phase requirements

**Presentations**:

- [Investor Presentation](./project/presentations/CollectIQ-Investor-Presentation.md) - Investor pitch

### [Backend Documentation](./backend/)

Complete documentation for the serverless AWS backend service.

**Getting Started**:

- [IAM Requirements](./backend/getting-started/IAM_REQUIREMENTS.md) - Required IAM permissions
- [Environment Variables](./backend/getting-started/ENVIRONMENT_VARIABLES.md) - Configuration guide
- [E2E Quick Start](./backend/getting-started/E2E_QUICK_START.md) - Quick testing guide

**Development**:

- [Deployment Guide](./backend/development/DEPLOYMENT.md) - Complete deployment instructions
- [Testing Guide](./backend/development/TESTING.md) - E2E test setup
- [Authentication](./backend/development/AUTHENTICATION.md) - JWT verification
- [API Endpoints](./backend/development/API_ENDPOINTS.md) - API documentation
- [Security Headers](./backend/development/SECURITY_HEADERS.md) - Security configuration
- [Idempotency](./backend/development/IDEMPOTENCY.md) - Idempotency implementation

**Architecture**:

- [Adapters](./backend/architecture/ADAPTERS.md) - External service integrations

**Agents**:

- [Agents Overview](./backend/agents/) - All AI agents documentation
- [Pricing Agent](./backend/agents/Pricing-Agent.md) - Market valuation
- [Authenticity Agent](./backend/agents/Authenticity-Agent.md) - Fake detection
- [OCR Reasoning Agent](./backend/agents/OCR-Reasoning-Agent.md) - OCR interpretation
- [Rekognition Extract](./backend/agents/Rekognition-Extract.md) - Feature extraction
- [Aggregator](./backend/agents/Aggregator-Agent.md) - Result aggregation

**Features**:

- [Card Detection](./backend/features/CARD_DETECTION.md) - Card detection feature
- [OCR Card Name Extraction](./backend/features/OCR-Card-Name-Extraction.md) - OCR extraction
- [HEIC Support](./backend/features/HEIC-Support.md) - HEIC image format support
- [Image Display](./backend/features/Image-Display-Implementation.md) - Image display implementation

**Workflows**:

- [Upload Flow](./backend/workflows/Upload-Flow.md) - Complete upload workflow
- [Revalue Workflow](./backend/workflows/Revalue-Workflow.md) - AI analysis workflow
- [Auto-Trigger Revalue](./backend/workflows/Auto-Trigger-Revalue.md) - Automatic revaluation
- [Card Operations](./backend/workflows/Card-Operations-Flow.md) - CRUD operations
- [API Flow](./backend/workflows/API-Flow.md) - API request flows

**Setup**:

- [Pokémon TCG API Setup](./backend/setup/Pokemon-TCG-API-Setup.md) - TCG API integration
- [Pricing API Setup](./backend/setup/Pricing-API-Setup.md) - Pricing APIs setup
- [Pricing Alternatives](./backend/setup/Pricing-Alternatives.md) - Alternative pricing sources

**Operations**:

- [Operations Overview](./backend/operations/) - Infrastructure, deployment, monitoring
- [Operations Specification](./backend/operations/Operations-Specification.md) - Complete operations guide
- [AWS Cost Model & Optimization](./backend/operations/AWS-Cost-Model-Optimization.md) - Cost management

**Troubleshooting**:

- [OCR Reasoning](./backend/troubleshooting/OCR_REASONING.md) - OCR troubleshooting
- [Pricing Troubleshooting](./backend/troubleshooting/Pricing-Troubleshooting.md) - Pricing issues

### [Packages Documentation](./packages/)

Documentation for shared packages used across the monorepo.

**Shared Package**:

- [Shared Types & Schemas](./packages/shared/README.md) - Common types and Zod schemas

**Telemetry Package**:

- [Telemetry Overview](./packages/telemetry/README.md) - Logging, metrics, and tracing
- [Usage Guide](./packages/telemetry/USAGE.md) - How to use telemetry

### [Infrastructure Documentation](./infrastructure/)

Complete Terraform infrastructure documentation.

**Getting Started**:

- [Setup Guide](./infrastructure/getting-started/SETUP.md) - Infrastructure setup
- [Environment Strategy](./infrastructure/getting-started/ENVIRONMENT_STRATEGY.md) - Environment management

**Workflows**:

- [Quick Test Workflow](./infrastructure/workflows/QUICK_TEST_WORKFLOW.md) - Testing workflow
- [Step Functions Workflow](./infrastructure/workflows/STEP_FUNCTIONS_WORKFLOW.md) - Orchestration workflow

**Deployment**:

- [Backend Auto-Trigger Deployment](./infrastructure/deployment/Backend-Auto-Trigger-Deployment.md) - Auto-trigger setup

**Monitoring**:

- [X-Ray Tracing](./infrastructure/monitoring/XRAY_TRACING.md) - Distributed tracing
- [OCR Reasoning Monitoring](./infrastructure/monitoring/OCR_REASONING_MONITORING.md) - OCR monitoring

### [Configuration Reference](./configuration/)

Complete configuration and environment variable documentation.

- [Environment Variables](./configuration/Environment-Variables.md) - All environment variables
- [Quick Reference](./configuration/Quick-Reference.md) - Quick reference guide

### [Development Documentation](./development/)

Development tools, workflows, and best practices.

- [Git Subtree Guide](./development/Git-Subtree.md) - Monorepo management
- [Development Workflow](./development/README.md) - Development best practices

### [Frontend Documentation](./frontend/)

Complete Next.js frontend documentation.

**Project**:

- [Frontend Project Specification](./frontend/Frontend-Project-Specification.md) - Architecture and requirements

**Design & UX**:

- [Design System](./frontend/Design-System.md) - Design tokens and components
- [Wireframes & UX Flows](./frontend/Complete-Wireframes-UX-Flows.md) - User flows
- [UI Copy](./frontend/UI-Copy.md) - Microcopy guidelines

**Features**:

- [Authentication Flow](./frontend/Authentication-Flow.md) - OAuth 2.0 + PKCE
- [Image Upload Spec](./frontend/Image-Upload-Spec.md) - Upload feature
- [Image Upload Acceptance](./frontend/Image-Upload-Acceptance.md) - Acceptance criteria

### [Additional Frontend Documentation](../apps/web/docs/)

Frontend documentation is maintained separately in the web app directory.

- [Frontend Docs](../apps/web/docs/README.md) - Complete frontend documentation

## 🚀 Quick Links

### For New Developers

1. **Project Overview**: Start with [Project Specification](./project/specifications/Project-Specification.md)
2. **Backend**: Start with [Backend README](./backend/README.md)
3. **Infrastructure**: Start with [Infrastructure README](./infrastructure/README.md)
4. **Frontend**: Start with [Frontend README](../apps/web/docs/README.md)
5. **Configuration**: Check [Environment Variables](./configuration/Environment-Variables.md)

### For Deployment

1. **Backend Deployment**: [Deployment Guide](./backend/development/DEPLOYMENT.md)
2. **Infrastructure Setup**: [Setup Guide](./infrastructure/getting-started/SETUP.md)
3. **Environment Configuration**: [Environment Variables](./backend/getting-started/ENVIRONMENT_VARIABLES.md)

### For Development

1. **API Documentation**: [API Endpoints](./backend/development/API_ENDPOINTS.md)
2. **Workflows**: [Backend Workflows](./backend/workflows/)
3. **Testing**: [E2E Testing](./backend/development/TESTING.md)
4. **Architecture**: [Adapters](./backend/architecture/ADAPTERS.md)
5. **Setup Guides**: [Backend Setup](./backend/setup/)

### For Troubleshooting

1. **OCR Issues**: [OCR Troubleshooting](./backend/troubleshooting/OCR_REASONING.md)
2. **Frontend Issues**: [Frontend Troubleshooting](../apps/web/docs/troubleshooting/)
3. **Infrastructure Issues**: Check CloudWatch Logs

## 📖 Documentation Standards

### File Organization

- **Getting Started**: Setup, configuration, quick starts
- **Development**: Guides for developers (deployment, testing, APIs)
- **Architecture**: System design and component documentation
- **Features**: Feature-specific documentation
- **Troubleshooting**: Problem-solving guides
- **Workflows**: Process and workflow documentation
- **Monitoring**: Observability and monitoring guides

### Naming Conventions

- Use UPPERCASE for documentation files (e.g., `README.md`, `DEPLOYMENT.md`)
- Use descriptive names that indicate content
- Group related docs in subdirectories

### Content Guidelines

- Start with a clear title and purpose
- Include table of contents for long documents
- Provide code examples where applicable
- Keep documentation up-to-date with code changes
- Use relative links for cross-references

## 📊 Documentation Status

✅ **FULLY CONSOLIDATED** - All documentation has been organized and consolidated.

**Statistics**:

- **Total Documentation Files**: 114 (78 consolidated + 36 strategic)
- **Consolidated in docs/**: 78 files
- **Backend Strategic Files**: 5 (package + technical references)
- **Packages Documentation**: 3 (package READMEs)
- **Infrastructure Module Docs**: 28 (module + environment specific)
- **Duplicates Removed**: 12 files
- **Success Rate**: 100%

See [Complete Consolidation Report](./COMPLETE_CONSOLIDATION_REPORT.md) for full details.

## 🔄 Recent Updates

- **October 22, 2025**: ✅ Completed full documentation consolidation
- **October 22, 2025**: ✅ Removed all duplicate files (12 files)
- **October 22, 2025**: ✅ Created comprehensive consolidation guides
- **October 22, 2025**: ✅ Established professional documentation structure

## 📝 Contributing to Documentation

When adding or updating documentation:

1. Place it in the appropriate category directory
2. Update this README with a link
3. Use clear, concise language
4. Include practical examples
5. Add troubleshooting sections where relevant
6. Keep cross-references up-to-date

## 🗂️ Archive

Historical documentation and task completion files are preserved in:

- [Task Completions Archive](./archive/task-completions/) - Historical task tracking files
- [Historical Documentation](./archive/historical/) - Completed fixes and implementations

## 📊 Meta Documentation

Documentation about documentation (consolidation reports, fixes, organizational info):

- [Meta Documentation](./meta/) - Consolidation reports and fixes
- [Strategic Files Reference](./STRATEGIC_FILES_REFERENCE.md) - Why certain files stay in original locations
- [Final Organization Plan](./FINAL_ORGANIZATION_PLAN.md) - Latest organization plan
- [Frontend Accuracy Report](../apps/web/docs/DOCUMENTATION_ACCURACY_REPORT.md) - Frontend docs audit

## 🆘 Support

For questions or issues:

1. Check the relevant documentation section
2. Review troubleshooting guides
3. Check GitHub repository issues
4. Contact the team

## 🔗 External Resources

- [AWS Documentation](https://docs.aws.amazon.com/)
- [Terraform Documentation](https://www.terraform.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

**Last Updated**: October 22, 2025  
**Maintained By**: CollectIQ Team
