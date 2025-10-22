# CollectIQ Project Structure

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
│       ├── lib/             # Utilities and helpers
│       └── hooks/           # Custom React hooks
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
├── docs/                    # Comprehensive documentation
│   ├── getting-started/     # Quick start and setup guides
│   ├── development/         # Development guides
│   ├── components/          # Component documentation
│   ├── architecture/        # Architecture documentation
│   └── troubleshooting/     # Troubleshooting guides
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
└── README.md                # Project overview
```

## Key Conventions

### Route Organization (Next.js App Router)

- **(public)**: Unauthenticated routes accessible to all users

  - `/landing` - Landing page
  - `/auth/callback` - OAuth callback handler

- **(protected)**: Routes requiring valid Cognito JWT

  - `/upload` - Card upload page
  - `/vault` - User's card collection
  - `/cards/[id]` - Card detail view
  - `/identify` - Card identification
  - `/authenticity` - Authenticity analysis

- **api/**: Server-side API route handlers (if needed)

### Component Structure

Components are organized by feature domain:

```
components/
├── auth/           # Authentication components
│   ├── AuthGuard.tsx
│   ├── SignInButton.tsx
│   ├── SignOutButton.tsx
│   └── SessionExpiredModal.tsx
├── cards/          # Card-related components
│   ├── CardDetail.tsx
│   ├── AIInsights.tsx
│   ├── AuthenticityBadge.tsx
│   └── ValuationPanel.tsx
├── navigation/     # Navigation components
│   ├── Header.tsx
│   └── Sidebar.tsx
├── upload/         # Upload components
│   ├── UploadDropzone.tsx
│   ├── CameraCapture.tsx
│   └── UploadProgress.tsx
├── vault/          # Vault components
│   ├── VaultGrid.tsx
│   ├── VaultCard.tsx
│   └── PortfolioSummary.tsx
├── ui/             # Reusable shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
└── providers/      # Context providers
    ├── amplify-provider.tsx
    └── swr-provider.tsx
```

Each component should be:

- Self-contained with co-located types
- Documented with usage examples
- Accessible (ARIA labels, keyboard navigation)
- Responsive (mobile, tablet, desktop)

### Library Structure

```
lib/
├── api.ts                  # API client with type-safe methods
├── auth.ts                 # Authentication utilities
├── swr.ts                  # SWR configuration and hooks
├── types.ts                # Shared types and Zod schemas
├── errors.ts               # Error handling utilities
├── error-handling.ts       # Error formatting and mapping
├── env.ts                  # Environment variable validation
├── utils.ts                # General utilities
├── upload-config.ts        # Upload configuration
├── upload-validators.ts    # File validation utilities
├── image-compression.ts    # Image compression utilities
└── mock-card-data.ts       # Mock data for development
```

### Infrastructure Modules

Each Terraform module is self-contained with:

- `main.tf` - Resource definitions
- `variables.tf` - Input variables
- `outputs.tf` - Output values
- `README.md` - Module documentation

Modules are reusable and environment-agnostic. Environment-specific configuration lives in `envs/hackathon/`.

## Data Flow Architecture

```
User → Next.js Frontend → API Gateway (JWT validation)
  → Lambda Handler → Step Functions Orchestration
    → Rekognition (feature extraction)
    → Bedrock Agents (valuation + authenticity)
    → DynamoDB (persistence)
  → EventBridge (event coordination)
```

### Frontend Data Flow

1. **Authentication**: Cognito Hosted UI → JWT tokens → Stored in cookies
2. **Upload**: File → Presigned URL → S3 → Lambda trigger
3. **Processing**: Lambda → Step Functions → AI agents → DynamoDB
4. **Display**: SWR cache → React components → User interface

### Backend Data Flow

1. **Ingestion**: S3 event → Lambda → Extract metadata
2. **Identification**: Rekognition → Feature extraction → Candidate matching
3. **Valuation**: Bedrock agent → Multi-source pricing → Confidence scoring
4. **Authenticity**: Bedrock agent → Visual analysis → Fake detection
5. **Storage**: DynamoDB → Single-table design → User-scoped data

## Single-Table DynamoDB Design

- **PK**: `USER#{sub}` (Cognito user ID for data isolation)
- **SK**: `CARD#{cardId}` or `PRICE#{ISO8601}` (entity type + identifier)
- **GSI1**: userId (for vault queries)
- **GSI2**: set#rarity (for analytics)

This design enables:

- Efficient user-scoped queries
- Time-series pricing data
- Flexible entity relationships
- Cost-effective scaling

## S3 Upload Structure

- Path pattern: `uploads/{sub}/{uuid}`
- Presigned URLs expire in 60 seconds
- User-scoped access enforced via IAM policies
- Automatic lifecycle policies for cleanup

## Documentation Hierarchy

1. **README.md**: High-level overview and quick start
2. **docs/**: Comprehensive guides organized by topic
3. **.kiro/specs/**: Granular implementation requirements
4. **.kiro/steering/**: AI assistant guidance rules

## Path Aliases

TypeScript path aliases for cleaner imports:

- `@/*` - Project root
- `@/components/*` - Components directory
- `@/lib/*` - Library/utilities directory
- `@/hooks/*` - Custom React hooks

Example:

```typescript
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useCards } from '@/lib/swr';
```

## Environment-Specific Configuration

### Development

- Local Next.js dev server
- Localhost callback URLs
- Development Cognito User Pool
- Mock data for testing

### Production

- AWS Amplify hosting
- Production callback URLs
- Production Cognito User Pool
- Real backend integration

## Build and Deployment

### Frontend (Next.js)

```bash
pnpm web:build    # Build for production
pnpm web:start    # Start production server
```

### Backend (Lambda)

```bash
cd services/backend
pnpm build        # Bundle with esbuild
```

### Infrastructure (Terraform)

```bash
cd infra/terraform/envs/hackathon
terraform plan    # Preview changes
terraform apply   # Apply changes
```

## Testing Structure

```
__tests__/          # Unit tests
e2e/                # End-to-end tests
*.test.ts           # Co-located tests
```

Testing tools:

- **Unit**: Vitest + React Testing Library
- **E2E**: Playwright
- **Accessibility**: axe-core
- **Coverage**: 90%+ target

## Learn More

- [Technology Stack](./TECHNOLOGY_STACK.md)
- [Git Subtree Setup](./GIT_SUBTREE.md)
- [Quick Start Guide](../getting-started/QUICK_START.md)
