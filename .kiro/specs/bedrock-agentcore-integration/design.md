# Design Document: Amazon Bedrock AgentCore Integration Analysis

## Overview

This document provides a comprehensive design analysis for integrating Amazon Bedrock AgentCore into the CollectIQ platform. Based on research from AWS documentation and sample implementations, this design evaluates how AgentCore's three core primitives—Runtime, Gateway, and Memory—can enhance CollectIQ's existing multi-agent architecture.

The analysis focuses on identifying optimal use cases, architectural patterns, migration strategies, and cost-benefit trade-offs specific to CollectIQ's requirements for real-time card valuation, authenticity detection, and secure vault management.

## Architecture

### Current CollectIQ Architecture

CollectIQ currently implements a serverless multi-agent system using:

- **Frontend**: Next.js 14 on AWS Amplify
- **API Layer**: API Gateway with Cognito JWT authorizer
- **Agent Orchestration**: AWS Step Functions coordinating Lambda-based agents
- **Agents**: TypeScript Lambda functions (Pricing, Authenticity, OCR Reasoning)
- **AI Services**: Amazon Bedrock (Claude 3.5 Sonnet), Amazon Rekognition
- **Data Layer**: DynamoDB (single-table design), S3 (image storage)
- **Event Bus**: EventBridge for domain events

### AgentCore Architecture Primitives

Amazon Bedrock AgentCore provides three managed services:

1. **AgentCore Runtime**: Managed execution environment for containerized agents
2. **AgentCore Gateway**: MCP-compatible tool registry and agent communication hub
3. **AgentCore Memory**: Managed short-term and long-term memory with automatic context extraction

### Proposed Hybrid Architecture

The optimal integration strategy combines AgentCore capabilities with existing infrastructure:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│                    AWS Amplify + Cognito Auth                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  API Gateway (JWT Authorizer)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Step Functions Orchestrator                   │
│                  (Hybrid: Lambda + AgentCore)                    │
└─────┬───────────────────────┬───────────────────────────────────┘
      │                       │
      ▼                       ▼
┌─────────────────┐   ┌──────────────────────────────────────────┐
│ Lambda Agents   │   │    AgentCore Runtime Agents              │
│ (TypeScript)    │   │    (Containerized Python/TypeScript)     │
│                 │   │                                          │
│ • Rekognition   │   │ • Orchestrator Agent (Supervisor)        │
│   Handler       │   │ • Enhanced Pricing Agent (with Memory)   │
│ • DynamoDB      │   │ • Research Agent (with Browser Tool)     │
│   Operations    │   │                                          │
└─────────────────┘   └──────────────────────────────────────────┘
                                     │
                                     ▼
                      ┌──────────────────────────────┐
                      │   AgentCore Gateway (MCP)    │
                      │                              │
                      │ Tools:                       │
                      │ • Pricing APIs (eBay, TCG)   │
                      │ • Rekognition OCR            │
                      │ • DynamoDB Queries           │
                      │ • Browser Tool               │
                      │ • Agent Invocation           │
                      └──────────────────────────────┘
                                     │
                                     ▼
                      ┌──────────────────────────────┐
                      │   AgentCore Memory           │
                      │                              │
                      │ • User Preferences           │
                      │ • Card History               │
                      │ • Pricing Trends             │
                      │ • Conversation Context       │
                      └──────────────────────────────┘
```

## Components and Interfaces

### 1. AgentCore Runtime Deployment

#### Orchestrator Agent (Supervisor Pattern)

**Purpose**: Coordinate specialized agents using dynamic routing and context-aware decision making

**Framework**: LangGraph (Python) - best suited for stateful multi-agent workflows

**Deployment**:

```python
# orchestrator_agent.py
from langgraph.graph import StateGraph, MessagesState
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands.tools.mcp import MCPClient

app = BedrockAgentCoreApp()

@tool
def invoke_pricing_agent(card_metadata: dict) -> dict:
    """Invoke specialized pricing agent via AgentCore Gateway"""
    # Call pricing agent through Gateway MCP interface
    pass

@tool
def invoke_authenticity_agent(features: dict) -> dict:
    """Invoke specialized authenticity agent via AgentCore Gateway"""
    pass

@app.entrypoint
async def orchestrate(payload):
    """Main orchestration logic with dynamic routing"""
    user_query = payload.get("prompt")
    card_data = payload.get("cardData")

    # Use LangGraph to build stateful workflow
    # Route to appropriate agents based on context
    pass
```

**Benefits over Step Functions**:

- Dynamic routing based on AI reasoning (not predefined state machine)
- Shared context via AgentCore Memory
- Easier debugging with conversational logs
- Agent-to-agent communication via Gateway tools

#### Enhanced Pricing Agent with Memory

**Purpose**: Provide personalized pricing recommendations based on user history and preferences

**Framework**: Strands (Python) - lightweight, Bedrock-native

**Key Enhancement**: AgentCore Memory integration for user context

```python
# pricing_agent_with_memory.py
from strands import Agent
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from bedrock_agentcore.memory import MemoryClient

app = BedrockAgentCoreApp()
memory_client = MemoryClient(region_name="us-west-2")

# Custom memory strategy for collector preferences
COLLECTOR_PREFERENCE_PROMPT = """
Extract the user's collecting preferences from conversations:
- Preferred card sets (Base Set, Jungle, Fossil, etc.)
- Budget range for purchases
- Condition preferences (PSA graded, raw, etc.)
- Investment vs. nostalgia focus
"""

@app.entrypoint
def price_with_context(payload):
    user_id = payload.get("userId")
    card_data = payload.get("cardData")

    # Retrieve user preferences from AgentCore Memory
    preferences = memory_client.query_memory(
        memory_id=MEMORY_ID,
        actor_id=user_id,
        namespace=f"/users/{user_id}/preferences"
    )

    # Invoke pricing agent with personalized context
    agent = Agent(
        model=BedrockModel(model_id="us.anthropic.claude-3-7-sonnet-20250219-v1:0"),
        system_prompt=f"You are a pricing analyst. User preferences: {preferences}",
        tools=[fetch_ebay_comps, fetch_tcgplayer_comps]
    )

    result = agent(f"Value this card: {card_data}")

    # Store interaction in memory for future context
    memory_client.create_event(
        memory_id=MEMORY_ID,
        actor_id=user_id,
        session_id=payload.get("sessionId"),
        messages=[
            (f"Value card: {card_data['name']}", "USER"),
            (result.message["content"], "ASSISTANT")
        ]
    )

    return result
```

**Benefits**:

- Personalized recommendations based on collector profile
- Reduced DynamoDB queries for user context
- Automatic preference extraction via AI
- Conversation continuity across sessions

#### Research Agent with Browser Tool

**Purpose**: Supplement API-based pricing with real-time web research for rare cards and market trends

**Framework**: Strands with AgentCore Browser Tool

**Use Cases**:

- Research cards not covered by eBay/TCGPlayer APIs
- Monitor auction sites for emerging trends
- Verify authenticity against community databases
- Gather grading standards from PSA/CGC websites

```python
# research_agent.py
from strands import Agent
from strands.models import BedrockModel
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands.tools.browser import BrowserTool

app = BedrockAgentCoreApp()

# Configure Browser Tool with session recording
browser_tool = BrowserTool(
    browser_arn="arn:aws:bedrock:us-east-1:123456789012:agent-browser/br-xxx",
    recording_enabled=True,
    s3_bucket="collectiq-browser-sessions"
)

@app.entrypoint
def research_card(payload):
    card_name = payload.get("cardName")
    card_set = payload.get("set")

    agent = Agent(
        model=BedrockModel(model_id="us.anthropic.claude-3-7-sonnet-20250219-v1:0"),
        system_prompt="""You are a TCG market researcher. Use the browser to:
        1. Search for recent sales on auction sites
        2. Check community forums for authenticity discussions
        3. Verify grading standards from official sources
        """,
        tools=[browser_tool]
    )

    result = agent(f"Research market data for {card_name} from {card_set}")
    return result
```

**Benefits**:

- Access to data not available via APIs
- Fallback when API rate limits are hit
- Real-time market intelligence
- Audit trail via session recording

### 2. AgentCore Gateway Tool Registry

#### Tool Architecture

The Gateway exposes existing Lambda functions and external APIs as MCP-compatible tools:

**Tool Categories**:

1. **Pricing Tools**
   - `fetch_ebay_comps`: Query eBay API for recent sales
   - `fetch_tcgplayer_comps`: Query TCGPlayer API for market prices
   - `fetch_pricecharting_comps`: Query PriceCharting API for historical data
   - `aggregate_pricing`: Combine and normalize pricing from multiple sources

2. **Vision Tools**
   - `extract_card_features`: Invoke Rekognition for OCR and visual analysis
   - `compute_perceptual_hash`: Generate pHash for authenticity comparison
   - `analyze_holographic_pattern`: Detect holographic surface characteristics

3. **Data Tools**
   - `query_user_vault`: Retrieve user's card collection from DynamoDB
   - `store_card_metadata`: Persist card data to DynamoDB
   - `get_price_history`: Fetch historical pricing trends

4. **Agent Invocation Tools**
   - `invoke_pricing_agent`: Call specialized pricing agent
   - `invoke_authenticity_agent`: Call specialized authenticity agent
   - `invoke_ocr_reasoning_agent`: Call OCR interpretation agent

#### Gateway Deployment

```python
# gateway_tools.py
from mcp.server import Server
from mcp.types import Tool, TextContent

server = Server("collectiq-gateway")

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="fetch_ebay_comps",
            description="Fetch recent eBay sales for a Pokémon card",
            inputSchema={
                "type": "object",
                "properties": {
                    "cardName": {"type": "string"},
                    "set": {"type": "string"},
                    "condition": {"type": "string"}
                },
                "required": ["cardName"]
            }
        ),
        # ... other tools
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "fetch_ebay_comps":
        # Invoke Lambda or call API directly
        result = await invoke_pricing_lambda(arguments)
        return [TextContent(type="text", text=json.dumps(result))]
    # ... handle other tools
```

**Benefits**:

- Centralized tool management
- Standardized interface for all agents
- Easier testing and versioning
- Reduced code duplication

### 3. AgentCore Memory Strategies

#### Memory Architecture

Three specialized memory strategies for CollectIQ:

**1. User Preference Strategy**

- **Namespace**: `/users/{userId}/preferences`
- **Purpose**: Extract and store collector preferences
- **Extraction Prompt**: Custom prompt for TCG collecting patterns
- **Use Cases**: Personalized pricing recommendations, targeted alerts

**2. Card History Strategy**

- **Namespace**: `/users/{userId}/cards/{cardId}`
- **Purpose**: Track valuation history and user interactions per card
- **Use Cases**: Price trend analysis, revaluation triggers

**3. Market Intelligence Strategy**

- **Namespace**: `/market/{set}/{rarity}`
- **Purpose**: Aggregate market trends across all users
- **Use Cases**: Market-wide analytics, investment recommendations

#### Memory Configuration

```python
# memory_setup.py
from bedrock_agentcore.memory import MemoryClient

client = MemoryClient(region_name="us-west-2")

# User Preference Strategy
USER_PREFERENCE_PROMPT = """
Analyze conversations to extract collector preferences:
- Favorite card sets and eras
- Budget constraints and spending patterns
- Condition preferences (graded vs. raw)
- Collecting goals (investment, nostalgia, completion)
- Risk tolerance for authenticity concerns
"""

memory = client.create_memory_and_wait(
    name="collectiq_memory",
    strategies=[
        {
            "customMemoryStrategy": {
                "name": "UserPreference",
                "namespaces": ["/users/{actorId}/preferences"],
                "configuration": {
                    "userPreferenceOverride": {
                        "extraction": {
                            "modelId": "anthropic.claude-3-5-sonnet-20241022-v2:0",
                            "appendToPrompt": USER_PREFERENCE_PROMPT
                        }
                    }
                }
            }
        },
        {
            "customMemoryStrategy": {
                "name": "CardHistory",
                "namespaces": ["/users/{actorId}/cards/{cardId}"],
                "configuration": {
                    "userPreferenceOverride": {
                        "extraction": {
                            "modelId": "anthropic.claude-3-5-sonnet-20241022-v2:0",
                            "appendToPrompt": "Extract card valuation history and user sentiment"
                        }
                    }
                }
            }
        }
    ],
    memory_execution_role_arn=MEMORY_EXECUTION_ROLE_ARN
)
```

**Benefits**:

- Automatic context extraction via AI
- Reduced custom DynamoDB schema complexity
- Namespace-based data isolation
- Built-in encryption and access control

## Data Models

### AgentCore Runtime Agent Metadata

```typescript
interface AgentRuntimeConfig {
  agentRuntimeName: string;
  agentRuntimeArn: string;
  containerUri: string; // ECR image URI
  executionRoleArn: string;
  networkMode: 'PUBLIC';
  environmentVariables: {
    GATEWAY_URL: string;
    GATEWAY_ACCESS_TOKEN: string;
    MEMORY_ID: string;
    AWS_REGION: string;
  };
  status: 'CREATING' | 'ACTIVE' | 'UPDATING' | 'FAILED';
}
```

### AgentCore Gateway Tool Schema

```typescript
interface GatewayTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description?: string;
      }
    >;
    required: string[];
  };
  // Internal routing
  handler: 'lambda' | 'api' | 'agent';
  handlerConfig: {
    lambdaArn?: string;
    apiEndpoint?: string;
    agentArn?: string;
  };
}
```

### AgentCore Memory Event

```typescript
interface MemoryEvent {
  memoryId: string;
  actorId: string; // Cognito sub
  sessionId: string; // Request ID or conversation ID
  messages: Array<{
    content: string;
    role: 'USER' | 'ASSISTANT' | 'TOOL';
  }>;
  timestamp: string;
  namespace: string; // e.g., "/users/{sub}/preferences"
}
```

### Extended DynamoDB Schema

Existing DynamoDB schema remains unchanged. AgentCore Memory supplements (not replaces) DynamoDB:

- **DynamoDB**: Structured card metadata, pricing results, authenticity scores
- **AgentCore Memory**: Conversational context, extracted preferences, reasoning trails

```typescript
// Existing DynamoDB item (unchanged)
interface CardItem {
  PK: string; // USER#{sub}
  SK: string; // CARD#{cardId}
  cardId: string;
  userId: string;
  detectedName: string;
  valueEstimate: number;
  authenticityScore: number;
  // ... existing fields

  // NEW: Reference to AgentCore Memory
  memorySessionId?: string; // Link to conversation context
  lastMemorySync?: string; // ISO timestamp
}
```

## Error Handling

### AgentCore Runtime Error Handling

**Built-in Retry Logic**: AgentCore Runtime automatically retries failed agent invocations

**Error Categories**:

1. **Agent Initialization Errors**
   - Container startup failures
   - Missing environment variables
   - IAM permission issues
   - **Mitigation**: CloudWatch alarms, automated rollback to previous version

2. **Agent Execution Errors**
   - Timeout (default: 15 minutes, configurable)
   - Out of memory
   - Unhandled exceptions
   - **Mitigation**: Structured error responses, fallback to Lambda agents

3. **Gateway Communication Errors**
   - Tool not found
   - Invalid tool arguments
   - Tool execution timeout
   - **Mitigation**: Tool schema validation, circuit breaker pattern

4. **Memory Service Errors**
   - Memory not found
   - Namespace access denied
   - Extraction failure
   - **Mitigation**: Graceful degradation (continue without context)

### Hybrid Architecture Error Handling

**Step Functions Integration**:

```json
{
  "StartAt": "InvokeOrchestratorAgent",
  "States": {
    "InvokeOrchestratorAgent": {
      "Type": "Task",
      "Resource": "arn:aws:states:::bedrock-agentcore:invokeAgent",
      "Parameters": {
        "AgentArn": "${OrchestratorAgentArn}",
        "Payload.$": "$"
      },
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "FallbackToLambdaOrchestration"
        }
      ],
      "Next": "ProcessResults"
    },
    "FallbackToLambdaOrchestration": {
      "Type": "Task",
      "Resource": "${LambdaOrchestratorArn}",
      "End": true
    }
  }
}
```

**Fallback Strategy**:

- AgentCore agents fail → Fall back to existing Lambda agents
- Gateway tools fail → Direct Lambda invocation
- Memory service unavailable → Use DynamoDB for context

## Testing Strategy

### Unit Testing

**AgentCore Runtime Agents**:

- Test agent logic locally using `agentcore launch --local`
- Mock Gateway tools using MCP test server
- Validate memory interactions with test memory instances

```python
# test_orchestrator_agent.py
import pytest
from orchestrator_agent import orchestrate

@pytest.mark.asyncio
async def test_orchestrator_routes_to_pricing_agent():
    payload = {
        "prompt": "Value this Charizard card",
        "cardData": {"name": "Charizard", "set": "Base Set"}
    }

    result = await orchestrate(payload)

    assert "pricing_agent" in result["agents_invoked"]
    assert result["fair_value"] > 0
```

**Gateway Tools**:

- Test tool registration and schema validation
- Mock Lambda/API responses
- Verify MCP protocol compliance

```python
# test_gateway_tools.py
import pytest
from mcp.client import ClientSession

@pytest.mark.asyncio
async def test_fetch_ebay_comps_tool():
    async with ClientSession(gateway_url) as session:
        tools = await session.list_tools()
        assert "fetch_ebay_comps" in [t.name for t in tools]

        result = await session.call_tool(
            "fetch_ebay_comps",
            {"cardName": "Pikachu", "set": "Base Set"}
        )
        assert len(result.content) > 0
```

### Integration Testing

**End-to-End Workflow**:

1. Upload card image → S3
2. Trigger Step Functions → Invoke AgentCore orchestrator
3. Orchestrator → Calls Gateway tools → Invokes sub-agents
4. Results → Stored in DynamoDB + Memory
5. Verify → API returns complete card data

**Test Scenarios**:

- Happy path: All agents succeed
- Partial failure: One agent fails, others succeed
- Complete failure: Fallback to Lambda agents
- Memory unavailable: Graceful degradation

### Performance Testing

**Latency Benchmarks**:

- AgentCore Runtime cold start vs. Lambda cold start
- Gateway tool invocation overhead vs. direct Lambda call
- Memory query latency vs. DynamoDB query

**Load Testing**:

- Concurrent agent invocations (100, 500, 1000 requests/sec)
- Gateway tool throughput
- Memory service scalability

**Target Metrics**:

- P50 latency: < 2 seconds (end-to-end card valuation)
- P99 latency: < 5 seconds
- Cold start: < 3 seconds (AgentCore Runtime)
- Tool invocation overhead: < 100ms

## Cost Analysis

### Current Lambda-Based Architecture (Monthly)

**Assumptions**: 50,000 card valuations/month

| Service                      | Usage                                | Cost           |
| ---------------------------- | ------------------------------------ | -------------- |
| Lambda (Pricing Agent)       | 50k invocations × 2s × 512MB         | $5             |
| Lambda (Authenticity Agent)  | 50k invocations × 1.5s × 512MB       | $4             |
| Lambda (OCR Reasoning Agent) | 50k invocations × 1s × 256MB         | $2             |
| Step Functions               | 50k executions × 4 state transitions | $5             |
| Bedrock (Claude 3.5 Sonnet)  | 50k invocations × 1000 tokens        | $75            |
| Rekognition                  | 50k images                           | $50            |
| DynamoDB                     | 200k reads, 100k writes              | $15            |
| S3 + CloudWatch              | Storage + logs                       | $10            |
| **Total**                    |                                      | **$166/month** |

### AgentCore-Enhanced Architecture (Monthly)

**Assumptions**: Same 50,000 card valuations/month

| Service                              | Usage                                | Cost           |
| ------------------------------------ | ------------------------------------ | -------------- |
| AgentCore Runtime (Orchestrator)     | 50k invocations × 3s                 | $15            |
| AgentCore Runtime (Enhanced Pricing) | 50k invocations × 2.5s               | $12            |
| AgentCore Runtime (Research Agent)   | 5k invocations × 10s (browser)       | $5             |
| AgentCore Gateway                    | 200k tool invocations                | $10            |
| AgentCore Memory                     | 50k events + 10GB storage            | $20            |
| Lambda (Rekognition Handler)         | 50k invocations × 1s × 256MB         | $2             |
| Step Functions                       | 50k executions × 2 state transitions | $3             |
| Bedrock (Claude 3.5 Sonnet)          | 50k invocations × 1200 tokens        | $90            |
| Rekognition                          | 50k images                           | $50            |
| DynamoDB                             | 150k reads, 80k writes               | $12            |
| S3 + CloudWatch                      | Storage + logs                       | $12            |
| **Total**                            |                                      | **$231/month** |

**Cost Increase**: +$65/month (+39%)

**Value Justification**:

- Personalized recommendations (AgentCore Memory)
- Real-time market research (Browser Tool)
- Improved orchestration flexibility
- Reduced operational overhead (managed infrastructure)
- Better debugging and observability

## Migration Strategy

### Phase 1: Gateway Tool Registry (Low Risk)

**Goal**: Expose existing Lambda functions as Gateway tools without changing orchestration

**Steps**:

1. Deploy AgentCore Gateway
2. Register existing Lambda functions as tools
3. Update Lambda IAM roles for Gateway invocation
4. Test tool invocation via MCP client
5. Monitor Gateway metrics

**Timeline**: 1-2 weeks

**Risk**: Low (no changes to existing agents)

**Rollback**: Remove Gateway, revert to direct Lambda calls

### Phase 2: Memory Integration (Medium Risk)

**Goal**: Add AgentCore Memory to Pricing Agent for personalized recommendations

**Steps**:

1. Create memory strategies (User Preference, Card History)
2. Deploy memory-enabled Pricing Agent to AgentCore Runtime
3. Update Step Functions to invoke AgentCore agent (with Lambda fallback)
4. Migrate user preference data from DynamoDB to Memory
5. A/B test personalized vs. non-personalized recommendations

**Timeline**: 2-3 weeks

**Risk**: Medium (new service dependency)

**Rollback**: Disable Memory integration, fall back to Lambda agent

### Phase 3: Orchestrator Agent (High Risk)

**Goal**: Replace Step Functions orchestration with AgentCore orchestrator agent

**Steps**:

1. Implement LangGraph-based orchestrator agent
2. Deploy to AgentCore Runtime
3. Configure Gateway tools for agent invocation
4. Parallel run: Step Functions + AgentCore orchestrator
5. Compare results and latency
6. Gradual traffic shift (10% → 50% → 100%)

**Timeline**: 3-4 weeks

**Risk**: High (changes core orchestration logic)

**Rollback**: Route all traffic back to Step Functions

### Phase 4: Browser Tool Research Agent (Low Risk)

**Goal**: Add new capability for real-time market research

**Steps**:

1. Create Browser Tool resource
2. Implement Research Agent with browser capabilities
3. Expose as optional tool in Gateway
4. Invoke for rare cards or API failures
5. Monitor session recordings and costs

**Timeline**: 2 weeks

**Risk**: Low (additive feature, not critical path)

**Rollback**: Disable Browser Tool, remove Research Agent

## Recommended Use Cases (Prioritized)

### 1. AgentCore Memory for Personalized Pricing (HIGH PRIORITY)

**Why**: Directly improves core value proposition (valuation accuracy)

**Impact**:

- Personalized recommendations based on collector profile
- Reduced DynamoDB complexity for user context
- Automatic preference extraction via AI

**Effort**: Medium (2-3 weeks)

**ROI**: High (improved user satisfaction, reduced churn)

**Implementation**: Phase 2 migration

### 2. AgentCore Gateway for Tool Consolidation (HIGH PRIORITY)

**Why**: Improves maintainability and enables future extensibility

**Impact**:

- Centralized tool management
- Easier testing and versioning
- Foundation for multi-agent communication

**Effort**: Low (1-2 weeks)

**ROI**: High (reduced technical debt, faster feature development)

**Implementation**: Phase 1 migration

### 3. Browser Tool for Market Research (MEDIUM PRIORITY)

**Why**: Enables new capability not possible with current architecture

**Impact**:

- Access to data not available via APIs
- Real-time market intelligence
- Fallback for API failures

**Effort**: Low (2 weeks)

**ROI**: Medium (improved pricing for rare cards, better market insights)

**Implementation**: Phase 4 migration

### 4. Orchestrator Agent with LangGraph (LOW PRIORITY)

**Why**: Provides flexibility but Step Functions already works well

**Impact**:

- Dynamic routing based on AI reasoning
- Better debugging with conversational logs
- Easier to add new agents

**Effort**: High (3-4 weeks)

**ROI**: Low-Medium (marginal improvement over Step Functions)

**Implementation**: Phase 3 migration (optional)

**Recommendation**: Defer until Phases 1-2 prove value

## Security Considerations

### IAM Roles and Permissions

**AgentCore Runtime Execution Role**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock-agentcore:InvokeAgentRuntime",
        "bedrock-agentcore:ListTools",
        "bedrock-agentcore:CallTool"
      ],
      "Resource": ["${GatewayArn}", "${SubAgentArns}"]
    },
    {
      "Effect": "Allow",
      "Action": ["bedrock-agentcore:CreateEvent", "bedrock-agentcore:QueryMemory"],
      "Resource": "${MemoryArn}"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"],
      "Resource": "${DynamoDBTableArn}",
      "Condition": {
        "StringEquals": {
          "dynamodb:LeadingKeys": ["USER#${cognito:sub}"]
        }
      }
    }
  ]
}
```

### Data Isolation

**User-Scoped Access**:

- AgentCore Memory namespaces: `/users/{cognitoSub}/*`
- DynamoDB partition key: `USER#{cognitoSub}`
- S3 object prefix: `uploads/{cognitoSub}/*`

**Cross-User Protection**:

- Memory queries filtered by `actorId` (Cognito sub)
- Gateway tools validate user context before invocation
- IAM policies enforce partition-level access control

### Encryption

**Data at Rest**:

- AgentCore Memory: Encrypted with AWS-managed keys
- DynamoDB: KMS encryption enabled
- S3: Server-side encryption (SSE-S3)

**Data in Transit**:

- All AgentCore API calls: TLS 1.2+
- Gateway tool invocations: HTTPS only
- Agent-to-agent communication: Encrypted via Gateway

### Audit and Compliance

**CloudWatch Logging**:

- All agent invocations logged with `userId` and `requestId`
- Gateway tool calls logged with input/output
- Memory events logged with namespace and actor

**Browser Tool Session Recording**:

- All browser sessions recorded to S3
- Recordings encrypted and access-controlled
- Retention policy: 90 days

**X-Ray Tracing**:

- End-to-end tracing across AgentCore and Lambda
- Trace IDs propagated through Gateway
- Performance and error analysis

## Monitoring and Observability

### CloudWatch Metrics

**AgentCore Runtime Metrics**:

- `AgentInvocations`: Count of agent invocations
- `AgentDuration`: Execution time per invocation
- `AgentErrors`: Failed invocations
- `AgentThrottles`: Rate-limited requests

**AgentCore Gateway Metrics**:

- `ToolInvocations`: Count per tool
- `ToolLatency`: P50, P90, P99 latency
- `ToolErrors`: Failed tool calls
- `ToolCacheHits`: Gateway-level caching (if enabled)

**AgentCore Memory Metrics**:

- `MemoryEvents`: Events created
- `MemoryQueries`: Context retrievals
- `MemoryExtractions`: AI-powered preference extractions
- `MemoryStorageSize`: Total storage used

### CloudWatch Alarms

**Critical Alarms**:

- `AgentErrorRate > 5%`: Alert DevOps team
- `AgentP99Latency > 10s`: Performance degradation
- `GatewayToolErrors > 10%`: Tool availability issue
- `MemoryServiceUnavailable`: Fallback to DynamoDB

**Cost Alarms**:

- `AgentCoreMonthlySpend > $300`: Budget threshold
- `BrowserToolSessionCost > $50/day`: Unexpected usage

### Dashboards

**AgentCore Overview Dashboard**:

- Agent invocation trends (hourly, daily)
- Latency distribution (P50, P90, P99)
- Error rates by agent type
- Cost breakdown by service

**Tool Performance Dashboard**:

- Tool invocation frequency
- Tool latency heatmap
- Tool error rates
- Most/least used tools

**Memory Insights Dashboard**:

- Memory events per user
- Preference extraction success rate
- Storage growth over time
- Query latency trends

## Framework Selection

### Comparison: Strands vs. LangGraph vs. CrewAI

| Feature                      | Strands                       | LangGraph                         | CrewAI            |
| ---------------------------- | ----------------------------- | --------------------------------- | ----------------- |
| **Bedrock Integration**      | Native                        | Via LangChain                     | Via LangChain     |
| **Learning Curve**           | Low                           | Medium                            | Medium            |
| **Stateful Workflows**       | Limited                       | Excellent                         | Good              |
| **Multi-Agent Coordination** | Basic                         | Excellent                         | Excellent         |
| **Memory Integration**       | Built-in                      | Manual                            | Manual            |
| **TypeScript Support**       | No                            | No                                | No                |
| **Production Maturity**      | High (AWS-backed)             | High                              | Medium            |
| **Best For**                 | Simple agents, Bedrock-native | Complex workflows, state machines | Team-based agents |

### Recommendation for CollectIQ

**Phase 1-2 (Gateway + Memory)**: **Strands**

- Lightweight and Bedrock-native
- Built-in AgentCore Memory support
- Minimal learning curve for team
- Sufficient for single-agent enhancements

**Phase 3 (Orchestrator)**: **LangGraph**

- Best for stateful multi-agent workflows
- Excellent debugging and visualization
- Proven in production at scale
- Better than Step Functions for dynamic routing

**Not Recommended**: **CrewAI**

- Overkill for CollectIQ's use case
- Team-based metaphor doesn't fit pricing/authenticity workflow
- Less mature than Strands/LangGraph

### TypeScript Consideration

**Current State**: All CollectIQ agents are TypeScript

**Options**:

1. **Migrate to Python**: Use Strands/LangGraph (recommended for AgentCore)
2. **Keep TypeScript**: Containerize existing agents, use custom MCP client
3. **Hybrid**: Python for AgentCore agents, TypeScript for Lambda agents

**Recommendation**: Hybrid approach

- New AgentCore agents: Python (Strands/LangGraph)
- Existing Lambda agents: Keep TypeScript
- Gateway bridges both ecosystems

## Infrastructure as Code

### Terraform Module Structure

```
infra/terraform/modules/
├── agentcore_runtime/
│   ├── main.tf              # AgentCore Runtime resource
│   ├── variables.tf         # Agent name, container URI, role ARN
│   ├── outputs.tf           # Agent ARN, endpoint URL
│   └── iam.tf               # Execution role and policies
├── agentcore_gateway/
│   ├── main.tf              # Gateway resource
│   ├── tools.tf             # Tool registrations
│   ├── variables.tf         # Gateway name, tools config
│   └── outputs.tf           # Gateway URL, access token
├── agentcore_memory/
│   ├── main.tf              # Memory resource
│   ├── strategies.tf        # Memory strategies
│   ├── variables.tf         # Memory name, strategies config
│   └── outputs.tf           # Memory ID, ARN
└── agentcore_browser/
    ├── main.tf              # Browser Tool resource
    ├── variables.tf         # Browser name, recording config
    └── outputs.tf           # Browser ARN
```

### Example Terraform Configuration

```hcl
# infra/terraform/modules/agentcore_runtime/main.tf
resource "aws_bedrockagentcore_agent_runtime" "pricing_agent" {
  agent_runtime_name = var.agent_name

  agent_runtime_artifact {
    container_configuration {
      container_uri = var.container_uri
    }
  }

  network_configuration {
    network_mode = "PUBLIC"
  }

  role_arn = aws_iam_role.agent_execution.arn

  environment_variables = {
    GATEWAY_URL          = var.gateway_url
    GATEWAY_ACCESS_TOKEN = var.gateway_access_token
    MEMORY_ID            = var.memory_id
    AWS_REGION           = var.aws_region
  }

  tags = {
    Environment = var.environment
    Project     = "CollectIQ"
    ManagedBy   = "Terraform"
  }
}

# infra/terraform/modules/agentcore_memory/main.tf
resource "aws_bedrockagentcore_memory" "collectiq_memory" {
  name = var.memory_name

  dynamic "strategy" {
    for_each = var.strategies
    content {
      custom_memory_strategy {
        name       = strategy.value.name
        namespaces = strategy.value.namespaces

        configuration {
          user_preference_override {
            extraction {
              model_id        = strategy.value.model_id
              append_to_prompt = strategy.value.extraction_prompt
            }
          }
        }
      }
    }
  }

  memory_execution_role_arn = aws_iam_role.memory_execution.arn

  tags = {
    Environment = var.environment
    Project     = "CollectIQ"
  }
}
```

## Deployment Pipeline

### CI/CD for AgentCore Agents

```yaml
# .github/workflows/deploy-agentcore-agent.yml
name: Deploy AgentCore Agent

on:
  push:
    branches: [main]
    paths:
      - 'services/agentcore-agents/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE }}
          aws-region: us-east-1

      - name: Install AgentCore Starter Toolkit
        run: pip install bedrock-agentcore-starter-toolkit

      - name: Build and push container
        working-directory: services/agentcore-agents/pricing-agent
        run: |
          agentcore configure \
            --entrypoint pricing_agent.py \
            --execution-role ${{ secrets.AGENT_EXECUTION_ROLE_ARN }} \
            --auto-create-ecr \
            --region us-east-1 \
            --agent-name pricing-agent-prod

          agentcore launch

      - name: Run integration tests
        run: |
          pytest services/agentcore-agents/pricing-agent/tests/

      - name: Update Terraform state
        working-directory: infra/terraform/envs/prod
        run: |
          terraform init
          terraform apply -auto-approve \
            -target=module.agentcore_pricing_agent
```

### Local Development Workflow

```bash
# 1. Develop agent locally
cd services/agentcore-agents/pricing-agent

# 2. Test locally with Docker
agentcore launch --local

# 3. Test with local Gateway mock
python -m pytest tests/ --gateway-mock

# 4. Deploy to dev environment
agentcore configure \
  --entrypoint pricing_agent.py \
  --execution-role $DEV_EXECUTION_ROLE_ARN \
  --region us-east-1 \
  --agent-name pricing-agent-dev

agentcore launch

# 5. Test in dev environment
python tests/integration/test_dev_deployment.py

# 6. Promote to prod (via CI/CD)
git push origin main
```

## Decision Matrix

### Should CollectIQ Adopt AgentCore?

| Criterion                        | Weight | Score (1-5) | Weighted Score | Notes                                                                   |
| -------------------------------- | ------ | ----------- | -------------- | ----------------------------------------------------------------------- |
| **Improves Core Value Prop**     | 30%    | 4           | 1.2            | Memory enables personalization, Browser Tool improves rare card pricing |
| **Reduces Operational Overhead** | 20%    | 4           | 0.8            | Managed infrastructure, built-in observability                          |
| **Cost Efficiency**              | 15%    | 3           | 0.45           | +39% cost increase, justified by features                               |
| **Migration Complexity**         | 15%    | 4           | 0.6            | Incremental migration possible, low risk                                |
| **Team Readiness**               | 10%    | 3           | 0.3            | Requires Python skills, but frameworks are learnable                    |
| **Future Extensibility**         | 10%    | 5           | 0.5            | Gateway enables easy tool addition, Memory supports new use cases       |
| **Total**                        | 100%   | -           | **3.85/5**     | **RECOMMENDED**                                                         |

### Final Recommendation

**YES, adopt AgentCore incrementally**

**Rationale**:

1. **High-value features**: Memory and Browser Tool directly improve CollectIQ's core value propositions
2. **Low-risk migration**: Phased approach allows validation at each step
3. **Future-proof**: Gateway architecture enables rapid feature development
4. **Managed infrastructure**: Reduces operational burden as team scales

**Recommended Adoption Path**:

1. **Phase 1** (Weeks 1-2): Deploy Gateway, expose existing tools
2. **Phase 2** (Weeks 3-5): Add Memory to Pricing Agent, A/B test personalization
3. **Phase 4** (Weeks 6-7): Deploy Browser Tool for rare card research
4. **Phase 3** (Optional, Weeks 8-11): Migrate to orchestrator agent if Phases 1-2 prove successful

**Success Criteria**:

- Phase 1: Gateway operational, 100% tool availability
- Phase 2: 10%+ improvement in user satisfaction (personalized recommendations)
- Phase 4: 5%+ improvement in rare card pricing accuracy
- Overall: No increase in P99 latency, cost increase justified by metrics
