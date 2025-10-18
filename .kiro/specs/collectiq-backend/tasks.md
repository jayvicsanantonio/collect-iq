# Implementation Plan

- [x] 1. Set up project structure and shared utilities
  - Create services/backend directory with TypeScript configuration (tsconfig.json extending tsconfig.base.json)
  - Create subdirectories: src/handlers, src/agents, src/orchestration, src/adapters, src/store, src/auth, src/utils, src/tests
  - Set up esbuild.mjs configuration for Lambda bundling with tree-shaking
  - Create shared utilities in src/utils: logger, error handling (RFC 7807), validation helpers
  - Configure Zod schemas in packages/shared for common types (Card, PricingResult, AuthContext) that can be shared with frontend
  - Set up package.json with dependencies and scripts
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 2. Implement authentication module
  - [x] 2.1 Create JWT claims extraction utility
    - Write function in services/backend/src/auth to parse API Gateway authorizer context
    - Extract sub, email, groups from JWT claims
    - Handle missing or malformed claims with proper errors
    - _Requirements: 1.1, 1.4_

  - [x] 2.2 Implement ownership enforcement
    - Create enforceOwnership function in services/backend/src/auth that compares userId with resource owner
    - Throw 403 ProblemDetails when ownership check fails
    - _Requirements: 1.3_

  - [ ]\* 2.3 Write unit tests for auth module
    - Test JWT claim extraction with valid and invalid tokens
    - Test ownership enforcement with matching and mismatched userIds
    - _Requirements: 13.1_

- [x] 3. Implement DynamoDB store layer
  - [x] 3.1 Create DynamoDB client wrapper
    - Initialize DynamoDB DocumentClient in services/backend/src/store with configuration
    - Implement connection pooling and retry logic
    - Create helper functions for PK/SK generation (USER#{sub}, CARD#{cardId})
    - _Requirements: 3.1, 10.5_

  - [x] 3.2 Implement card CRUD operations
    - Write createCard function in services/backend/src/store with conditional writes for idempotency
    - Write listCards function using GSI1 (userId#createdAt) with pagination
    - Write getCard function with ownership verification
    - Write updateCard function with conditional expressions
    - Write deleteCard function (soft or hard delete based on config)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.3 Implement pricing snapshot storage
    - Write savePricingSnapshot function in services/backend/src/store with SK=PRICE#{iso8601}
    - Set TTL attribute for automatic expiration (300 seconds)
    - Write getPricingSnapshot function to retrieve cached results
    - _Requirements: 4.5_

  - [ ]\* 3.4 Write integration tests for DynamoDB operations
    - Test card CRUD with LocalStack or DynamoDB Local
    - Test pagination and cursor handling
    - Test conditional writes and idempotency
    - _Requirements: 13.2_

- [x] 4. Implement S3 upload presign handler
  - [x] 4.1 Create presign Lambda handler
    - Create handler in services/backend/src/handlers/upload_presign.ts
    - Parse and validate PresignRequest with Zod schema from packages/shared
    - Validate MIME type against ALLOWED_UPLOAD_MIME environment variable
    - Validate file size against MAX_UPLOAD_MB limit
    - Generate S3 key: uploads/{sub}/{uuid}-{sanitizedFilename}
    - Use AWS SDK getSignedUrl with PutObject operation
    - Set expiration to 60 seconds
    - Add server-side encryption headers (SSE-KMS)
    - Return PresignResponse with uploadUrl, key, expiresIn
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]\* 4.2 Write unit tests for presign handler
    - Test valid presign request
    - Test MIME type validation failure
    - Test file size validation failure
    - Test S3 key format
    - _Requirements: 13.1_

- [x] 5. Implement cards CRUD API handlers
  - [x] 5.1 Create cards_create handler
    - Create handler in services/backend/src/handlers/cards_create.ts
    - Extract userId from JWT claims using auth module
    - Validate request body with Zod schema from packages/shared
    - Generate cardId (UUID)
    - Call CardService.create from store module with userId and card data
    - Return 201 Created with card object
    - Handle errors with RFC 7807 format from utils
    - _Requirements: 3.1, 9.1_

  - [x] 5.2 Create cards_list handler
    - Create handler in services/backend/src/handlers/cards_list.ts
    - Extract userId from JWT claims using auth module
    - Parse query parameters (limit, cursor)
    - Call CardService.list from store module with userId and pagination params
    - Return 200 OK with items array and nextCursor
    - _Requirements: 3.2, 11.1_

  - [x] 5.3 Create cards_get handler
    - Create handler in services/backend/src/handlers/cards_get.ts
    - Extract userId from JWT claims using auth module
    - Extract cardId from path parameters
    - Call CardService.get from store module with userId and cardId
    - Return 200 OK with card object
    - Return 404 if card not found
    - _Requirements: 3.3, 11.1_

  - [x] 5.4 Create cards_delete handler
    - Create handler in services/backend/src/handlers/cards_delete.ts
    - Extract userId from JWT claims using auth module
    - Extract cardId from path parameters
    - Call CardService.delete from store module with userId and cardId
    - Return 204 No Content on success
    - Return 404 if card not found
    - _Requirements: 3.4_

  - [ ]\* 5.5 Write integration tests for CRUD handlers
    - Test create, list, get, delete flow
    - Test ownership enforcement (403 errors)
    - Test 404 handling
    - _Requirements: 13.2_

- [x] 6. Implement pricing adapters
  - [x] 6.1 Create PriceSource interface and base adapter
    - Define PriceSource interface in services/backend/src/adapters with fetchComps and isAvailable methods
    - Create base adapter class with rate limiting and circuit breaker logic
    - Implement exponential backoff for retries
    - Track failure rate and open circuit after 5 consecutive failures
    - _Requirements: 4.4, 4.6_

  - [x] 6.2 Implement eBay pricing adapter
    - Create adapter in services/backend/src/adapters/ebay_adapter.ts
    - Set up eBay API authentication using EBAY_APP_ID from Secrets Manager
    - Implement fetchComps to query eBay Finding API
    - Parse eBay response and map to RawComp format
    - Handle pagination to fetch multiple pages of results
    - _Requirements: 4.1_

  - [x] 6.3 Implement TCGPlayer pricing adapter
    - Create adapter in services/backend/src/adapters/tcgplayer_adapter.ts
    - Set up TCGPlayer API authentication using public/private keys from Secrets Manager
    - Implement fetchComps to query TCGPlayer pricing API
    - Parse TCGPlayer response and map to RawComp format
    - Handle API-specific condition mappings
    - _Requirements: 4.1_

  - [x] 6.4 Implement PriceCharting adapter
    - Create adapter in services/backend/src/adapters/pricecharting_adapter.ts
    - Set up PriceCharting API authentication using API key from Secrets Manager
    - Implement fetchComps to query PriceCharting API
    - Parse response and map to RawComp format
    - _Requirements: 4.1_

  - [x] 6.5 Create pricing normalization and fusion logic
    - Create pricing service in services/backend/src/adapters/pricing_service.ts
    - Write normalize function to standardize conditions (Poor, Good, Excellent, Near Mint, Mint)
    - Convert all prices to USD
    - Implement IQR outlier removal to filter extreme prices
    - Write fuse function to compute valueLow (10th percentile), valueMedian (50th), valueHigh (90th)
    - Calculate confidence score based on sample size and variance
    - Calculate volatility (coefficient of variation)
    - _Requirements: 4.2, 4.3_

  - [x] 6.6 Implement PricingService orchestrator
    - Create fetchAllComps function that calls all available sources in parallel
    - Aggregate results from multiple sources
    - Call normalize and fuse functions
    - Cache PricingResult in DynamoDB with TTL
    - Return cached result if available and not expired
    - _Requirements: 4.1, 4.5_

  - [ ]\* 6.7 Write unit tests for pricing logic
    - Test normalization with various condition formats
    - Test outlier removal with extreme prices
    - Test fusion with different sample sizes
    - Test confidence calculation
    - _Requirements: 13.1_

  - [ ]\* 6.8 Write integration tests for pricing adapters
    - Test each adapter with mock API responses
    - Test circuit breaker behavior
    - Test rate limiting and backoff
    - Test caching behavior
    - _Requirements: 13.2_

- [x] 7. Implement Rekognition feature extraction
  - [x] 7.1 Create RekognitionAdapter
    - Create adapter in services/backend/src/adapters/rekognition_adapter.ts
    - Initialize Rekognition client
    - Implement detectText function to extract OCR blocks
    - Parse Rekognition response and map to OCRBlock format
    - _Requirements: 5.1, 5.2_

  - [x] 7.2 Implement visual feature extraction
    - Download image from S3 for pixel analysis
    - Compute border ratios (top, bottom, left, right)
    - Calculate border symmetry score
    - Detect holographic regions using Rekognition DetectLabels
    - Compute holographic pixel variance
    - _Requirements: 5.3, 6.1_

  - [x] 7.3 Implement font and quality metrics
    - Extract font metrics from OCR blocks (kerning, alignment)
    - Compute blur score using image analysis
    - Detect glare using brightness analysis
    - _Requirements: 6.2_

  - [x] 7.4 Create FeatureEnvelope builder
    - Aggregate all extracted features into FeatureEnvelope structure
    - Include image metadata (dimensions, format, size)
    - Return complete FeatureEnvelope for downstream agents
    - _Requirements: 5.4_

  - [ ]\* 7.5 Write unit tests for feature extraction
    - Test OCR block parsing
    - Test border ratio calculation
    - Test font metrics extraction
    - _Requirements: 13.1_

- [x] 8. Implement authenticity detection agent
  - [x] 8.1 Create visual hash computation
    - Create utility in services/backend/src/utils/phash.ts
    - Implement perceptual hashing (pHash) algorithm
    - Download image from S3 and compute hash
    - Return hash string for comparison
    - _Requirements: 6.1_

  - [x] 8.2 Implement reference hash comparison
    - Load authentic reference hashes from S3 (authentic-samples/ bucket)
    - Compare computed hash with reference hashes using Hamming distance
    - Return visualHashConfidence score (0-1)
    - _Requirements: 6.1_

  - [x] 8.3 Compute authenticity signals
    - Calculate textMatchConfidence from OCR validation
    - Calculate holoPatternConfidence from holographic analysis
    - Calculate borderConsistency from border metrics
    - Calculate fontValidation from font metrics
    - Aggregate into AuthenticitySignals structure
    - _Requirements: 6.3, 6.7_

  - [x] 8.4 Integrate Bedrock for authenticity judgment
    - Create Bedrock prompt with FeatureEnvelope and AuthenticitySignals
    - Invoke Bedrock Converse API with Claude 3 Sonnet
    - Parse response to extract authenticityScore, fakeDetected, and rationale
    - Set fakeDetected=true if score < 0.85
    - _Requirements: 6.4, 6.5, 6.6_

  - [x] 8.5 Create AuthenticityAgent Lambda handler
    - Create handler in services/backend/src/agents/authenticity_agent.ts
    - Accept input with features (FeatureEnvelope) and cardMeta
    - Call visual hash computation and comparison
    - Compute authenticity signals
    - Invoke Bedrock for final judgment
    - Return AuthenticityResult with score, signals, and rationale
    - _Requirements: 6.7_

  - [ ]\* 8.6 Write unit tests for authenticity logic
    - Test hash computation
    - Test signal calculation
    - Test Bedrock prompt formatting
    - _Requirements: 13.1_

- [x] 9. Implement Bedrock integration service
  - [x] 9.1 Create BedrockService class
    - Create service in services/backend/src/adapters/bedrock_service.ts
    - Initialize Bedrock Runtime client
    - Implement invokeValuation method
    - Implement invokeAuthenticity method
    - Add retry logic (3 attempts with exponential backoff)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 9.2 Create valuation prompt and parser
    - Write system prompt for valuation agent
    - Format ValuationContext into user message
    - Parse Bedrock response to extract ValuationSummary
    - Validate response with Zod schema
    - _Requirements: 8.2_

  - [x] 9.3 Create authenticity prompt and parser
    - Write system prompt for authenticity agent
    - Format AuthenticityContext into user message
    - Parse Bedrock response to extract AuthenticityResult
    - Validate response with Zod schema
    - _Requirements: 8.4_

  - [x] 9.4 Implement fallback handling
    - If Bedrock fails after retries, return signals-only result
    - Set reduced confidence flag
    - Log Bedrock errors for monitoring
    - _Requirements: 9.1_

  - [ ]\* 9.5 Write unit tests for Bedrock service
    - Test prompt formatting
    - Test response parsing
    - Test retry logic
    - Test fallback behavior
    - _Requirements: 13.1_

- [x] 10. Implement Step Functions workflow
  - [x] 10.1 Create RekognitionExtract Lambda
    - Create handler in services/backend/src/orchestration/rekognition_extract.ts
    - Accept input with userId, cardId, s3Keys
    - Call RekognitionAdapter.extractFeatures for front image
    - If back image exists, extract features from back as well
    - Return FeatureEnvelope in output
    - _Requirements: 7.2, 7.3_

  - [x] 10.2 Create PricingAgent Lambda
    - Create handler in services/backend/src/agents/pricing_agent.ts
    - Accept input with cardMeta and features
    - Extract card name, set, condition from metadata
    - Call PricingService.fetchAllComps
    - Call BedrockService.invokeValuation with pricing result
    - Return PricingResult and ValuationSummary
    - _Requirements: 7.3, 8.2_

  - [x] 10.3 Create AuthenticityAgent Lambda
    - Handler already created in task 8.5 (services/backend/src/agents/authenticity_agent.ts)
    - Accept input with features (FeatureEnvelope) and cardMeta
    - Call AuthenticityAgent.analyze
    - Return AuthenticityResult
    - _Requirements: 7.3, 8.4_

  - [x] 10.4 Create Aggregator Lambda
    - Create handler in services/backend/src/orchestration/aggregator.ts
    - Accept input with agentResults (pricing and authenticity)
    - Merge results into single card update
    - Call CardService.update to persist results to DynamoDB
    - Emit EventBridge event with card update
    - Return final card object
    - _Requirements: 7.4, 7.5_

  - [x] 10.5 Create error handler Lambda
    - Create handler in services/backend/src/orchestration/error_handler.ts
    - Accept input with error details
    - Persist partial results if available
    - Log error details for debugging
    - Send message to DLQ
    - _Requirements: 7.6, 9.1_

  - [ ]\* 10.6 Write integration tests for workflow
    - Test complete workflow with mock inputs
    - Test parallel execution of agents
    - Test error handling and retries
    - Test DLQ routing
    - _Requirements: 13.2_

- [x] 11. Implement revalue orchestration handler
  - [x] 11.1 Create cards_revalue Lambda handler
    - Create handler in services/backend/src/handlers/cards_revalue.ts
    - Extract userId from JWT claims using auth module
    - Extract cardId from path parameters
    - Retrieve card from DynamoDB to get s3Keys
    - Check for in-flight executions (idempotency)
    - Start Step Functions execution with input: { userId, cardId, s3Keys, requestId }
    - Return 202 Accepted with executionArn
    - _Requirements: 7.1, 10.1_

  - [ ]\* 11.2 Write integration tests for revalue handler
    - Test successful execution start
    - Test idempotency (duplicate requests)
    - Test 404 when card not found
    - _Requirements: 13.2_

- [x] 12. Implement observability and logging
  - [x] 12.1 Create structured logger utility
    - Create logger in packages/telemetry for reuse across services
    - Implement JSON logger with requestId, userId, operation fields
    - Ensure no PII is logged
    - Add log level filtering (DEBUG, INFO, WARN, ERROR)
    - _Requirements: 9.2, 9.3_

  - [x] 12.2 Add CloudWatch metrics emission
    - Emit custom metrics for API latency
    - Emit metrics for auth failures
    - Emit metrics for pricing source errors
    - Emit metrics for authenticity score distribution
    - _Requirements: 9.5_

  - [x] 12.3 Enable X-Ray tracing
    - Add X-Ray SDK to all Lambda functions
    - Instrument AWS SDK calls
    - Add custom subsegments for business logic
    - _Requirements: 9.4_

  - [ ]\* 12.4 Create CloudWatch dashboard
    - Add widgets for API performance metrics
    - Add widgets for AI agent metrics
    - Add widgets for data storage metrics
    - _Requirements: 9.5_

- [x] 13. Implement idempotency handling
  - [x] 13.1 Create idempotency token storage
    - Create utility in services/backend/src/utils/idempotency.ts
    - Write saveIdempotencyToken function to store token in DynamoDB
    - Use conditional writes to prevent race conditions
    - Set TTL to IDEMPOTENCY_TTL_SECONDS (600)
    - _Requirements: 10.1, 10.2, 10.4_

  - [x] 13.2 Create idempotency middleware
    - Extract idempotency key from request headers
    - Check DynamoDB for existing token
    - Return cached result if token exists and not expired
    - Store new token before executing operation
    - _Requirements: 10.1, 10.2_

  - [ ]\* 13.3 Write unit tests for idempotency
    - Test token storage and retrieval
    - Test concurrent requests with same key
    - Test TTL expiration
    - _Requirements: 13.1_

- [x] 14. Implement secrets management
  - [x] 14.1 Create secrets retrieval utility
    - Create utility in services/backend/src/utils/secrets.ts
    - Implement getSecret function using AWS Secrets Manager
    - Cache secrets in memory for Lambda execution lifetime
    - Handle secret rotation gracefully
    - _Requirements: 12.5_

  - [x] 14.2 Update pricing adapters to use secrets
    - Retrieve EBAY_APP_ID from Secrets Manager
    - Retrieve TCGPLAYER keys from Secrets Manager
    - Retrieve PRICECHARTING_KEY from Secrets Manager
    - _Requirements: 12.5_

  - [ ]\* 14.3 Write unit tests for secrets management
    - Test secret retrieval
    - Test caching behavior
    - Test error handling
    - _Requirements: 13.1_

- [x] 15. Create API Gateway configuration
  - [x] 15.1 Define API routes and methods
    - POST /upload/presign → upload_presign Lambda
    - POST /cards → cards_create Lambda
    - GET /cards → cards_list Lambda
    - GET /cards/{id} → cards_get Lambda
    - DELETE /cards/{id} → cards_delete Lambda
    - POST /cards/{id}/revalue → cards_revalue Lambda
    - GET /healthz → healthz Lambda (no auth)
    - _Requirements: 1.1, 1.5_

  - [x] 15.2 Configure JWT authorizer
    - Set up Cognito User Pool as authorizer
    - Configure JWKS URL from environment
    - Set token source to Authorization header
    - Apply authorizer to all routes except /healthz
    - _Requirements: 1.1_

  - [x] 15.3 Configure CORS and security headers
    - Enable CORS with appropriate origins
    - Set security headers (HSTS, X-Content-Type-Options)
    - _Requirements: 12.3_

- [-] 16. Write end-to-end tests
  - [x] 16.1 Create E2E test suite setup
    - Set up test Cognito user pool
    - Create test user and obtain JWT token
    - Configure test environment variables
    - _Requirements: 13.2_

  - [ ]\* 16.2 Write complete flow E2E test
    - Sign in with Cognito to get JWT
    - Request presigned URL
    - Upload test card image to S3
    - Create card record
    - Trigger revaluation
    - Poll for results
    - Verify DynamoDB state
    - Clean up test data
    - _Requirements: 13.2_

  - [ ]\* 16.3 Write error scenario E2E tests
    - Test invalid JWT (401)
    - Test accessing other user's card (403)
    - Test uploading oversized file (413)
    - Test rate limiting (429)
    - _Requirements: 13.2_

  - [ ]\* 16.4 Write authenticity flow E2E test
    - Upload known fake card image
    - Verify authenticityScore < 0.85
    - Check fakeDetected flag
    - Validate rationale content
    - _Requirements: 13.2_

- [x] 17. Create deployment documentation
  - [x] 17.1 Document environment variables
    - List all required environment variables
    - Provide example values
    - Document secrets management approach
    - _Requirements: 9.1_

  - [x] 17.2 Document IAM requirements
    - List required IAM permissions per Lambda
    - Provide example IAM policy documents
    - Document least-privilege principles
    - _Requirements: 12.4_

  - [x] 17.3 Create deployment guide
    - Document build process (esbuild)
    - Document Lambda packaging
    - Document Terraform integration points
    - Provide deployment checklist
    - _Requirements: 9.1_
