# CollectIQ Project Overview

CollectIQ is an AI-powered trading card intelligence platform for Pokémon TCG collectors. It provides real-time market valuation, authenticity verification, and secure portfolio management.

## Core Features

### 🎯 Real-Time Valuation

Multi-source pricing aggregation from eBay, TCGPlayer, and PriceCharting with confidence scoring. Get accurate market valuations for your cards instantly.

### 🔍 Authenticity Detection

AI-driven fake card detection using computer vision, perceptual hashing, and holographic pattern analysis. Protect yourself from counterfeit cards.

### 🔐 Secure Vault

User-scoped collection management with JWT authentication. Your collection is private and secure.

### 🤖 Multi-Agent AI

Specialized agents for ingestion, valuation, authenticity, and feedback orchestrated via AWS Step Functions for reliable processing.

## Market Context

- **Target Market**: $400+ billion collectibles market, $14+ billion Pokémon TCG segment
- **Problem**: Information asymmetry, counterfeit risk, fragmented pricing data
- **Competitive Edge**: Multi-agent orchestration, explainable AI scoring, AWS-native scalability

## User Flow

1. **Authenticate** - User authenticates via Amazon Cognito (OAuth 2.0 + PKCE)
2. **Upload** - Uploads card image (camera or file) to S3 via presigned URL
3. **Process** - AI pipeline extracts features (Rekognition), computes valuation and authenticity (Bedrock)
4. **Review** - Results displayed with confidence scores and human-readable rationale
5. **Store** - Cards stored in user's vault with time-series pricing data

## Technology Stack

### Frontend

- **Framework**: Next.js 14 with App Router (React 18)
- **Styling**: Tailwind CSS v4 with `@theme` directive
- **UI Components**: shadcn/ui (built on Radix UI primitives)
- **Data Fetching**: SWR for client-side caching
- **Authentication**: AWS Amplify + Amazon Cognito

### Backend

- **Compute**: AWS Lambda (Node.js 20)
- **Orchestration**: AWS Step Functions + EventBridge
- **AI/ML**: Amazon Bedrock (Claude 4.0 Sonnet) + Amazon Rekognition
- **Database**: Amazon DynamoDB (single-table design)
- **Storage**: Amazon S3 with presigned URLs
- **API**: Amazon API Gateway (HTTP API) with JWT authorizer

### Infrastructure

- **IaC**: Terraform (modular design)
- **CI/CD**: GitHub Actions + AWS Amplify
- **Monitoring**: Amazon CloudWatch + X-Ray

## Architecture Overview

```
User → Next.js Frontend → API Gateway (JWT validation)
  → Lambda Handler → Step Functions Orchestration
    → Rekognition (feature extraction)
    → Bedrock Agents (valuation + authenticity)
    → DynamoDB (persistence)
  → EventBridge (event coordination)
```

## Key Differentiators

1. **Explainable AI**: Detailed breakdown of authenticity scores with visual indicators
2. **Multi-Source Pricing**: Aggregated data from multiple marketplaces
3. **Real-Time Updates**: Live pricing data and valuation history
4. **Secure & Private**: User-scoped data with JWT authentication
5. **Mobile-First**: Optimized for mobile camera capture and on-the-go usage

## Development Approach

CollectIQ follows a **spec-driven development** methodology:

1. **Requirements** - Clear user stories with acceptance criteria
2. **Design** - Detailed technical design documents
3. **Tasks** - Granular implementation tasks
4. **Implementation** - Incremental development with testing

All specifications are maintained in `.kiro/specs/` for traceability.

## Getting Started

Ready to dive in? Check out the [Quick Start Guide](./QUICK_START.md) to get your development environment set up.

## Learn More

- [Project Structure](../architecture/PROJECT_STRUCTURE.md)
- [Technology Stack](../architecture/TECHNOLOGY_STACK.md)
- [Authentication Guide](../development/AUTHENTICATION.md)
- [Design System](../development/DESIGN_SYSTEM.md)
