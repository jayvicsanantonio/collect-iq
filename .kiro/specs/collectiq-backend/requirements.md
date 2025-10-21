# Requirements Document

## Introduction

CollectIQ Backend is a serverless AWS-based system that powers an AI-driven Pokémon TCG card identification, authentication, and valuation platform. The backend provides secure APIs for card management, integrates real-time pricing from multiple marketplace sources, implements multi-agent AI orchestration for authenticity detection and valuation, and ensures scalable, authenticated access through Amazon Cognito.

The system replaces mock data with live market feeds from eBay, TCGPlayer, and PriceCharting, and introduces a sophisticated multi-agent architecture using AWS Step Functions, Bedrock, and Rekognition to deliver accurate, explainable results to collectors.

## Requirements

### Requirement 1: Authentication and Authorization

**User Story:** As a collector, I want to securely authenticate and access only my own card data, so that my collection remains private and protected.

#### Acceptance Criteria

1. WHEN a user attempts to access any protected API endpoint THEN the system SHALL validate a Cognito-issued JWT token via API Gateway authorizer
2. WHEN a JWT token is invalid or expired THEN the system SHALL return a 401 Unauthorized response with RFC 7807 problem details
3. WHEN a user attempts to access another user's card data THEN the system SHALL return a 403 Forbidden response
4. WHEN a valid JWT is provided THEN the system SHALL extract the Cognito `sub` claim and use it for all data scoping operations
5. WHEN the /healthz endpoint is accessed THEN the system SHALL respond without requiring authentication

### Requirement 2: Secure Image Upload

**User Story:** As a collector, I want to securely upload card images directly to cloud storage, so that I can quickly submit cards for identification without exposing my credentials.

#### Acceptance Criteria

1. WHEN a user requests an upload URL THEN the system SHALL generate a presigned S3 URL scoped to `uploads/{sub}/{uuid}`
2. WHEN generating a presigned URL THEN the system SHALL set expiration to 60 seconds or less
3. WHEN a presigned URL is generated THEN the system SHALL enforce allowed MIME types (image/jpeg, image/png, image/heic)
4. WHEN a presigned URL is generated THEN the system SHALL enforce maximum file size of 12MB
5. WHEN an upload completes THEN the S3 object SHALL be encrypted at rest using KMS

### Requirement 3: Card Metadata Management

**User Story:** As a collector, I want to create, view, update, and delete card records in my vault, so that I can organize and track my collection over time.

#### Acceptance Criteria

1. WHEN a user creates a card record THEN the system SHALL store it in DynamoDB with PK=USER#{sub} and SK=CARD#{cardId}
2. WHEN a user lists their cards THEN the system SHALL return only cards where userId matches the authenticated user's sub
3. WHEN a user retrieves a specific card THEN the system SHALL verify ownership before returning data
4. WHEN a user deletes a card THEN the system SHALL verify ownership and remove the record from DynamoDB
5. WHEN card metadata is stored THEN the system SHALL include cardId, userId, name, set, rarity, conditionEstimate, S3 keys, timestamps

### Requirement 4: Real-Time Pricing Integration

**User Story:** As a collector, I want to see current market values from multiple sources, so that I can make informed decisions about buying, selling, or holding cards.

#### Acceptance Criteria

1. WHEN pricing data is requested THEN the system SHALL fetch comparable sales from at least two sources (eBay, TCGPlayer, PriceCharting)
2. WHEN multiple pricing sources return data THEN the system SHALL normalize conditions, currency, and outliers using IQR filtering
3. WHEN pricing data is aggregated THEN the system SHALL compute valueLow, valueMedian, valueHigh, compsCount, and confidence score
4. WHEN pricing API rate limits are encountered THEN the system SHALL implement exponential backoff and circuit breaker patterns
5. WHEN pricing data is fetched THEN the system SHALL cache results for 5 minutes to minimize API overhead
6. WHEN pricing sources fail THEN the system SHALL continue with available sources and flag reduced confidence

### Requirement 5: AI-Powered Card Identification

**User Story:** As a collector, I want the system to automatically identify my card from an image, so that I don't have to manually enter card details.

#### Acceptance Criteria

1. WHEN a card image is uploaded THEN the system SHALL invoke Amazon Rekognition for OCR and visual feature extraction
2. WHEN Rekognition processes an image THEN the system SHALL extract text blocks including card name, HP, attacks, and set information
3. WHEN features are extracted THEN the system SHALL produce a FeatureEnvelope containing OCR, borders, holo patterns, and font metrics
4. WHEN identification completes THEN the system SHALL return detected card name, set, number, and confidence score
5. WHEN identification confidence is below 0.7 THEN the system SHALL flag the result for user review

### Requirement 6: Authenticity Detection and Fake Card Analysis

**User Story:** As a collector, I want the system to detect potentially fake or altered cards, so that I can avoid purchasing counterfeits and verify my collection's authenticity.

#### Acceptance Criteria

1. WHEN a card image is analyzed THEN the system SHALL compute visual fingerprints including perceptual hash, border ratios, and logo alignment
2. WHEN holographic cards are detected THEN the system SHALL analyze pixel variance, RGB scatter, and reflection intensity patterns
3. WHEN text is extracted THEN the system SHALL validate font family, kerning, and linguistic consistency against authentic samples
4. WHEN authenticity signals are computed THEN the system SHALL pass them to Bedrock for AI-based judgment
5. WHEN Bedrock analyzes authenticity THEN the system SHALL return an authenticityScore between 0.0 and 1.0 with human-readable rationale
6. WHEN authenticityScore is below 0.85 THEN the system SHALL flag the card as potentially fake
7. WHEN authenticity analysis completes THEN the system SHALL store component signals (visualHashConfidence, textMatchConfidence, holoPatternConfidence) for transparency

### Requirement 7: Multi-Agent Orchestration

**User Story:** As a system administrator, I want AI tasks to be coordinated through a multi-agent architecture, so that the system can scale efficiently and handle complex workflows.

#### Acceptance Criteria

1. WHEN a revaluation is requested THEN the system SHALL start a Step Functions execution with userId, cardId, and s3Keys
2. WHEN the workflow begins THEN the system SHALL invoke RekognitionExtract task to produce FeatureEnvelope
3. WHEN FeatureEnvelope is ready THEN the system SHALL execute PricingAgent and AuthenticityAgent in parallel
4. WHEN AuthenticityAgent runs THEN the system SHALL consume the FeatureEnvelope from Rekognition
5. WHEN both agents complete THEN the system SHALL aggregate results and persist to DynamoDB
6. WHEN workflow completes THEN the system SHALL emit EventBridge events for downstream consumers
7. WHEN any task fails THEN the system SHALL retry with exponential backoff and route persistent failures to DLQ

### Requirement 8: Bedrock AI Integration

**User Story:** As a collector, I want AI-generated explanations for card valuations and authenticity assessments, so that I understand the reasoning behind each result.

#### Acceptance Criteria

1. WHEN Bedrock is invoked for valuation THEN the system SHALL provide normalized pricing data and card metadata as context
2. WHEN Bedrock generates valuation THEN the system SHALL return a 2-3 sentence summary including fair value, trend, and recommendation
3. WHEN Bedrock is invoked for authenticity THEN the system SHALL provide FeatureEnvelope signals and reference data
4. WHEN Bedrock generates authenticity assessment THEN the system SHALL return authenticityScore, fakeDetected boolean, and rationale
5. WHEN Bedrock calls are made THEN the system SHALL use model ID from environment configuration (e.g., anthropic.claude-3-sonnet)
6. WHEN Bedrock responses are received THEN the system SHALL enforce max tokens (2048) and temperature (0.2) for consistency

### Requirement 9: Error Handling and Observability

**User Story:** As a developer, I want comprehensive error handling and logging, so that I can quickly diagnose and resolve issues in production.

#### Acceptance Criteria

1. WHEN any error occurs THEN the system SHALL return RFC 7807 problem+json responses with type, title, status, detail, and instance
2. WHEN Lambda functions execute THEN the system SHALL emit structured JSON logs with requestId, userId, and operation context
3. WHEN logs are written THEN the system SHALL NOT include PII or sensitive data
4. WHEN API calls are made THEN the system SHALL trace requests using AWS X-Ray
5. WHEN critical operations fail THEN the system SHALL emit CloudWatch metrics for alerting
6. WHEN Step Functions execute THEN the system SHALL log state transitions and task outputs for debugging

### Requirement 10: Idempotency and Data Consistency

**User Story:** As a collector, I want duplicate submissions to be handled gracefully, so that I don't accidentally create multiple records for the same card.

#### Acceptance Criteria

1. WHEN a POST request includes an idempotency key THEN the system SHALL check DynamoDB for existing operations with that key
2. WHEN an idempotent operation is repeated within TTL window THEN the system SHALL return the cached result without re-execution
3. WHEN idempotency tokens are stored THEN the system SHALL set TTL to 600 seconds
4. WHEN concurrent requests arrive with the same idempotency key THEN the system SHALL use conditional writes to prevent race conditions
5. WHEN DynamoDB writes occur THEN the system SHALL use consistent reads for ownership verification

### Requirement 11: Performance and Scalability

**User Story:** As a collector, I want fast response times even during peak usage, so that I can quickly process multiple cards without delays.

#### Acceptance Criteria

1. WHEN hot path APIs are invoked (presign, list, get) THEN the system SHALL respond with P95 latency under 400ms
2. WHEN long-running tasks are needed (revaluation, authenticity) THEN the system SHALL return 202 Accepted and process asynchronously
3. WHEN Lambda functions are invoked THEN the system SHALL use appropriate memory allocation (512MB-1024MB) for optimal performance
4. WHEN DynamoDB is queried THEN the system SHALL use GSI1 (userId#createdAt) for efficient vault listings
5. WHEN pricing data is cached THEN the system SHALL use in-memory caching with 300-second TTL to reduce external API calls

### Requirement 12: Security and Compliance

**User Story:** As a security-conscious user, I want my data encrypted and access controlled, so that my collection information remains confidential.

#### Acceptance Criteria

1. WHEN data is stored in S3 THEN the system SHALL encrypt objects at rest using AWS KMS
2. WHEN data is stored in DynamoDB THEN the system SHALL enable encryption at rest
3. WHEN data is transmitted THEN the system SHALL enforce HTTPS/TLS for all API communication
4. WHEN IAM roles are assigned THEN the system SHALL follow least-privilege principles with scoped permissions
5. WHEN secrets are needed (API keys) THEN the system SHALL retrieve them from AWS Secrets Manager or SSM Parameter Store
6. WHEN tokens are issued THEN the system SHALL use HTTP-only cookies and never store JWTs in localStorage

### Requirement 13: Testing and Quality Assurance

**User Story:** As a developer, I want comprehensive test coverage, so that I can confidently deploy changes without breaking existing functionality.

#### Acceptance Criteria

1. WHEN unit tests are written THEN the system SHALL achieve minimum 80% code coverage for business logic
2. WHEN integration tests run THEN the system SHALL test S3, DynamoDB, and Step Functions interactions with mocks
3. WHEN E2E tests execute THEN the system SHALL validate complete flows: auth → upload → identify → value → save
4. WHEN error scenarios are tested THEN the system SHALL verify rate limiting, timeouts, and malformed input handling
5. WHEN tests run THEN the system SHALL use isolated test environments and clean up resources after execution
