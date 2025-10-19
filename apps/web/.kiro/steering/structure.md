# Project Structure

## Monorepo Organization

CollectIQ uses a pnpm workspace monorepo with clear separation between applications and shared packages.

```
collect-iq/
├── apps/                    # Application packages
│   └── web/                 # Next.js 14 frontend (primary app)
│       ├── app/
│       │   ├── (public)/    # Unauthenticated routes (landing, auth callback)
│       │   ├── (protected)/ # JWT-protected routes (upload, vault, cards)
│       │   └── api/         # API route handlers
│       ├── components/      # React components
│       └── lib/             # Utilities and helpers
│
├── services/                # Backend services
│   └── backend/             # AWS Lambda + Step Functions (TypeScript)
│       ├── src/
│       │   ├── handlers/
│       │   ├── agents/
│       │   ├── orchestration/
│       │   ├── adapters/
│       │   ├── store/
│       │   ├── auth/
│       │   ├── utils/
│       │   └── tests/
│       ├── esbuild.mjs
│       ├── tsconfig.json
│       └── package.json
│
├── packages/                # Shared packages
│   ├── shared/              # Shared types/schemas
│   ├── config/              # Build/lint/test config
│   └── telemetry/           # Logging/metrics utilities
│
├── infra/
│   └── terraform/           # Terraform infrastructure as code
│       ├── modules/
│       │   ├── amplify_hosting/
│       │   ├── api_gateway_http/
│       │   ├── cognito_user_pool/
│       │   ├── s3_uploads/
│       │   ├── dynamodb_collectiq/
│       │   ├── lambda_fn/
│       │   ├── step_functions/
│       │   ├── eventbridge_bus/
│       │   ├── rekognition_access/
│       │   ├── bedrock_access/
│       │   ├── cloudwatch_dashboards/
│       │   ├── ssm_secrets/
│       │   └── xray/
│       └── envs/
│           └── hackathon/    # Single environment for hackathon
│
├── docs/                    # Comprehensive specifications
│   ├── Frontend/
│   ├── Backend/
│   ├── DevOps/
│   ├── Project Specification.md
│   ├── Hackathon - Product Requirements.md
│   ├── Venture - Product Requirements.md
│   └── Market Opportunity.md
│
├── .kiro/                   # Kiro IDE configuration
│   ├── specs/               # Granular requirements, design, and tasks
│   └── steering/            # AI assistant guidance
│
├── .github/                 # GitHub Actions workflows
├── package.json             # Root workspace configuration
├── pnpm-workspace.yaml      # Workspace package definitions
├── tsconfig.base.json       # Base TypeScript configuration
├── eslint.config.mjs        # ESLint v9 flat config
├── .prettierrc              # Prettier formatting rules
├── .prettierignore          # Prettier ignore patterns
├── WARP.md                  # Developer guide for Warp AI terminal
├── AGENTS.md                # Repository coding standards
└── README.md                # Project overview
```

## Key Conventions

### Route Organization (Next.js App Router)

- **(public)**: Unauthenticated routes accessible to all users
- **(protected)**: Routes requiring valid Cognito JWT
- **api/**: Server-side API route handlers

### Component Structure

- Group by feature domain (auth, cards, upload, vault)
- `ui/` contains reusable shadcn/ui components
- Each component should be self-contained with co-located types

### Infrastructure Modules

- Each Terraform module is self-contained with inputs, outputs, and resources
- Single hackathon environment configuration lives in `envs/hackathon/`
- Modules are reusable and environment-agnostic

### Documentation Hierarchy

1. **README.md**: High-level overview and quick start
2. **docs/**: Detailed specifications by domain
3. **.kiro/specs/**: Granular implementation requirements
4. **.kiro/steering/**: AI assistant guidance rules

## Data Flow Architecture

```
User → Next.js Frontend → API Gateway (JWT validation)
  → Lambda Handler → Step Functions Orchestration
    → Rekognition (feature extraction)
    → Bedrock Agents (valuation + authenticity)
    → DynamoDB (persistence)
  → EventBridge (event coordination)
```

## Single-Table DynamoDB Design

- **PK**: `USER#{sub}` (Cognito user ID for data isolation)
- **SK**: `CARD#{cardId}` or `PRICE#{ISO8601}` (entity type + identifier)
- **GSI1**: userId (for vault queries)
- **GSI2**: set#rarity (for analytics)

## S3 Upload Structure

- Path pattern: `uploads/{sub}/{uuid}`
- Presigned URLs expire in 60 seconds
- User-scoped access enforced via IAM policies
