# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

CollectIQ is an AI-powered collector assistant for Pokémon TCG cards built as a serverless, authentication-first application on AWS. The system provides real-time card identification, authenticity detection, and valuation using AWS Bedrock, Rekognition, and multi-agent orchestration.

**Core Flows:**

- Authentication via Cognito Hosted UI (OAuth 2.0 with PKCE)
- Upload → Identify → Authenticate → Valuate → Save to Vault
- Multi-agent AI orchestration through AWS Step Functions
- Real-time pricing from eBay, TCGPlayer, and PriceCharting APIs

## Repository Structure

```
collect-iq/
├── apps/                   # User-facing applications
│   └── web/                # Next.js 14 (App Router) frontend
│       ├── app/
│       │   ├── (public)/   # Unauthenticated routes (landing, auth callback)
│       │   ├── (protected)/# JWT-protected routes (upload, vault, cards)
│       │   └── api/        # API route handlers
│       ├── components/     # Feature-organized components (auth, cards, upload, vault, ui)
│       └── lib/            # API client, auth helpers, schemas, utils
├── services/
│   └── backend/            # AWS Lambda + Step Functions backend (TypeScript)
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
│       ├── vitest.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── shared/             # Shared types and schemas
│   ├── config/             # Shared build/lint/test configuration
│   └── telemetry/          # Logging/metrics utilities
├── infra/
│   └── terraform/
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
│           ├── dev/
│           └── prod/
├── docs/                   # Specifications and diagrams
├── scripts/                # Developer tools and local mocks
├── .github/                # CI/CD workflows
└── .kiro/                  # Kiro specs and steering docs
```

### Workspace configuration examples

pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'services/*'
  - 'packages/*'
  - 'infra/*'
```

turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "lint": { "outputs": [] },
    "typecheck": { "outputs": [] },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": [".coverage/**"]
    },
    "dev": { "cache": false, "persistent": true }
  }
}
```

tsconfig.base.json

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022",
    "moduleResolution": "Bundler",
    "strict": false,
    "baseUrl": ".",
    "paths": {
      "@collectiq/shared/*": ["packages/shared/src/*"],
      "@collectiq/config/*": ["packages/config/src/*"]
    }
  }
}
```

**Important:** The frontend (`apps/web/`) may be in early stages. Key directories include `app/`, `components/`, and `lib/`.

## Common Commands

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
cp .env.example apps/web/.env.local
# Fill in AWS Cognito credentials, API URLs, and S3/DynamoDB names
```

### Development

```bash
# Start Next.js dev server
pnpm web:dev

# Build for production
pnpm web:build

# Start production server
pnpm web:start
```

### Code Quality

```bash
# Lint all packages (ESLint v9 + Prettier)
pnpm lint

# Type-check the web app
pnpm typecheck
```

### Testing

Testing infrastructure uses:

- **Vitest** + **React Testing Library** for unit/integration tests
- **Playwright** for E2E tests
- **axe-core** for accessibility testing

Tests are named `*.test.ts[x]` and colocated with source or in `tests/` directories.

**Note:** Test commands may not be fully configured yet. Check `package.json` in workspace packages for available scripts.

## Architecture Overview

### Frontend (Next.js 14)

- **Authentication**: Cognito Hosted UI redirects for sign in/up/out. JWT tokens stored in HTTP-only cookies (never localStorage).
- **Route Groups**:
  - `(public)`: Unauthenticated routes (auth callback, landing)
  - `(protected)`: Routes wrapped with `AuthGuard` requiring valid JWT
- **Data Fetching**: SWR for client-side caching; native fetch with typed wrapper
- **Validation**: Zod schemas for runtime type safety
- **Styling**: Tailwind CSS v4 with `@theme` directive + shadcn/ui components

### Backend (AWS Serverless)

- **API Gateway (HTTP API)** with JWT authorizer validates Cognito tokens
- **Lambda Functions**: Thin handlers for upload presign, cards CRUD, workflow triggers
- **Step Functions**: Orchestrates multi-step AI workflows
  - RekognitionExtract task: Visual feature extraction (OCR, holo patterns, borders)
  - Parallel execution: Pricing Agent + Authenticity Agent (both using Bedrock)
  - Aggregator task: Merge results, persist to DynamoDB, emit EventBridge events
- **DynamoDB**: Single-table design with user-scoped partitions
  - `PK: USER#{sub}`, `SK: CARD#{cardId}` or `PRICE#{ISO8601}`
  - GSI1: userId (vault queries), GSI2: set#rarity (analytics)
- **S3**: Presigned uploads scoped to `uploads/{sub}/{uuid}` (expire in 60 seconds)
- **Bedrock + Rekognition**: AI agents for identification, valuation, and authenticity detection
- **EventBridge**: Event-driven coordination between agents

### Multi-Agent Pattern

Four specialized agents coordinate through Step Functions:

1. **Ingestion Agent**: Fetches real-time pricing from multiple APIs
2. **Valuation Agent**: Computes fair market value and confidence scores
3. **Authenticity Agent**: Detects fake/altered cards via visual analysis
4. **Feedback Agent**: Processes user corrections to refine models

### Infrastructure as Code

Terraform modules (in `infra/terraform/`) provision all AWS resources:

- Amplify for Next.js deployment
- API Gateway + Lambda + Step Functions
- Cognito User Pool with Hosted UI
- DynamoDB tables, S3 buckets, IAM roles
- EventBridge for event-driven coordination

## Key Technical Decisions

### Authentication Flow

- Users are redirected to **Cognito Hosted UI** for all auth operations
- OAuth 2.0 authorization code flow with PKCE
- AWS Amplify handles OAuth callback automatically at redirect URI (/)
- `AuthGuard` component protects routes and handles session expiry
- No custom auth forms; AWS manages UI and security

### Data Scoping

- All DynamoDB records use `USER#{sub}` partition keys
- S3 object keys include user ID: `uploads/{sub}/{uuid}`
- Lambda handlers extract `sub` from JWT claims to enforce ownership
- API returns 403 if resource owner doesn't match authenticated user

### Error Handling

- APIs return **RFC 7807 Problem Details** JSON on errors
- HTTP-only cookie storage prevents XSS token theft
- Strict CSP headers prevent inline script execution
- Rate limiting and exponential backoff for external API calls

### Performance Targets

- **LCP** < 2.5s (Largest Contentful Paint)
- **CLS** < 0.1 (Cumulative Layout Shift)
- **INP** < 200ms (Interaction to Next Paint)
- Monitored via Lighthouse CI in deployment pipeline

## Coding Standards

### TypeScript

- Strict mode disabled. It should NOT be strict (`tsconfig.base.json`)
- 2-space indentation
- All public functions and components typed
- Zod schemas for API contracts and form validation

### React/Next.js

- Components: PascalCase (e.g., `UploadDropzone.tsx`)
- Utilities: camelCase (e.g., `formatCurrency`)
- Route segments: lowercase kebab-case (e.g., `/cards/[id]`)
- Prefer server components; use `'use client'` only when necessary
- Colocate tests with components

### Styling

- Tailwind CSS utility classes only; avoid inline styles
- shadcn/ui for accessible component primitives
- CSS variables for theming (light/dark mode)
- Use `@theme` directive in `globals.css` for design tokens

### Linting & Formatting

- **ESLint v9** with flat config (`eslint.config.mjs`)
- **Prettier** enforced via ESLint plugin
- Settings: `semi: true`, `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 100`
- Run `pnpm lint` before committing

## Environment Variables

### Required Server-Side (.env)

- `AWS_REGION`: AWS region (e.g., `us-east-1`)
- `DDB_TABLE`: DynamoDB table name for cards/vaults
- `BUCKET_UPLOADS`: S3 bucket for direct client uploads
- `COGNITO_USER_POOL_ID`: Cognito User Pool ID
- `COGNITO_CLIENT_ID`: Cognito App Client ID
- `BEDROCK_MODEL_ID`: Bedrock model identifier (e.g., `anthropic.claude-3-5-sonnet-...`)

### Required Client-Side (.env.local)

- `NEXT_PUBLIC_REGION`: AWS region (mirrors `AWS_REGION`)
- `NEXT_PUBLIC_USER_POOL_ID`: Cognito User Pool ID
- `NEXT_PUBLIC_USER_POOL_CLIENT_ID`: Cognito App Client ID
- `NEXT_PUBLIC_IDENTITY_POOL_ID`: Cognito Identity Pool ID (if using federated identities)

### Optional

- `PRICE_WINDOW_DAYS`: Rolling window for price aggregation (default: 14)
- `USE_MOCKS`: Use mock adapters instead of live APIs (`true` for local dev)

**Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

## Specifications & Documentation

Comprehensive project specs are located in:

- `docs/Project Specification.md` — High-level system design and architecture
- `docs/Frontend/Frontend Project Specification.md` — UI flows, wireframes, component specs
- `docs/Backend/Backend Project Specification.md` — API contracts, Lambda handlers, DynamoDB schema
- `docs/DevOps/DevOps Project Specification.md` — Terraform modules, CI/CD, AWS cost optimization
- `docs/Market Opportunity.md` — Industry analysis, competitive landscape, market sizing
- `.kiro/specs/` — Granular requirements, design decisions, and task breakdowns per workstream
  - `collectiq-frontend/` — Frontend requirements, design, tasks
  - `collectiq-backend/` — Backend requirements, design, tasks
  - `collectiq-devops/` — DevOps requirements, design, tasks
- `.kiro/steering/` — AI assistant guidance rules
  - `product.md` — Product overview, core features, user flows
  - `structure.md` — Project structure conventions, data flow architecture
  - `tech.md` — Technology stack, common commands, environment variables

Always consult these documents when:

- Implementing new features (check requirements and tasks)
- Understanding data models (see Backend design)
- Modifying auth flows (see Frontend auth section)
- Provisioning infrastructure (see DevOps Terraform modules)
- Following coding conventions (see steering documents)

## Task Tracking

**CRITICAL**: When completing any frontend, backend, or DevOps task, update the appropriate task file:

- **Frontend tasks**: `.kiro/specs/collectiq-frontend/tasks.md`
- **Backend tasks**: `.kiro/specs/collectiq-backend/tasks.md`
- **DevOps tasks**: `.kiro/specs/collectiq-devops/tasks.md`

### How to Update Task Status

1. Open the appropriate task file for your workstream
2. Locate the task you completed
3. Mark the task as completed (update status/checkbox)
4. Add completion notes:
   - Date completed
   - Implementation details
   - Any deviations from the original spec
   - Links to relevant PRs or commits

### Example Task Update

```markdown
- [x] FE-T1.2: Implement AuthGuard component
  - Status: Completed (2025-10-15)
  - Implementation: Created `components/auth/AuthGuard.tsx` with session verification
  - Deviations: Added optional `fallback` prop for custom loading states
  - PR: #123
```

**Always update task completion status before closing a pull request.**

## Debugging Tips

### Authentication Issues

- Check Cognito User Pool and App Client configuration in AWS Console
- Verify redirect URIs match your Next.js app URL
- Inspect JWT claims in browser DevTools (Network tab, check `Authorization` header)
- Ensure HTTP-only cookies are set correctly (check `Set-Cookie` response headers)

### API Errors

- All errors follow RFC 7807 format: `{ type, title, status, detail }`
- Check CloudWatch Logs for Lambda execution logs (grouped by `requestId`)
- Verify JWT token is valid and not expired
- Confirm user ID (`sub`) matches resource owner in DynamoDB

### Upload Failures

- Presigned URLs expire in 60 seconds
- Verify MIME type is in allowed list (check backend validation)
- Confirm file size is ≤ 12MB
- Check S3 bucket CORS configuration

### Missing Environment Variables

- Compare `.env` and `.env.local` against `.env.example`
- Restart Next.js dev server after changing env vars
- Variables must be prefixed with `NEXT_PUBLIC_` for client-side access

### Type Errors

- Run `pnpm typecheck` to see all TypeScript errors
- Check `tsconfig.base.json` and workspace-specific `tsconfig.json` for compiler options
- Ensure dependencies are installed (`pnpm install`)
