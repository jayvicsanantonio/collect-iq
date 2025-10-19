# Technology Stack

## Build System

- **Package Manager**: pnpm 9+ with workspace support
- **Build Orchestration**: Turborepo (monorepo task runner)
- **Monorepo Structure**: pnpm workspaces (`apps/*`, `services/*`, `packages/*`, `infra/*`)
- **TypeScript**: v5.x (latest) in non-strict mode
- **Node.js**: v20+

## Frontend Stack

- **Framework**: Next.js 14 with App Router (React 18)
- **Styling**: Tailwind CSS v4 with `@theme` directive
- **UI Components**: shadcn/ui (built on Radix UI primitives)
- **Data Fetching**: SWR for client-side caching
- **Validation**: Zod schemas for runtime type safety
- **Charts**: Recharts (lazy-loaded for performance)
- **Testing**: Vitest + React Testing Library + Playwright + axe-core

## Backend Stack

- **Compute**: AWS Lambda (Node.js 20)
- **Orchestration**: AWS Step Functions + EventBridge
- **AI/ML**: Amazon Bedrock (Claude 4.0 Sonnet) + Amazon Rekognition
- **Database**: Amazon DynamoDB (single-table design)
- **Storage**: Amazon S3 with presigned URLs
- **Authentication**: Amazon Cognito with Hosted UI
- **API**: Amazon API Gateway (HTTP API) with JWT authorizer

## Infrastructure

- **IaC**: Terraform (modular design)
- **CI/CD**: GitHub Actions + AWS Amplify
- **Monitoring**: Amazon CloudWatch + X-Ray
- **Secrets**: AWS Secrets Manager with automatic rotation

## Code Quality

- **Linting**: ESLint v9 (flat config) + Prettier
- **Type Checking**: TypeScript non-strict mode
- **Testing**: 90%+ code coverage target
- **Performance**: Lighthouse CI with Web Vitals targets (LCP < 2.5s, CLS < 0.1, INP < 200ms)

## Common Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm web:dev              # Start Next.js dev server
pnpm lint                 # Run ESLint across workspace
pnpm typecheck            # TypeScript type checking

# Production
pnpm web:build            # Build Next.js for production
pnpm web:start            # Start production server

# Infrastructure (from infra/terraform)
terraform init            # Initialize Terraform
terraform plan            # Preview infrastructure changes
terraform apply           # Apply infrastructure changes
```

## Environment Variables

Copy `.env.example` to `.env` and `apps/web/.env.local`. Required variables include:

- Cognito User Pool ID, Client ID, Domain
- DynamoDB table name
- S3 bucket for uploads
- Bedrock model ID
- AWS region

## TypeScript Configuration

- **Target**: ES2022
- **Module**: ESNext with Bundler resolution
- **Strict Mode**: Disabled (non-strict mode)
- **JSX**: preserve (for Next.js)
- Base config in `tsconfig.base.json`, extended by workspace packages
