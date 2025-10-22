# Technology Stack

## Build System

- **Package Manager**: pnpm 9+ with workspace support
- **Build Orchestration**: Turborepo (monorepo task runner)
- **Monorepo Structure**: pnpm workspaces (`apps/*`, `services/*`, `packages/*`, `infra/*`)
- **TypeScript**: v5.x (latest) in non-strict mode
- **Node.js**: v20+

## Frontend Stack

### Core Framework

- **Framework**: Next.js 14 with App Router (React 18)
- **Language**: TypeScript v5.x (non-strict mode)
- **Runtime**: Node.js 20+

### Styling & UI

- **Styling**: Tailwind CSS v4 with `@theme` directive
- **UI Components**: shadcn/ui (built on Radix UI primitives)
- **Icons**: Lucide React
- **Fonts**: Inter (UI), Space Grotesk (Display), JetBrains Mono (Code)

### Data Management

- **Data Fetching**: SWR for client-side caching
- **Validation**: Zod schemas for runtime type safety
- **State Management**: React hooks + SWR cache
- **Form Handling**: React Hook Form (when needed)

### Visualization

- **Charts**: Recharts (lazy-loaded for performance)
- **Diagrams**: Mermaid (for documentation)

### Authentication

- **Provider**: AWS Amplify
- **Service**: Amazon Cognito with Hosted UI
- **Protocol**: OAuth 2.0 with PKCE
- **Token Storage**: Secure HTTP-only cookies

### Testing

- **Unit Tests**: Vitest + React Testing Library
- **E2E Tests**: Playwright
- **Accessibility**: axe-core
- **Coverage Target**: 90%+

## Backend Stack

### Compute

- **Runtime**: AWS Lambda (Node.js 20)
- **Language**: TypeScript
- **Bundler**: esbuild for fast builds

### Orchestration

- **Workflow**: AWS Step Functions (state machines)
- **Events**: Amazon EventBridge (event bus)
- **Scheduling**: EventBridge Scheduler

### AI/ML

- **LLM**: Amazon Bedrock (Claude 4.0 Sonnet)
- **Vision**: Amazon Rekognition (feature extraction)
- **Agents**: Bedrock Agents (valuation + authenticity)

### Data Storage

- **Database**: Amazon DynamoDB (single-table design)
- **Object Storage**: Amazon S3 (card images)
- **Caching**: DynamoDB DAX (if needed)

### API

- **Gateway**: Amazon API Gateway (HTTP API)
- **Authorization**: JWT authorizer (Cognito)
- **Protocol**: REST over HTTPS

### Security

- **Authentication**: Amazon Cognito
- **Secrets**: AWS Secrets Manager with automatic rotation
- **Encryption**: KMS for data at rest
- **IAM**: Least-privilege policies

## Infrastructure

### Infrastructure as Code

- **Tool**: Terraform (modular design)
- **State**: S3 backend with DynamoDB locking
- **Modules**: Reusable, environment-agnostic

### CI/CD

- **Frontend**: AWS Amplify (automatic deployments)
- **Backend**: GitHub Actions (Lambda deployments)
- **IaC**: GitHub Actions (Terraform apply)

### Monitoring & Observability

- **Logs**: Amazon CloudWatch Logs
- **Metrics**: CloudWatch Metrics
- **Tracing**: AWS X-Ray
- **Dashboards**: CloudWatch Dashboards
- **Alarms**: CloudWatch Alarms

### Networking

- **CDN**: CloudFront (via Amplify)
- **DNS**: Route 53 (if custom domain)
- **SSL/TLS**: ACM certificates

## Code Quality

### Linting & Formatting

- **Linter**: ESLint v9 (flat config)
- **Formatter**: Prettier
- **Pre-commit**: Husky + lint-staged

### Type Checking

- **TypeScript**: Non-strict mode
- **Runtime Validation**: Zod schemas
- **API Types**: Generated from Zod schemas

### Testing

- **Unit Tests**: Vitest (fast, ESM-native)
- **Component Tests**: React Testing Library
- **E2E Tests**: Playwright (cross-browser)
- **Accessibility**: axe-core integration
- **Coverage**: 90%+ target

### Performance

- **Monitoring**: Lighthouse CI
- **Metrics**: Web Vitals
- **Targets**:
  - LCP < 2.5s (Largest Contentful Paint)
  - CLS < 0.1 (Cumulative Layout Shift)
  - INP < 200ms (Interaction to Next Paint)

## Development Tools

### IDE

- **Primary**: Kiro IDE (AI-assisted development)
- **Alternative**: VS Code with extensions

### Version Control

- **VCS**: Git
- **Hosting**: GitHub
- **Strategy**: Git subtree for web app

### Package Management

- **Manager**: pnpm (fast, disk-efficient)
- **Workspaces**: Monorepo support
- **Lock File**: pnpm-lock.yaml

### Build Tools

- **Frontend**: Next.js built-in (Turbopack in dev)
- **Backend**: esbuild (fast TypeScript bundling)
- **Monorepo**: Turborepo (task orchestration)

## Common Commands

### Development

```bash
# Install dependencies
pnpm install

# Start Next.js dev server
pnpm web:dev

# Run linting
pnpm lint

# Type checking
pnpm typecheck
```

### Production

```bash
# Build Next.js for production
pnpm web:build

# Start production server
pnpm web:start
```

### Infrastructure

```bash
# Initialize Terraform (from infra/terraform)
terraform init

# Preview infrastructure changes
terraform plan

# Apply infrastructure changes
terraform apply
```

### Testing

```bash
# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Run accessibility tests
pnpm test:a11y

# Generate coverage report
pnpm test:coverage
```

## Environment Variables

### Frontend (Next.js)

```bash
# AWS Configuration
NEXT_PUBLIC_AWS_REGION=us-east-1

# Cognito Configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_COGNITO_DOMAIN=collectiq.auth.us-east-1.amazoncognito.com

# OAuth Configuration
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_OAUTH_LOGOUT_URI=http://localhost:3000/landing

# API Configuration
NEXT_PUBLIC_API_BASE=https://api.collectiq.com
```

### Backend (Lambda)

```bash
# DynamoDB
DYNAMODB_TABLE_NAME=collectiq-cards

# S3
S3_UPLOAD_BUCKET=collectiq-uploads

# Bedrock
BEDROCK_MODEL_ID=anthropic.claude-4-sonnet-20250514

# AWS Region
AWS_REGION=us-east-1
```

See [Environment Setup](../getting-started/ENVIRONMENT_SETUP.md) for detailed configuration.

## TypeScript Configuration

### Base Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": false,
    "jsx": "preserve",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Path Aliases

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## Dependencies

### Frontend Core

- `next@14` - React framework
- `react@18` - UI library
- `react-dom@18` - React DOM renderer
- `typescript@5` - Type safety

### Frontend UI

- `tailwindcss@4` - Utility-first CSS
- `@radix-ui/*` - Accessible UI primitives
- `lucide-react` - Icon library
- `recharts` - Charting library

### Frontend Data

- `swr` - Data fetching and caching
- `zod` - Schema validation
- `aws-amplify` - AWS integration

### Backend Core

- `@aws-sdk/client-dynamodb` - DynamoDB client
- `@aws-sdk/client-s3` - S3 client
- `@aws-sdk/client-bedrock-runtime` - Bedrock client
- `@aws-sdk/client-rekognition` - Rekognition client

### Development

- `vitest` - Unit testing
- `@playwright/test` - E2E testing
- `eslint@9` - Linting
- `prettier` - Code formatting

## Architecture Decisions

### Why Next.js 14?

- App Router for modern routing
- Server Components for performance
- Built-in optimization (images, fonts)
- Excellent TypeScript support

### Why Tailwind CSS v4?

- Utility-first approach
- Excellent performance
- Design system integration
- Dark mode support

### Why SWR?

- Automatic caching and revalidation
- Optimistic updates
- Request deduplication
- Excellent TypeScript support

### Why DynamoDB?

- Serverless (no infrastructure management)
- Single-table design for efficiency
- Predictable performance at scale
- Cost-effective for our use case

### Why Bedrock?

- Managed AI service (no model hosting)
- Claude 4.0 Sonnet for reasoning
- Agent framework for orchestration
- Pay-per-use pricing

## Learn More

- [Project Structure](./PROJECT_STRUCTURE.md)
- [Quick Start Guide](../getting-started/QUICK_START.md)
- [Authentication Guide](../development/AUTHENTICATION.md)
