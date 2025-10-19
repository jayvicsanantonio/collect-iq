# CollectIQ — Full Project Structure

This document defines the **complete, production-ready monorepo structure** for the CollectIQ project — an AI-powered trading card intelligence platform.  
It is designed to optimize for **AWS serverless architecture**, **developer velocity**, **shared types across frontend and backend**, and **scalability**.

---

## 🏗️ Overview

CollectIQ follows a **mono-repo structure** managed by **pnpm** and **Turborepo**, integrating all components — frontend, backend, infrastructure, and shared libraries — into one cohesive system.

### Major Directories

| Directory   | Purpose                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| `apps/`     | Contains user-facing applications (e.g., Next.js frontend).              |
| `services/` | Contains backend microservices, AWS Lambdas, Step Functions, and agents. |
| `packages/` | Shared code libraries (types, schemas, utilities, configs).              |
| `infra/`    | Terraform IaC modules, environment configs, and AWS resources.           |
| `docs/`     | Project documentation, specifications, and diagrams.                     |
| `scripts/`  | Developer tools, local mocks, and automation scripts.                    |
| `.github/`  | GitHub Actions workflows for CI/CD.                                      |

---

## 📂 Folder-by-Folder Breakdown

### **Root Directory**

```
collect-iq/
│
├── apps/
├── services/
├── packages/
├── infra/
├── docs/
├── scripts/
├── .github/
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── package.json
└── .env.example
```

**Purpose:**  
The root holds workspace configurations and orchestrates builds, testing, and deployments across all subprojects.

---

### **apps/**

Contains user-facing applications. Currently includes the Next.js frontend hosted on **AWS Amplify**.

```
apps/
└── web/
    ├── app/
    │   ├── auth/
    │   ├── upload/
    │   ├── vault/
    │   ├── cards/[id]/
    │   ├── api/
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── auth/
    │   ├── cards/
    │   └── ui/
    ├── lib/
    │   ├── api.ts
    │   ├── schemas.ts
    │   ├── auth.ts
    │   ├── format.ts
    │   ├── guards.tsx
    │   └── utils.ts
    ├── styles/
    ├── tests/
    ├── e2e/
    ├── public/
    └── package.json
```

**Frontend Stack:**

- Next.js 14 (App Router)
- Tailwind CSS + shadcn/ui
- TypeScript (not strict)
- AWS Cognito's Hosted UI for authentication
- SWR for data fetching
- Vitest + Playwright for testing

**Responsibilities:**

- Authentication-first UX
- Image uploads via presigned URLs
- Real-time valuation and authenticity UI
- Vault management and analytics dashboard

---

### **services/**

Contains backend services implemented as **AWS Lambda functions** in **TypeScript**, orchestrated by **Step Functions**.

```
services/
└── backend/
    ├── src/
    │   ├── handlers/                # API Gateway handlers
    │   │   ├── upload_presign.ts
    │   │   ├── cards_create.ts
    │   │   ├── cards_list.ts
    │   │   ├── cards_get.ts
    │   │   ├── cards_delete.ts
    │   │   └── cards_revalue.ts
    │   │
    │   ├── agents/                  # Multi-agent Lambdas
    │   │   ├── pricing_agent.ts
    │   │   ├── authenticity_agent.ts
    │   │   └── aggregator.ts
    │   │
    │   ├── orchestration/           # Step Functions ASL (JSON definitions)
    │   │   ├── revalue.asl.json
    │   │   └── orchestrator.ts
    │   │
    │   ├── adapters/                # External API integrations
    │   │   ├── rekognition.ts
    │   │   ├── bedrock.ts
    │   │   └── pricing/
    │   │       ├── ebay.ts
    │   │       ├── tcgplayer.ts
    │   │       └── pricecharting.ts
    │   │
    │   ├── store/                   # DynamoDB data access
    │   │   ├── ddb.ts
    │   │   ├── queries.ts
    │   │   └── models.ts
    │   │
    │   ├── auth/
    │   │   └── jwt.ts
    │   │
    │   ├── utils/
    │   │   ├── problem.ts
    │   │   ├── log.ts
    │   │   ├── tracing.ts
    │   │   └── constants.ts
    │   │
    │   ├── tests/
    │   │   ├── unit/
    │   │   ├── integration/
    │   │   └── e2e/
    │   │
    │   └── index.ts
    │
    ├── esbuild.mjs
    ├── vitest.config.ts
    ├── tsconfig.json
    └── package.json
```

**Backend Stack:**

- AWS Lambda (Node.js 20, TypeScript)
- Amazon API Gateway (HTTP API + JWT authorizer)
- Amazon Step Functions (Express workflow)
- DynamoDB (single-table design)
- S3 for uploads
- Rekognition + Bedrock for AI inference
- EventBridge for event-driven workflows

**Key Design Patterns:**

- Thin handlers → domain logic → adapters
- RFC 7807 ProblemDetails for error modeling
- Zod validation at the edge
- Structured logging (JSON + X-Ray traces)

---

### **packages/**

Reusable TypeScript packages shared across frontend and backend.

```
packages/
├── shared/              # Shared types and schemas
│   ├── src/
│   │   ├── schemas/
│   │   │   ├── card.ts
│   │   │   ├── valuation.ts
│   │   │   ├── authenticity.ts
│   │   │   └── featureEnvelope.ts
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── config/              # Shared build/lint/test configuration
│   ├── eslint/
│   ├── prettier/
│   ├── vitest/
│   ├── tsconfig/
│   └── index.ts
│
└── telemetry/           # Logging and monitoring utilities
    ├── src/
    │   ├── log.ts
    │   ├── trace.ts
    │   ├── metrics.ts
    │   └── index.ts
    └── package.json
```

**Purpose:**

- Maintain a single source of truth for schemas and types.
- Share config across packages for consistent tooling.
- Centralize telemetry for observability.

---

### **infra/**

Terraform Infrastructure-as-Code configuration for AWS resources.

```
infra/
└── terraform/
    ├── modules/
    │   ├── amplify_hosting/
    │   ├── api_gateway_http/
    │   ├── cognito_user_pool/
    │   ├── s3_uploads/
    │   ├── dynamodb_collectiq/
    │   ├── lambda_fn/
    │   ├── step_functions/
    │   ├── eventbridge_bus/
    │   ├── rekognition_access/
    │   ├── bedrock_access/
    │   ├── cloudwatch_dashboards/
    │   ├── ssm_secrets/
    │   └── xray/
    │
    ├── envs/
    │   ├── dev/
    │   │   └── terraform.tfvars
    │   └── prod/
    │       └── terraform.tfvars
    │
    └── Makefile
```

**Managed Services:**

- Cognito (User Pool + Hosted UI)
- API Gateway (HTTP API)
- Lambda (Handlers, Agents, Orchestrators)
- Step Functions (State machines)
- DynamoDB (Single-table schema)
- S3 (Uploads + Presigns)
- EventBridge (Domain events)
- CloudWatch + X-Ray (Observability)
- Secrets Manager (API keys, tokens)
- Amplify Hosting (Next.js frontend)

---

### **scripts/**

Developer automation and mock utilities.

```
scripts/
├── seed-dev-data.ts
├── local-mock-bedrock.ts
├── local-mock-rekognition.ts
├── smoke-test.ts
└── cleanup.ts
```

**Purpose:**

- Seed DynamoDB or S3 buckets locally.
- Mock AWS AI services for local testing.
- Run smoke tests pre-deployment.

---

### **.github/**

CI/CD pipelines managed via GitHub Actions.

```
.github/
└── workflows/
    ├── ci-web.yml              # Lint + build + test frontend
    ├── ci-backend.yml          # Build + package + deploy backend
    ├── ci-infra.yml            # Terraform validate/plan/apply (with approvals)
    ├── smoke-test.yml          # E2E validation after deploy
    └── notify-slack.yml        # Optional notifications
```

**CI/CD Flow:**

1. Run lint/typecheck/test on PRs.
2. Build and deploy backend via Terraform.
3. Deploy Amplify frontend automatically.
4. Smoke tests verify end-to-end flow.

---

### **docs/**

Project specifications, architectural diagrams, and runbooks.

```
docs/
├── architecture-diagram.pdf
├── api-contracts.md
├── data-model.md
├── test-plan.md
├── runbook.md
├── cost-model.md
└── README.md
```

---

## 🧩 Configuration Files

### **pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'services/*'
  - 'packages/*'
  - 'infra/*'
```

### **turbo.json**

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

### **tsconfig.base.json**

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

## ✅ Benefits of This Structure

- **Monorepo Velocity**: All code, tests, and IaC in one workspace.
- **Type-Safe End-to-End**: Shared schemas ensure frontend and backend never drift.
- **Optimized for AWS Serverless**: Each Lambda function isolated, with its own IAM, logs, and deployment plan.
- **Future-Proof**: Scales easily to multi-region or multi-service architecture.
- **Hackathon to Venture Ready**: Rapid iteration now, clean promotion path later.

---

## 🧭 Recommended Next Steps

1. Initialize repository using this structure.
2. Bootstrap shared packages (`pnpm install && pnpm build`).
3. Implement backend handlers and Step Functions first (core flow).
4. Integrate frontend with real AWS endpoints.
5. Configure Terraform backend and deploy infrastructure.
6. Run smoke tests end-to-end.

---

**Document Version:** 1.0  
**Last Updated:** October 14, 2025  
**Author:** CollectIQ Engineering Team
