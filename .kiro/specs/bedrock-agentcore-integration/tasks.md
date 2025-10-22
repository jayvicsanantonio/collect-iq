# Implementation Plan

- [ ] 1. Set up AgentCore Gateway infrastructure
  - Create Terraform module for AgentCore Gateway resource
  - Configure IAM roles and policies for Gateway access
  - Deploy Gateway to development environment
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 1.1 Create Gateway Terraform module
  - Write `infra/terraform/modules/agentcore_gateway/main.tf` with Gateway resource definition
  - Define variables for gateway name, region, and tool configurations
  - Create outputs for Gateway URL and access token
  - _Requirements: 2.1, 2.2_

- [ ] 1.2 Configure Gateway IAM roles
  - Create execution role for Gateway with Lambda invocation permissions
  - Add policies for API Gateway and DynamoDB access
  - Configure trust relationships for AgentCore service
  - _Requirements: 2.1, 9.1_

- [ ] 1.3 Deploy Gateway to dev environment
  - Apply Terraform configuration to create Gateway resource
  - Verify Gateway endpoint is accessible
  - Test Gateway health check endpoint
  - _Requirements: 2.1, 2.2_

- [ ] 2. Expose existing Lambda functions as Gateway tools
  - Register pricing adapter Lambda functions as Gateway tools
  - Register Rekognition handler as Gateway tool
  - Register DynamoDB operations as Gateway tools
  - Create tool schemas with input validation
  - _Requirements: 2.1, 2.2, 2.4_

- [ ] 2.1 Create tool registration script
  - Write Python script to register Lambda functions as MCP tools
  - Define tool schemas with JSON Schema validation
  - Implement tool name, description, and input schema for each Lambda
  - _Requirements: 2.1, 2.2_

- [ ] 2.2 Register pricing adapter tools
  - Register `fetch_ebay_comps` tool pointing to eBay pricing Lambda
  - Register `fetch_tcgplayer_comps` tool pointing to TCGPlayer Lambda
  - Register `fetch_pricecharting_comps` tool pointing to PriceCharting Lambda
  - Register `aggregate_pricing` tool for price normalization
  - _Requirements: 2.1, 2.5_

- [ ] 2.3 Register vision and data tools
  - Register `extract_card_features` tool for Rekognition invocation
  - Register `query_user_vault` tool for DynamoDB queries
  - Register `store_card_metadata` tool for DynamoDB writes
  - _Requirements: 2.1, 2.4_

- [ ]\* 2.4 Write integration tests for Gateway tools
  - Create test suite for tool registration and invocation
  - Test tool schema validation with valid and invalid inputs
  - Verify Lambda functions are invoked correctly via Gateway
  - _Requirements: 2.1, 2.2_

- [ ] 3. Create AgentCore Memory infrastructure
  - Create Terraform module for AgentCore Memory resource
  - Define memory strategies for user preferences and card history
  - Configure IAM roles for memory access
  - Deploy memory to development environment
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3.1 Create Memory Terraform module
  - Write `infra/terraform/modules/agentcore_memory/main.tf` with Memory resource
  - Define memory strategies configuration in `strategies.tf`
  - Create variables for memory name, strategies, and execution role
  - Create outputs for Memory ID and ARN
  - _Requirements: 3.1, 3.2_

- [ ] 3.2 Define user preference memory strategy
  - Create custom memory strategy with namespace `/users/{actorId}/preferences`
  - Write extraction prompt for TCG collector preferences (sets, budget, condition, goals)
  - Configure Claude 3.5 Sonnet as extraction model
  - _Requirements: 3.1, 3.2_

- [ ] 3.3 Define card history memory strategy
  - Create custom memory strategy with namespace `/users/{actorId}/cards/{cardId}`
  - Write extraction prompt for card valuation history and user sentiment
  - Configure extraction model and namespace pattern
  - _Requirements: 3.1, 3.2_

- [ ] 3.4 Configure Memory IAM roles
  - Create memory execution role with Bedrock model invocation permissions
  - Add policies for CloudWatch logging
  - Configure trust relationships for AgentCore Memory service
  - _Requirements: 3.1, 9.1_

- [ ] 3.5 Deploy Memory to dev environment
  - Apply Terraform configuration to create Memory resource
  - Verify memory strategies are created successfully
  - Test memory event creation and querying
  - _Requirements: 3.1, 3.2_

- [ ] 4. Implement enhanced Pricing Agent with Memory integration
  - Create Python Pricing Agent using Strands framework
  - Integrate AgentCore Memory for user preference retrieval
  - Implement memory event creation for conversation tracking
  - Containerize agent for AgentCore Runtime deployment
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 8.1_

- [ ] 4.1 Set up Python agent project structure
  - Create `services/agentcore-agents/pricing-agent/` directory
  - Initialize Python project with `pyproject.toml` and dependencies
  - Install `strands-agents`, `bedrock-agentcore-runtime`, `bedrock-agentcore-memory`
  - Create `pricing_agent.py` entrypoint file
  - _Requirements: 8.1, 8.3_

- [ ] 4.2 Implement Pricing Agent with Strands
  - Create Strands Agent with BedrockModel (Claude 3.5 Sonnet)
  - Define system prompt for pricing analysis with user context
  - Implement tools for fetching pricing data via Gateway
  - Add BedrockAgentCoreApp entrypoint decorator
  - _Requirements: 3.1, 8.1, 8.3_

- [ ] 4.3 Integrate Memory for user preferences
  - Initialize MemoryClient in agent code
  - Query user preferences from Memory before pricing analysis
  - Incorporate preferences into agent system prompt
  - Handle memory unavailable gracefully (fallback to default behavior)
  - _Requirements: 3.1, 3.2, 3.4_

- [ ] 4.4 Implement memory event creation
  - Create memory events after each pricing interaction
  - Store user query and agent response in conversation format
  - Include card metadata and pricing results in event
  - _Requirements: 3.1, 3.2_

- [ ] 4.5 Containerize Pricing Agent
  - Create Dockerfile for Python agent with ARM64 architecture
  - Configure AgentCore Starter Toolkit for container build
  - Set environment variables for Gateway URL, Memory ID, AWS region
  - Test local container execution with `agentcore launch --local`
  - _Requirements: 1.1, 1.2, 1.5_

- [ ] 5. Deploy Pricing Agent to AgentCore Runtime
  - Create Terraform module for AgentCore Runtime resource
  - Configure agent runtime with container URI and execution role
  - Deploy agent to development environment
  - Test agent invocation via Boto3 SDK
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 5.1 Create AgentCore Runtime Terraform module
  - Write `infra/terraform/modules/agentcore_runtime/main.tf` with Runtime resource
  - Define variables for agent name, container URI, execution role ARN
  - Create IAM role with Bedrock, Gateway, and Memory permissions
  - Create outputs for agent ARN and endpoint URL
  - _Requirements: 1.1, 1.2, 9.1_

- [ ] 5.2 Build and push container to ECR
  - Create ECR repository for pricing agent
  - Build Docker image using AgentCore Starter Toolkit
  - Tag image with version and environment
  - Push image to ECR repository
  - _Requirements: 1.1, 1.2_

- [ ] 5.3 Deploy agent runtime to dev environment
  - Apply Terraform configuration to create AgentCore Runtime
  - Wait for runtime status to become ACTIVE
  - Verify agent endpoint is accessible
  - _Requirements: 1.1, 1.2_

- [ ] 5.4 Test agent invocation
  - Write Python script to invoke agent via Boto3 `bedrock-agentcore` client
  - Test with sample card data and user context
  - Verify agent returns pricing result with personalized recommendations
  - Check CloudWatch logs for agent execution traces
  - _Requirements: 1.1, 1.2, 3.1_

- [ ] 6. Integrate AgentCore Pricing Agent with Step Functions
  - Update Step Functions state machine to invoke AgentCore agent
  - Add fallback to Lambda Pricing Agent on AgentCore failure
  - Configure error handling and retry logic
  - Deploy updated Step Functions workflow
  - _Requirements: 4.1, 4.2, 4.3, 7.1, 7.4_

- [ ] 6.1 Update Step Functions state machine definition
  - Add new state for invoking AgentCore Pricing Agent
  - Configure `bedrock-agentcore:invokeAgent` task type
  - Pass card metadata and user context in payload
  - _Requirements: 4.1, 4.2, 7.1_

- [ ] 6.2 Implement fallback to Lambda agent
  - Add Catch block for AgentCore invocation errors
  - Route to existing Lambda Pricing Agent on failure
  - Log fallback events to CloudWatch
  - _Requirements: 4.2, 4.3, 7.2_

- [ ] 6.3 Configure retry and timeout settings
  - Set retry policy for transient AgentCore errors
  - Configure timeout for agent invocation (default: 5 minutes)
  - Add exponential backoff for retries
  - _Requirements: 4.2_

- [ ] 6.4 Deploy updated Step Functions workflow
  - Apply Terraform changes to update state machine
  - Test end-to-end workflow with sample card upload
  - Verify AgentCore agent is invoked and returns results
  - Test fallback behavior by simulating AgentCore failure
  - _Requirements: 4.1, 4.2, 7.1, 7.4_

- [ ] 7. Implement A/B testing for personalized pricing
  - Add feature flag for AgentCore vs. Lambda pricing agent
  - Route 10% of traffic to AgentCore agent initially
  - Collect metrics on user satisfaction and pricing accuracy
  - Gradually increase traffic to AgentCore agent based on results
  - _Requirements: 3.1, 3.2, 6.1, 6.2_

- [ ] 7.1 Add feature flag configuration
  - Create feature flag in AWS AppConfig or environment variable
  - Implement routing logic in Step Functions or API Gateway
  - Configure percentage-based traffic split (10% AgentCore, 90% Lambda)
  - _Requirements: 7.2_

- [ ] 7.2 Implement metrics collection
  - Add CloudWatch custom metrics for pricing accuracy
  - Track user satisfaction scores (thumbs up/down on pricing results)
  - Measure latency difference between AgentCore and Lambda agents
  - _Requirements: 6.1, 6.2_

- [ ] 7.3 Create A/B testing dashboard
  - Build CloudWatch dashboard comparing AgentCore vs. Lambda metrics
  - Display pricing accuracy, user satisfaction, and latency side-by-side
  - Add cost comparison metrics
  - _Requirements: 6.1, 6.2_

- [ ] 7.4 Implement gradual rollout strategy
  - Define success criteria for increasing traffic (e.g., 5% improvement in satisfaction)
  - Create runbook for traffic increase (10% → 25% → 50% → 100%)
  - Document rollback procedure if metrics degrade
  - _Requirements: 7.2_

- [ ] 8. Create Browser Tool infrastructure
  - Create Terraform module for AgentCore Browser Tool
  - Configure browser with session recording to S3
  - Set up IAM roles for browser execution
  - Deploy browser tool to development environment
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 8.1 Create Browser Tool Terraform module
  - Write `infra/terraform/modules/agentcore_browser/main.tf` with Browser resource
  - Configure network mode as PUBLIC
  - Set up session recording with S3 bucket and prefix
  - Define variables for browser name, recording config, execution role
  - Create outputs for Browser ARN
  - _Requirements: 5.1, 5.5_

- [ ] 8.2 Configure S3 bucket for session recordings
  - Create S3 bucket for browser session recordings
  - Enable server-side encryption (SSE-S3)
  - Configure lifecycle policy for 90-day retention
  - Set up bucket policy for AgentCore Browser access
  - _Requirements: 5.5, 9.2_

- [ ] 8.3 Configure Browser IAM roles
  - Create browser execution role with S3 write permissions
  - Add policies for CloudWatch logging
  - Configure trust relationships for AgentCore Browser service
  - _Requirements: 5.1, 9.1_

- [ ] 8.4 Deploy Browser Tool to dev environment
  - Apply Terraform configuration to create Browser Tool
  - Wait for browser status to become ACTIVE
  - Verify browser ARN is available
  - _Requirements: 5.1_

- [ ] 9. Implement Research Agent with Browser Tool
  - Create Python Research Agent using Strands framework
  - Integrate Browser Tool for web research capabilities
  - Implement tools for market research and authenticity verification
  - Containerize agent for AgentCore Runtime deployment
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 8.1_

- [ ] 9.1 Set up Research Agent project structure
  - Create `services/agentcore-agents/research-agent/` directory
  - Initialize Python project with dependencies
  - Install `strands-agents`, `strands-agents-tools` (for Browser Tool)
  - Create `research_agent.py` entrypoint file
  - _Requirements: 8.1, 8.3_

- [ ] 9.2 Implement Research Agent with Browser Tool
  - Create Strands Agent with BedrockModel
  - Configure BrowserTool with Browser ARN and recording settings
  - Define system prompt for TCG market research
  - Add BedrockAgentCoreApp entrypoint decorator
  - _Requirements: 5.1, 5.2, 8.1, 8.3_

- [ ] 9.3 Implement market research tools
  - Create tool for searching auction sites (eBay, Heritage Auctions)
  - Create tool for checking community forums (Reddit, PokéBeach)
  - Create tool for verifying grading standards (PSA, CGC websites)
  - _Requirements: 5.2, 5.3_

- [ ] 9.4 Containerize Research Agent
  - Create Dockerfile for Research Agent
  - Configure AgentCore Starter Toolkit for container build
  - Set environment variables for Browser ARN and Gateway URL
  - Test local container execution
  - _Requirements: 1.1, 1.2, 5.1_

- [ ] 9.5 Deploy Research Agent to AgentCore Runtime
  - Build and push container to ECR
  - Create AgentCore Runtime resource for Research Agent
  - Deploy to development environment
  - Test agent invocation with sample research query
  - _Requirements: 1.1, 1.2, 5.1_

- [ ] 10. Expose Research Agent as Gateway tool
  - Register Research Agent as Gateway tool for rare card research
  - Update Pricing Agent to invoke Research Agent for rare cards
  - Implement fallback logic when Browser Tool is unavailable
  - Test end-to-end workflow with rare card
  - _Requirements: 2.1, 2.2, 5.1, 5.4_

- [ ] 10.1 Register Research Agent as Gateway tool
  - Create tool schema for `research_card_market` tool
  - Configure tool to invoke Research Agent via AgentCore Runtime
  - Define input schema with card name, set, and research type
  - _Requirements: 2.1, 2.2_

- [ ] 10.2 Update Pricing Agent to use Research Agent
  - Add logic to detect rare cards (low API coverage, high value)
  - Invoke `research_card_market` tool via Gateway for rare cards
  - Incorporate research results into pricing analysis
  - _Requirements: 2.2, 5.2, 5.4_

- [ ] 10.3 Implement fallback logic
  - Handle Browser Tool unavailable errors gracefully
  - Fall back to API-only pricing when research fails
  - Log research failures to CloudWatch
  - _Requirements: 5.4_

- [ ] 10.4 Test rare card workflow
  - Test with rare card not covered by APIs (e.g., Pikachu Illustrator)
  - Verify Research Agent is invoked and returns market data
  - Check session recording is saved to S3
  - Verify pricing result incorporates research findings
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 11. Set up monitoring and observability
  - Create CloudWatch dashboards for AgentCore metrics
  - Configure CloudWatch alarms for critical errors
  - Set up X-Ray tracing for end-to-end visibility
  - Create cost monitoring dashboard
  - _Requirements: 6.1, 6.2, 9.3_

- [ ] 11.1 Create AgentCore Overview dashboard
  - Add widgets for agent invocation trends (hourly, daily)
  - Display latency distribution (P50, P90, P99) for each agent
  - Show error rates by agent type
  - Add cost breakdown by service (Runtime, Gateway, Memory, Browser)
  - _Requirements: 6.1_

- [ ] 11.2 Create Tool Performance dashboard
  - Display tool invocation frequency for each Gateway tool
  - Show tool latency heatmap
  - Track tool error rates
  - Identify most and least used tools
  - _Requirements: 6.1_

- [ ] 11.3 Create Memory Insights dashboard
  - Track memory events per user
  - Display preference extraction success rate
  - Show storage growth over time
  - Monitor query latency trends
  - _Requirements: 6.1_

- [ ] 11.4 Configure CloudWatch alarms
  - Create alarm for AgentCore error rate > 5%
  - Create alarm for P99 latency > 10 seconds
  - Create alarm for Gateway tool errors > 10%
  - Create alarm for Memory service unavailable
  - Create alarm for monthly spend > $300
  - _Requirements: 6.2, 9.3_

- [ ] 11.5 Set up X-Ray tracing
  - Enable X-Ray for AgentCore Runtime agents
  - Configure trace propagation through Gateway
  - Add X-Ray annotations for user ID, card ID, request ID
  - Create service map showing agent dependencies
  - _Requirements: 9.3_

- [ ]\* 11.6 Create monitoring runbook
  - Document alarm response procedures
  - Define escalation paths for critical errors
  - Create troubleshooting guide for common issues
  - _Requirements: 6.2_

- [ ] 12. Deploy to production environment
  - Update production Terraform configuration
  - Deploy AgentCore infrastructure to production
  - Migrate production traffic gradually
  - Monitor production metrics and costs
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 12.1 Update production Terraform configuration
  - Copy dev environment Terraform to `infra/terraform/envs/prod/`
  - Update resource names and tags for production
  - Configure production-specific settings (retention, alarms)
  - _Requirements: 7.1_

- [ ] 12.2 Deploy Gateway and Memory to production
  - Apply Terraform to create Gateway resource
  - Register production Lambda functions as Gateway tools
  - Create Memory resource with production strategies
  - Verify Gateway and Memory are operational
  - _Requirements: 7.1, 7.2_

- [ ] 12.3 Deploy Pricing Agent to production
  - Build and push production container to ECR
  - Create AgentCore Runtime for Pricing Agent
  - Test agent invocation in production
  - _Requirements: 7.1, 7.2_

- [ ] 12.4 Deploy Browser Tool and Research Agent to production
  - Create Browser Tool resource
  - Deploy Research Agent to AgentCore Runtime
  - Register Research Agent as Gateway tool
  - Test rare card research workflow
  - _Requirements: 7.1, 7.2_

- [ ] 12.5 Implement gradual traffic migration
  - Start with 10% of production traffic to AgentCore Pricing Agent
  - Monitor metrics for 1 week
  - Increase to 25% if metrics are positive
  - Continue gradual increase to 100% over 4 weeks
  - _Requirements: 7.2, 7.3, 7.4_

- [ ] 12.6 Monitor production metrics and costs
  - Track daily AWS costs for AgentCore services
  - Compare production metrics to dev environment
  - Verify cost increase is within expected range (+39%)
  - Adjust resource configurations if needed
  - _Requirements: 6.1, 6.2, 6.3_

- [ ]\* 13. Document AgentCore integration
  - Write developer guide for AgentCore agents
  - Document Gateway tool registration process
  - Create Memory strategy configuration guide
  - Update architecture diagrams
  - _Requirements: 7.1, 7.2_

- [ ]\* 13.1 Write developer guide
  - Document local development workflow with AgentCore Starter Toolkit
  - Explain how to create new agents using Strands/LangGraph
  - Provide examples of Gateway tool integration
  - Document testing strategies
  - _Requirements: 7.1, 8.5_

- [ ]\* 13.2 Document Gateway tool registration
  - Explain tool schema definition
  - Provide examples of Lambda, API, and agent tool types
  - Document tool versioning and updates
  - _Requirements: 2.1, 2.2_

- [ ]\* 13.3 Create Memory strategy guide
  - Explain memory namespace patterns
  - Document extraction prompt best practices
  - Provide examples of custom memory strategies
  - _Requirements: 3.1, 3.2_

- [ ]\* 13.4 Update architecture diagrams
  - Create diagram showing AgentCore integration
  - Update data flow diagrams
  - Document hybrid Lambda + AgentCore architecture
  - _Requirements: 7.1_
