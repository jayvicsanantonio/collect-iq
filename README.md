# CollectIQ

**AI-powered trading card intelligence — real-time valuation, authenticity detection, and collector trust at scale**

---

## Overview

CollectIQ is an enterprise-grade AI platform that transforms how collectors interact with the $400+ billion trading card and collectibles market. Using AWS-native multi-agent orchestration, computer vision, and large language models, CollectIQ delivers real-time market intelligence, authenticity verification, and portfolio management for Pokémon TCG cards.

### The Problem

The trading card market is plagued by information asymmetry, counterfeit risk, and fragmented pricing data. With over 75 billion Pokémon cards in circulation and an estimated market value exceeding $14 billion, collectors need automation to handle:

- **Authenticity verification** — Fake cards are widespread, especially for high-value editions
- **Real-time valuation** — Prices fluctuate across eBay, TCGPlayer, and PriceCharting with no unified view
- **Collection management** — No integrated system for vaulting, tracking, and revaluing holdings
- **Trust gaps** — Expensive grading services (PSA, CGC) are inaccessible to casual collectors

### The Solution

CollectIQ addresses these challenges through:

1. **Multi-agent AI orchestration** — Specialized agents for ingestion, valuation, authenticity, and feedback
2. **Computer vision pipeline** — Amazon Rekognition extracts visual features; perceptual hashing detects counterfeits
3. **Explainable reasoning** — Amazon Bedrock synthesizes signals into human-readable confidence scores
4. **Real-time data fusion** — Live pricing from multiple marketplaces with normalization and failover
5. **Secure vault management** — User-scoped storage with JWT authentication and audit trails

---

## Market Opportunity

### Market Size

- **Collectibles market**: $294B (2023) → $422B (2030) at 5.5% CAGR
- **Trading card games**: $7.43B (2024) → $15.84B (2034) at 7.86% CAGR
- **Authentication services**: $2.24B (2024) → $6.61B (2033) at 13.1% CAGR
- **Pokémon cards**: 3,821% cumulative return since 2004 vs S&P 500's 483%

### Market Signals

- Walmart reported trading card sales up 200% (Feb 2024 → Jun 2025)
- Pokémon card sales grew 10x year-over-year at major retailers
- Pokémon TCG Pocket surpassed 100M downloads in February 2025
- Active communities: r/PokemonTCG, r/PokeInvesting with millions of members

### Competitive Advantage

| Competitor            | Limitation                                                |
| --------------------- | --------------------------------------------------------- |
| MonPrice              | No authenticity scoring; struggles with holographic cards |
| Dragon Shield Scanner | No AI-driven fraud detection                              |
| Ludex                 | Broad scope; lacks Pokémon-specific domain depth          |
| Cardbase              | Limited authenticity; basic valuation                     |
| Legit App             | Slow, premium service; no instant consumer tool           |

**CollectIQ differentiators**: Multi-agent orchestration, explainable AI scoring, real-time multi-source pricing, AWS-native scalability, transparent component signal persistence.

---

## Architecture

### High-Level Design

CollectIQ implements an authentication-first, event-driven serverless architecture on AWS:

```
┌─────────────┐
│   Client    │  Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
│  (Next.js)  │  OAuth 2.0 with PKCE via Cognito Hosted UI
└──────┬──────┘
       │ HTTPS + JWT
       ▼
┌──────────────────────────────────────────────┐
│      Amazon API Gateway (HTTP API)           │  JWT Authorizer validates Cognito tokens
│           + JWT Authorizer (Cognito)         │  Routes to Lambda handlers
└──────┬───────────────────────────────────────┘
       │
       ├─────► Lambda: upload_presign (S3 presigned URLs)
       ├─────► Lambda: cards_create (DynamoDB + Step Functions trigger)
       ├─────► Lambda: cards_list (user-scoped queries)
       ├─────► Lambda: cards_get (valuation + authenticity results)
       └─────► Lambda: cards_delete (soft delete with audit)
              │
              ▼
       ┌──────────────────────────────────────┐
       │   AWS Step Functions Workflow        │  Orchestrates multi-agent pipeline
       │                                      │
       │  ┌────────────────────────────────┐ │
       │  │  Task 1: RekognitionExtract    │ │  Visual feature extraction
       │  │  (Lambda → Rekognition)        │ │  OCR, holo patterns, borders
       │  └────────────┬───────────────────┘ │
       │               │ FeatureEnvelope     │
       │               ▼                     │
       │  ┌────────────────────────────────┐ │
       │  │    Parallel Execution          │ │  Concurrent agent invocation
       │  │  ┌──────────┐  ┌─────────────┐ │ │
       │  │  │ Pricing  │  │Authenticity │ │ │  Bedrock reasoning
       │  │  │  Agent   │  │   Agent     │ │ │  Market analysis
       │  │  │(Bedrock) │  │  (Bedrock)  │ │ │  Fake detection
       │  │  └──────────┘  └─────────────┘ │ │
       │  └────────────┬───────────────────┘ │
       │               │                     │
       │               ▼                     │
       │  ┌────────────────────────────────┐ │
       │  │  Task 3: Aggregator            │ │  Merge results
       │  │  (Merge + Persist)             │ │  Persist to DynamoDB
       │  └────────────────────────────────┘ │  Emit EventBridge events
       └──────────────┬───────────────────────┘
                      │
                      ├─────► DynamoDB (single-table design, user-scoped)
                      └─────► EventBridge (event-driven coordination)

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   S3 Bucket  │    │   DynamoDB   │    │   Secrets    │
│   (uploads)  │    │ (single-table)│    │   Manager    │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Multi-Agent Orchestration

CollectIQ implements AWS Multi-Agent Orchestration best practices with four specialized agents:

1. **Ingestion Agent** — Fetches live pricing from eBay, TCGPlayer, PriceCharting APIs with rate limiting and exponential backoff
2. **Valuation Agent** — Computes fair market value, confidence scores, and volatility metrics using Bedrock reasoning
3. **Authenticity Agent** — Detects fake/altered cards via perceptual hashing, holographic analysis, and font validation
4. **Feedback Agent** — Processes user corrections to refine models and enhance reference datasets

Agents operate asynchronously through AWS Step Functions with automatic retries, error handling, and dead-letter queues.

### Data Architecture

**Single-table DynamoDB design** with user-scoped partitions:

- `PK: USER#{sub}` — Cognito user ID ensures data isolation
- `SK: CARD#{cardId}` — Individual card records
- `SK: PRICE#{ISO8601}` — Time-series pricing data

Global Secondary Indexes:

- `GSI1`: userId (for vault queries)
- `GSI2`: set#rarity (for analytics)

**S3 uploads** scoped to `uploads/{sub}/{uuid}` with presigned URLs expiring in 60 seconds.

---

## Key Features

### Real-Time Market Intelligence

- Multi-source pricing aggregation from eBay, TCGPlayer, PriceCharting
- Normalization layer harmonizes condition metadata and outlier detection
- Time-windowed caching minimizes API overhead
- Confidence scoring based on comparable sales volume and recency

### Authenticity Detection

**Visual Fingerprinting**:

- Perceptual hashing (pHash) compared against reference authentic cards
- Holographic pattern analysis using pixel variance and RGB scatter
- Border ratio and logo alignment validation

**Text & Font Validation**:

- OCR extraction via Amazon Rekognition
- Font family and kerning validation against known authentic samples
- Linguistic anomaly detection (mistranslations, inconsistent terminology)

**AI Judgment**:

- Amazon Bedrock synthesizes visual and textual signals
- Explainable authenticity scores (0.0 = likely fake, 1.0 = likely authentic)
- Human-readable rationale for transparency

### Security & Compliance

- **Authentication**: Amazon Cognito with OAuth 2.0 + PKCE
- **Authorization**: JWT validation on every API request
- **Data encryption**: KMS at rest, TLS 1.3 in transit
- **Token storage**: HTTP-only cookies (never localStorage)
- **IAM roles**: Least-privilege principle with resource-based policies
- **Audit trails**: Structured logging with requestId and userId
- **Error handling**: RFC 7807 Problem Details for consistent API responses

---

## Technology Stack

### Frontend

- **Framework**: Next.js 14 with App Router (React 18)
- **Language**: TypeScript (non-strict mode)
- **Styling**: Tailwind CSS v4 with @theme directive
- **Components**: shadcn/ui built on Radix UI primitives
- **Data fetching**: SWR for client-side caching
- **Validation**: Zod schemas for runtime type safety
- **Testing**: Vitest + React Testing Library + Playwright + axe-core

### Backend

- **Compute**: AWS Lambda (Node.js 20)
- **Orchestration**: AWS Step Functions + EventBridge
- **AI/ML**: Amazon Bedrock (Claude 4.0 Sonnet) + Amazon Rekognition
- **Database**: Amazon DynamoDB (single-table design)
- **Storage**: Amazon S3 with presigned URLs
- **Authentication**: Amazon Cognito with Hosted UI
- **API**: Amazon API Gateway (HTTP API) with JWT authorizer

### Infrastructure

- **IaC**: Terraform (modular design)
- **CI/CD**: GitHub Actions + AWS Amplify
- **Monitoring**: Amazon CloudWatch + X-Ray
- **Secrets**: AWS Secrets Manager with automatic rotation
- **Cost management**: Budgets + usage alarms

### Code Quality

- **Linting**: ESLint v9 (flat config) + Prettier
- **Type checking**: TypeScript 5.x
- **Testing**: 90%+ code coverage target
- **Security**: Automated dependency scanning
- **Performance**: Lighthouse CI with Web Vitals targets (LCP < 2.5s, CLS < 0.1, INP < 200ms)

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- AWS account with appropriate permissions
- Terraform 1.5+ (for infrastructure provisioning)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/collect-iq.git
cd collect-iq

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env
cp .env.example apps/web/.env.local

# Fill in required AWS credentials:
# - Cognito User Pool ID, Client ID, Domain
# - DynamoDB table name
# - S3 bucket for uploads
# - Bedrock model ID
# - AWS region
```

### Development

```bash
# Start Next.js development server
pnpm web:dev

# Run linting
pnpm lint

# Type-check the codebase
pnpm typecheck

# Build for production
pnpm web:build

# Start production server
pnpm web:start
```

### Infrastructure Deployment

```bash
# Navigate to infrastructure
cd infra/terraform

# Initialize Terraform
terraform init

# Review planned changes
terraform plan

# Apply infrastructure
terraform apply
```

---

## Project Structure

```
collect-iq/
├── apps/
│   └── web/                 # Next.js 14 frontend application
│       ├── app/
│       │   ├── (public)/    # Unauthenticated routes (auth callback, landing)
│       │   ├── (protected)/ # JWT-protected routes (upload, vault, cards)
│       │   └── api/         # API route handlers
│       ├── components/      # React components (auth, cards, upload, vault, ui)
│       └── lib/             # API client, auth helpers, schemas, utilities
├── services/
│   └── backend/             # AWS Lambda + Step Functions backend (TypeScript)
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
│   ├── shared/              # Shared types/schemas
│   ├── config/              # Shared build/lint/test configuration
│   └── telemetry/           # Logging/metrics utilities
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
├── docs/                    # Comprehensive project specifications
│   ├── Frontend/            # UI flows, wireframes, component specs
│   ├── Backend/             # API contracts, Lambda handlers, data models
│   ├── DevOps/              # Terraform modules, CI/CD, cost optimization
│   └── Project Specification.md
├── .kiro/specs/             # Granular requirements, design, and tasks
├── WARP.md                  # Developer guide for Warp AI terminal
├── AGENTS.md                # Repository coding standards and guidelines
└── README.md                # This file
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

---

## Performance & Scalability

### Performance Targets

- **Largest Contentful Paint (LCP)**: < 2.5 seconds
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Interaction to Next Paint (INP)**: < 200ms
- **API latency**: < 3 seconds for full valuation + authenticity workflow
- **Authenticity accuracy**: ≥ 90% on validated samples

### Scalability

- **Serverless architecture** auto-scales with demand
- **DynamoDB on-demand** capacity adjusts to traffic
- **Lambda concurrency** scales to thousands of concurrent executions
- **Step Functions** orchestrates up to 25,000 concurrent workflows
- **Multi-region ready** for global deployment

### Cost Efficiency

**MVP scale** (~10K users, 50K images/month):

- S3 storage: < $5
- Lambda invocations: $15-30
- Step Functions: < $10
- Rekognition API: ~$50
- Bedrock inference: ~$100
- DynamoDB + CloudWatch + Amplify: ~$60

**Total**: $250-300/month MVP → $1-2K/month at moderate adoption

---

## Documentation

Comprehensive specifications available in `/docs` and `.kiro/specs`:

- **Project Specification** — System design, architecture, data models
- **Frontend Specification** — UI flows, component specs, accessibility
- **Backend Specification** — API contracts, Lambda handlers, DynamoDB schema
- **DevOps Specification** — Terraform modules, CI/CD, monitoring
- **Market Opportunity** — Industry analysis, competitive landscape, metrics
- **Product Requirements** — Hackathon and Venture editions

---

## Contributing

For development guidelines, coding standards, and architecture decisions:

1. Read `WARP.md` for comprehensive developer guidance
2. Review `AGENTS.md` for repository conventions
3. Consult `.kiro/specs/` for granular requirements
4. Follow TypeScript non-strict mode conventions
5. Ensure `pnpm lint` and `pnpm typecheck` pass before committing
6. Include tests for new features (Vitest + React Testing Library)
7. Update `.env.example` when adding new environment variables

---

## License

This project is proprietary and confidential.

---

## Contact

For questions, partnerships, or investment inquiries, please contact the CollectIQ team.
