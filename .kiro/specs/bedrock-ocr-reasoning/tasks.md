# Implementation Plan

- [x] 1. Create Bedrock OCR reasoning service adapter
  - Implement BedrockOcrReasoningService class in `services/backend/src/adapters/bedrock-ocr-reasoning.ts`
  - Add configuration constants for model ID, temperature, max tokens, and retry settings
  - Implement `interpretOcr()` method as main entry point
  - Implement `createSystemPrompt()` method with comprehensive Pokémon TCG expert instructions
  - Implement `createUserPrompt()` method to format OCR blocks and visual context
  - Implement `parseResponse()` method to extract and validate JSON from Bedrock output
  - Implement `invokeWithRetry()` method with exponential backoff for up to 3 attempts
  - Add error handling for throttling, timeouts, and invalid responses
  - Export singleton instance for use by agent
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 2. Create data models and schemas
  - [x] 2.1 Define TypeScript interfaces for OCR reasoning
    - Create `CardMetadata` interface with all field results
    - Create `FieldResult<T>` interface for single-value fields
    - Create `MultiCandidateResult<T>` interface for ambiguous fields
    - Create `OcrContext` interface for Bedrock input
    - Add interfaces to `services/backend/src/adapters/bedrock-ocr-reasoning.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 2.2 Create Zod validation schemas
    - Implement `CardMetadataSchema` in `services/backend/src/adapters/bedrock-ocr-reasoning.ts`
    - Add validation for all field types (single value, multi-candidate)
    - Add validation for confidence scores (0.0-1.0 range)
    - Add validation for required string fields (rationale, reasoningTrail)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 2.3 Update shared Card schema
    - Add `ocrMetadata` field to Card schema in `packages/shared/src/schemas.ts`
    - Include fields for name, rarity, set, collector number, illustrator with confidence scores
    - Add `extractedAt` timestamp and `reasoningTrail` fields
    - Export updated Card type
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Implement OCR reasoning agent Lambda
  - Create `services/backend/src/agents/ocr-reasoning-agent.ts` handler
  - Define `OcrReasoningAgentInput` and `OcrReasoningAgentOutput` interfaces
  - Implement handler function to extract OCR blocks from FeatureEnvelope
  - Build OcrContext with OCR blocks and visual features
  - Invoke BedrockOcrReasoningService with context
  - Handle successful responses and enrich card metadata
  - Implement fallback logic for Bedrock failures
  - Add comprehensive logging for invocation start, success, and failure
  - Add X-Ray tracing subsegments for performance monitoring
  - Return enriched CardMetadata to Step Functions
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 4. Create utility modules
  - [x] 4.1 Implement fuzzy matching utility
    - Create `services/backend/src/utils/fuzzy-matching.ts`
    - Implement `levenshteinDistance()` function for string similarity
    - Implement `findBestMatch()` function to find closest match from candidates
    - Implement `normalizeForComparison()` function for string preprocessing
    - Add unit tests for edge cases (empty strings, identical strings, no matches)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.2 Create Pokémon TCG knowledge base
    - Create `services/backend/src/utils/pokemon-knowledge.ts`
    - Define `POKEMON_SETS` constant with set names, symbols, and years
    - Define `RARITY_PATTERNS` constant with rarity indicators
    - Define `COPYRIGHT_PATTERNS` constant with era-specific copyright regex
    - Export constants for use in fallback logic and validation
    - _Requirements: 2.1, 3.5, 3.6_

  - [x] 4.3 Implement fallback metadata generator
    - Add `createFallbackMetadata()` function to `services/backend/src/adapters/bedrock-ocr-reasoning.ts`
    - Extract card name from topmost OCR block
    - Set all other fields to null with 0.0 confidence
    - Reduce confidence scores by 30% for fallback mode
    - Add rationale indicating AI reasoning unavailable
    - Set `verifiedByAI: false` flag
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 5. Update Step Functions workflow
  - Modify `infra/terraform/modules/step_functions/main.tf` to add OCR reasoning task
  - Insert new Lambda task state between RekognitionExtract and ParallelAgents
  - Configure task to receive FeatureEnvelope from Rekognition
  - Configure task to pass CardMetadata to downstream agents
  - Add retry policy with 2 attempts and exponential backoff
  - Add catch block to handle failures and route to error handler
  - Update Pricing Agent input to include enriched cardMeta from OCR reasoning
  - Update Authenticity Agent input to include enriched cardMeta from OCR reasoning
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 6. Add Lambda function infrastructure
  - Create new Lambda function resource in `infra/terraform/modules/lambda_fn/main.tf`
  - Configure function name as `collectiq-ocr-reasoning-agent-${var.environment}`
  - Set runtime to Node.js 20
  - Set memory to 512 MB and timeout to 30 seconds
  - Attach IAM role with Bedrock invoke permissions
  - Add environment variables for Bedrock model ID and configuration
  - Configure VPC settings if required
  - Add CloudWatch log group with 7-day retention
  - _Requirements: 1.3, 1.4, 1.5_

- [ ] 7. Configure IAM permissions
  - Update Lambda execution role in `infra/terraform/modules/lambda_fn/main.tf`
  - Add `bedrock:InvokeModel` permission for Claude Sonnet 4.0 model ARN
  - Restrict permission to specific model: `anthropic.claude-sonnet-4-20250514-v1:0`
  - Add CloudWatch Logs permissions for logging
  - Add X-Ray permissions for tracing
  - Follow least-privilege principle
  - _Requirements: 1.3, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 8. Implement CloudWatch metrics and alarms
  - [ ] 8.1 Add custom metrics to metrics utility
    - Update `services/backend/src/utils/metrics.ts` with `recordBedrockOcrInvocation()` method
    - Emit metrics for latency, input tokens, output tokens, overall confidence
    - Emit metric for fallback usage (boolean)
    - Add namespace and dimensions for filtering
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 8.2 Create CloudWatch alarms
    - Add alarm for high fallback rate (>10%) in `infra/terraform/modules/cloudwatch_dashboards/main.tf`
    - Add alarm for high latency (P95 >5 seconds)
    - Add alarm for low confidence scores (average <0.6)
    - Add alarm for high token usage (average >3000 output tokens)
    - Configure SNS notifications for all alarms
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 9. Write unit tests
  - [ ] 9.1 Test Bedrock OCR reasoning service
    - Create `services/backend/src/tests/bedrock-ocr-reasoning.test.ts`
    - Test `createSystemPrompt()` includes all required instructions
    - Test `createUserPrompt()` formats OCR blocks correctly
    - Test `parseResponse()` extracts JSON from valid responses
    - Test `parseResponse()` extracts JSON from markdown code blocks
    - Test `parseResponse()` handles malformed JSON gracefully
    - Mock Bedrock client for isolated testing
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 9.2 Test schema validation
    - Test validation of complete CardMetadata
    - Test validation of partial metadata with missing fields
    - Test validation failure handling with Zod errors
    - Test confidence score range validation (0.0-1.0)
    - Test multi-candidate field validation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ] 9.3 Test fuzzy matching utility
    - Test `levenshteinDistance()` with various string pairs
    - Test `findBestMatch()` with different thresholds
    - Test `normalizeForComparison()` with special characters and whitespace
    - Test edge cases (empty strings, identical strings, no matches)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 9.4 Test fallback logic
    - Test `createFallbackMetadata()` with empty OCR blocks
    - Test `createFallbackMetadata()` with valid OCR blocks
    - Test confidence score reduction (30% decrease)
    - Test rationale messages indicate fallback mode
    - Test `verifiedByAI: false` flag is set
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 10. Write integration tests
  - [ ] 10.1 Test end-to-end OCR reasoning flow
    - Create `services/backend/src/tests/e2e/ocr-reasoning.e2e.test.ts`
    - Upload test card image to S3
    - Invoke Rekognition extraction
    - Invoke OCR reasoning agent with real Bedrock API
    - Verify structured CardMetadata output
    - Verify confidence scores are within expected ranges
    - Clean up test resources after execution
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 10.2 Test OCR error correction
    - Create test fixture with corrupted OCR text (e.g., "Yenusaur")
    - Invoke OCR reasoning with corrupted input
    - Verify name correction to "Venusaur"
    - Verify confidence score reflects correction quality
    - Verify rationale explains the correction
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 10.3 Test multi-candidate scenarios
    - Create test fixture with ambiguous set information
    - Invoke OCR reasoning with ambiguous input
    - Verify multiple candidates returned for set field
    - Verify candidates sorted by confidence descending
    - Verify rationale explains ambiguity
    - _Requirements: 3.3, 4.3, 4.4_

  - [ ] 10.4 Test retry logic
    - Mock Bedrock throttling errors
    - Invoke OCR reasoning and verify retry attempts
    - Verify exponential backoff delays
    - Verify eventual success or fallback after max retries
    - _Requirements: 1.5, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 10.5 Test performance and latency
    - Measure end-to-end latency for typical card images
    - Verify completion within 5-second SLA (95th percentile)
    - Test with various image sizes and OCR block counts
    - Verify token usage is within expected ranges
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 11. Create test fixtures and data
  - Create `services/backend/src/tests/fixtures/ocr-test-data.ts`
  - Add test OCR blocks for Venusaur Base Set card
  - Add test OCR blocks for Charizard with holographic patterns
  - Add test OCR blocks with intentional errors for correction testing
  - Add test OCR blocks with ambiguous set information
  - Add test visual context data (holo variance, border symmetry, image quality)
  - Export fixtures for use in unit and integration tests
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 12. Update downstream agents to use enriched metadata
  - [ ] 12.1 Update Pricing Agent
    - Modify `services/backend/src/agents/pricing-agent.ts` to accept enriched cardMeta
    - Use OCR reasoning card name instead of extracting from OCR blocks
    - Use OCR reasoning set and rarity for pricing queries
    - Remove old OCR extraction logic from Pricing Agent
    - Add logging to indicate use of OCR reasoning metadata
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ] 12.2 Update Authenticity Agent
    - Modify `services/backend/src/agents/authenticity_agent.ts` to accept enriched cardMeta
    - Use OCR reasoning rarity for holographic expectation
    - Use OCR reasoning metadata for text match confidence calculation
    - Add logging to indicate use of OCR reasoning metadata
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 13. Update Aggregator to persist OCR metadata
  - Modify `services/backend/src/orchestration/aggregator.ts` to accept OCR metadata
  - Add OCR metadata fields to card update in DynamoDB
  - Include confidence scores and reasoning trail in persisted data
  - Add timestamp for when OCR reasoning was performed
  - Update EventBridge event to include OCR metadata
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 14. Add comprehensive logging
  - Add INFO level logs for OCR reasoning start with cardId and OCR block count
  - Add DEBUG level logs for prompt generation with prompt lengths
  - Add INFO level logs for Bedrock response with latency, token count, and confidence
  - Add WARN level logs for fallback activation with error reason
  - Add ERROR level logs for failures with full error details and retry count
  - Ensure all logs include requestId for tracing
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 15. Deploy and validate
  - [ ] 15.1 Deploy infrastructure changes
    - Run `terraform plan` in `infra/terraform/envs/hackathon/` to preview changes
    - Run `terraform apply` to deploy new Lambda function and Step Functions update
    - Verify Lambda function is created with correct configuration
    - Verify IAM permissions are correctly attached
    - Verify Step Functions workflow includes new OCR reasoning task
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 15.2 Deploy Lambda code
    - Build backend service with `pnpm build` in `services/backend/`
    - Package Lambda function code with dependencies
    - Upload Lambda deployment package to S3 or deploy directly
    - Verify Lambda function code is updated
    - Test Lambda function with sample event
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ] 15.3 Validate end-to-end flow
    - Upload test card image through frontend
    - Monitor Step Functions execution in AWS Console
    - Verify OCR reasoning task completes successfully
    - Verify enriched metadata is passed to downstream agents
    - Verify final card data includes OCR metadata in DynamoDB
    - Check CloudWatch logs for any errors or warnings
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 15.4 Monitor metrics and alarms
    - Verify custom metrics are being emitted to CloudWatch
    - Check fallback rate metric (should be <10%)
    - Check latency metric (P95 should be <5 seconds)
    - Check confidence score metric (average should be >0.6)
    - Check token usage metric (average should be <3000)
    - Verify alarms are configured and not triggering
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 16. Documentation and cleanup
  - Update `services/backend/README.md` with OCR reasoning agent documentation
  - Document Bedrock configuration and environment variables
  - Add troubleshooting guide for common OCR reasoning issues
  - Update API documentation with new CardMetadata schema
  - Add examples of OCR reasoning output to documentation
  - Remove deprecated OCR extraction code from Pricing Agent
  - Update architecture diagrams to include OCR reasoning agent
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
