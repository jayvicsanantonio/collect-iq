# Backend Agents Documentation

Complete documentation for all AI agents in the CollectIQ backend multi-agent system.

## Agent Architecture

CollectIQ uses a multi-agent architecture orchestrated by AWS Step Functions, where specialized agents handle different aspects of card analysis:

```
Step Functions Orchestrator
├── Rekognition Extract → Feature extraction from images
├── OCR Reasoning Agent → Interpret OCR results with AI
├── Pricing Agent → Market valuation analysis
├── Authenticity Agent → Fake detection analysis
└── Aggregator → Combine and persist results
```

## Agent Documentation

### Core Agents

- [Rekognition Extract](./Rekognition-Extract.md) - Image feature extraction using AWS Rekognition
- [OCR Reasoning Agent](./OCR-Reasoning-Agent.md) - AI-powered OCR interpretation with Bedrock
- [Pricing Agent](./Pricing-Agent.md) - Multi-source pricing analysis and valuation
- [Authenticity Agent](./Authenticity-Agent.md) - Fake card detection using visual analysis
- [Aggregator Agent](./Aggregator-Agent.md) - Result aggregation and persistence

### Workflow Documentation

- [OCR Agent Flow](./OCR-Agent-Flow.md) - Complete OCR processing workflow

## Agent Responsibilities

### Rekognition Extract

**Purpose**: Extract visual features from card images  
**Input**: S3 image keys  
**Output**: Feature envelope with OCR, labels, and visual metrics  
**Technologies**: AWS Rekognition, Sharp (image processing)

### OCR Reasoning Agent

**Purpose**: Interpret raw OCR text to extract structured card metadata  
**Input**: OCR blocks and visual context  
**Output**: Card metadata (name, set, rarity, etc.) with confidence scores  
**Technologies**: Amazon Bedrock (Claude 3.5 Sonnet)

### Pricing Agent

**Purpose**: Determine fair market value using multiple data sources  
**Input**: Card metadata and condition  
**Output**: Pricing result with valuation summary  
**Technologies**: eBay API, TCGPlayer API, PriceCharting API, Amazon Bedrock

### Authenticity Agent

**Purpose**: Detect counterfeit cards using visual analysis  
**Input**: Feature envelope and card metadata  
**Output**: Authenticity score and detection signals  
**Technologies**: Perceptual hashing, Amazon Bedrock, visual analysis

### Aggregator

**Purpose**: Combine agent results and persist to database  
**Input**: Results from all agents  
**Output**: Complete card record in DynamoDB  
**Technologies**: DynamoDB, EventBridge

## Agent Communication

Agents communicate through:

1. **Step Functions** - Orchestration and data flow
2. **DynamoDB** - Shared state and results
3. **EventBridge** - Domain events (CardCreated, CardUpdated)
4. **S3** - Image storage and access

## Error Handling

Each agent implements:

- **Retry logic** - Automatic retries with exponential backoff
- **Fallback strategies** - Graceful degradation when services unavailable
- **Error propagation** - Structured error responses to Step Functions
- **Logging** - CloudWatch logs with request IDs for tracing

## Performance

Typical execution times:

- Rekognition Extract: 2-5 seconds
- OCR Reasoning Agent: 1-3 seconds
- Pricing Agent: 3-8 seconds (parallel API calls)
- Authenticity Agent: 2-4 seconds
- Aggregator: 1-2 seconds

**Total workflow**: 15-25 seconds end-to-end

## Development

### Testing Agents Locally

```bash
cd services/backend

# Run unit tests
pnpm test

# Run specific agent tests
pnpm test pricing-agent
pnpm test authenticity-agent

# Run E2E tests
pnpm test:e2e
```

### Deploying Agents

```bash
# Build all agents
pnpm build

# Deploy to AWS
pnpm deploy

# Deploy specific agent
pnpm deploy:pricing-agent
```

## Related Documentation

- [Backend Workflows](../workflows/) - Complete workflow documentation
- [Step Functions](../../infrastructure/workflows/STEP_FUNCTIONS_WORKFLOW.md) - Orchestration details
- [API Endpoints](../development/API_ENDPOINTS.md) - API that triggers agents
- [Architecture](../architecture/ADAPTERS.md) - External service integrations

## Navigation

- [← Back to Backend Documentation](../README.md)
- [← Back to Main Documentation](../../README.md)

---

**Last Updated**: October 22, 2025
