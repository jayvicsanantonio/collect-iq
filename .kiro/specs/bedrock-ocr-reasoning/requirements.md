# Requirements Document

## Introduction

This specification defines the requirements for upgrading CollectIQ's Pokémon card image recognition pipeline to use Amazon Bedrock (Claude Sonnet 4.0) as an intelligent reasoning layer over AWS Rekognition OCR outputs. The enhancement will improve card metadata extraction accuracy by leveraging Claude's natural language understanding to correct OCR errors, infer missing information, and provide confidence-scored structured outputs.

## Glossary

- **OCR System**: AWS Rekognition text detection service that extracts raw text from card images
- **Reasoning Layer**: Amazon Bedrock (Claude Sonnet 4.0) AI model that interprets OCR outputs
- **Card Metadata**: Structured information about a Pokémon card including name, rarity, set, collector number, copyright, and illustrator
- **Confidence Score**: Numerical value (0.0-1.0) indicating the model's certainty in extracted information
- **Rationale**: Human-readable explanation for why the model made specific extraction decisions
- **Feature Envelope**: Data structure containing OCR blocks and visual features from Rekognition
- **Fuzzy Matching**: Approximate string matching technique using Levenshtein distance for error correction

## Requirements

### Requirement 1: Bedrock Integration

**User Story:** As a backend developer, I want to integrate Claude Sonnet 4.0 as the reasoning layer after Rekognition, so that OCR outputs are intelligently interpreted rather than processed with rigid rules.

#### Acceptance Criteria

1. WHEN the system processes a card image, THE OCR System SHALL invoke AWS Rekognition to extract raw text blocks
2. WHEN Rekognition returns OCR results, THE Reasoning Layer SHALL receive the complete Feature Envelope as input
3. THE Reasoning Layer SHALL use Amazon Bedrock Runtime API with model ID "anthropic.claude-sonnet-4-20250514-v1:0"
4. THE Reasoning Layer SHALL configure inference with temperature between 0.1 and 0.2 for deterministic outputs
5. THE Reasoning Layer SHALL implement retry logic with exponential backoff for up to 3 attempts

### Requirement 2: OCR Error Correction

**User Story:** As a collector, I want Pokémon card names to be correctly identified even when OCR makes mistakes, so that I can trust the system's card identification.

#### Acceptance Criteria

1. WHEN the OCR System detects text that resembles a Pokémon name, THE Reasoning Layer SHALL apply fuzzy matching against known Pokémon names
2. THE Reasoning Layer SHALL use Levenshtein distance algorithm to measure similarity between OCR text and valid Pokémon names
3. WHEN a close match is found with confidence above 0.7, THE Reasoning Layer SHALL correct the OCR error
4. THE Reasoning Layer SHALL include the original OCR text and corrected value in the rationale field
5. THE Reasoning Layer SHALL assign confidence scores based on fuzzy match distance and OCR confidence

### Requirement 3: Metadata Extraction

**User Story:** As a system administrator, I want the reasoning layer to extract comprehensive card metadata from OCR outputs, so that cards are fully cataloged with accurate information.

#### Acceptance Criteria

1. THE Reasoning Layer SHALL extract the following fields from OCR text: name, rarity, set, setSymbol, collectorNumber, copyrightRun, and illustrator
2. WHEN a field value is identified with high certainty, THE Reasoning Layer SHALL return a single value with confidence score
3. WHEN a field is ambiguous, THE Reasoning Layer SHALL return multiple candidates ranked by confidence
4. WHEN a field cannot be determined, THE Reasoning Layer SHALL return null value with low confidence score
5. THE Reasoning Layer SHALL infer rarity from contextual clues including holographic patterns, card text layout, and set information
6. THE Reasoning Layer SHALL identify set information from copyright text, set symbols, and card template patterns
7. THE Reasoning Layer SHALL extract collector numbers from text patterns matching "XX/YYY" format

### Requirement 4: Structured Output Schema

**User Story:** As a backend developer, I want Bedrock responses to follow a strict JSON schema, so that downstream systems can reliably parse and use the extracted metadata.

#### Acceptance Criteria

1. THE Reasoning Layer SHALL return responses in valid JSON format matching the defined schema
2. THE Reasoning Layer SHALL include confidence scores (0.0-1.0) for each extracted field
3. THE Reasoning Layer SHALL provide rationale text explaining extraction decisions for each field
4. WHEN multiple candidates exist for a field, THE Reasoning Layer SHALL return them in a candidates array sorted by confidence descending
5. THE Reasoning Layer SHALL calculate an overallConfidence score as the weighted average of individual field confidences
6. THE Reasoning Layer SHALL include a reasoningTrail field summarizing the key factors in the extraction process

### Requirement 5: Context-Only Processing

**User Story:** As a system architect, I want the reasoning layer to work exclusively from Rekognition outputs without external API calls, so that the system remains fast, cost-effective, and doesn't depend on third-party services.

#### Acceptance Criteria

1. THE Reasoning Layer SHALL process only the Feature Envelope data provided by the OCR System
2. THE Reasoning Layer SHALL NOT make external API calls to card databases or pricing services
3. THE Reasoning Layer SHALL infer all metadata from OCR text, visual features, and contextual patterns
4. THE Reasoning Layer SHALL use built-in knowledge of Pokémon TCG conventions for inference
5. THE Reasoning Layer SHALL complete processing within 5 seconds for typical card images

### Requirement 6: Logging and Observability

**User Story:** As a DevOps engineer, I want comprehensive logging of Bedrock invocations and reasoning outputs, so that I can monitor system performance and debug extraction issues.

#### Acceptance Criteria

1. THE Reasoning Layer SHALL log all Bedrock invocation attempts with model ID, temperature, and max tokens
2. THE Reasoning Layer SHALL log response latency, token usage, and stop reason for each successful invocation
3. WHEN Bedrock invocation fails, THE Reasoning Layer SHALL log error details and retry attempts
4. THE Reasoning Layer SHALL emit CloudWatch metrics for invocation count, latency, and token usage
5. THE Reasoning Layer SHALL log the complete reasoning output including confidence scores and rationales at INFO level

### Requirement 7: Error Handling and Fallback

**User Story:** As a product manager, I want the system to gracefully handle Bedrock failures, so that card processing continues even when AI reasoning is unavailable.

#### Acceptance Criteria

1. WHEN Bedrock invocation fails after all retries, THE Reasoning Layer SHALL return a fallback response based on raw OCR data
2. THE Reasoning Layer SHALL set verifiedByAI flag to false in fallback responses
3. THE Reasoning Layer SHALL reduce confidence scores by 30% in fallback mode
4. THE Reasoning Layer SHALL include a rationale indicating AI analysis was unavailable
5. THE Reasoning Layer SHALL log fallback activations as warnings for monitoring

### Requirement 8: System Prompt Engineering

**User Story:** As an AI engineer, I want well-crafted system prompts that guide Claude to produce accurate, structured outputs, so that extraction quality is maximized.

#### Acceptance Criteria

1. THE Reasoning Layer SHALL use a system prompt that defines the AI's role as a Pokémon TCG expert
2. THE Reasoning Layer SHALL instruct the model to correct OCR errors using fuzzy matching in the system prompt
3. THE Reasoning Layer SHALL specify the exact JSON output schema in the system prompt
4. THE Reasoning Layer SHALL request confidence scores and rationales for all fields in the system prompt
5. THE Reasoning Layer SHALL emphasize context-only processing without external lookups in the system prompt
