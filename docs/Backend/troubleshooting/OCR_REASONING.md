# OCR Reasoning Troubleshooting Guide

This guide provides solutions for common issues with the Bedrock OCR Reasoning Agent.

## Table of Contents

- [Low Confidence Scores](#low-confidence-scores)
- [High Fallback Rate](#high-fallback-rate)
- [Incorrect Name Extraction](#incorrect-name-extraction)
- [Ambiguous Set Detection](#ambiguous-set-detection)
- [Bedrock Invocation Timeout](#bedrock-invocation-timeout)
- [Invalid JSON Response](#invalid-json-response)
- [Missing OCR Metadata](#missing-ocr-metadata)
- [High Token Usage](#high-token-usage)
- [Throttling Errors](#throttling-errors)

---

## Low Confidence Scores

### Symptoms

- `overallConfidence < 0.6` consistently across multiple cards
- Individual field confidence scores below 0.5
- Frequent null values in extracted metadata

### Possible Causes

1. **Poor Image Quality**
   - Blurry images (high blur score)
   - Glare or reflections on card surface
   - Low resolution images (<500px width)
   - Poor lighting conditions

2. **Unusual Card Layout**
   - Foreign language cards (Japanese, French, German)
   - Promotional cards with non-standard layouts
   - Custom or fan-made cards
   - Damaged or worn cards with illegible text

3. **OCR Errors**
   - Rekognition misread critical text
   - Text patterns not recognized
   - Fuzzy matching unable to correct errors

### Diagnostic Steps

1. **Check Image Quality Metrics**

   ```typescript
   // Review FeatureEnvelope.imageQuality
   logger.info('Image quality metrics', {
     blurScore: features.imageQuality.blurScore,
     glareDetected: features.imageQuality.glareDetected,
     resolution: features.imageQuality.resolution,
   });
   ```

2. **Review Reasoning Trail**

   ```typescript
   // Check CardMetadata.reasoningTrail for specific issues
   logger.info('Reasoning trail', {
     reasoningTrail: cardMetadata.reasoningTrail,
   });
   ```

3. **Inspect OCR Blocks**
   ```typescript
   // Verify OCR blocks contain expected text patterns
   logger.debug('OCR blocks', {
     blockCount: features.ocrBlocks.length,
     topBlocks: features.ocrBlocks.filter((b) => b.boundingBox.top < 0.3),
   });
   ```

### Solutions

1. **Improve Image Quality**
   - Reject images with blur score >0.7
   - Detect and warn about glare before upload
   - Require minimum resolution (800px width)
   - Provide user guidance on optimal lighting

2. **Manual Review Workflow**
   - Flag cards with confidence <0.5 for manual review
   - Allow users to correct metadata
   - Build feedback loop to improve prompts

3. **Custom Name Mappings**
   - Add edge case mappings to `pokemon-knowledge.ts`
   - Handle common OCR errors (e.g., "Yenusaur" → "Venusaur")
   - Support alternate spellings and translations

4. **Adjust Confidence Thresholds**
   - Lower acceptance threshold for specific card types
   - Weight confidence by field importance (name > illustrator)
   - Use multi-candidate results for ambiguous fields

---

## High Fallback Rate

### Symptoms

- `FallbackUsed` CloudWatch metric >10%
- Frequent "Fallback metadata used" warnings in logs
- `verifiedByAI: false` flag set on many cards

### Possible Causes

1. **Bedrock Throttling**
   - Exceeded service quotas (requests per second)
   - Burst capacity exhausted
   - Account-level throttling

2. **Network Timeouts**
   - Lambda VPC configuration issues
   - NAT gateway problems
   - Bedrock service latency spikes

3. **Invalid JSON Responses**
   - Bedrock returning malformed JSON
   - Response doesn't match expected schema
   - Parsing errors in `parseResponse()`

### Diagnostic Steps

1. **Check CloudWatch Logs**

   ```bash
   # Search for error patterns
   aws logs filter-log-events \
     --log-group-name /aws/lambda/ocr-reasoning-agent \
     --filter-pattern "ERROR" \
     --start-time $(date -u -d '1 hour ago' +%s)000
   ```

2. **Review Bedrock Service Quotas**

   ```bash
   # Check current quotas
   aws service-quotas get-service-quota \
     --service-code bedrock \
     --quota-code L-1234ABCD
   ```

3. **Verify IAM Permissions**
   ```bash
   # Test Bedrock invocation
   aws bedrock-runtime invoke-model \
     --model-id anthropic.claude-sonnet-4-20250514-v1:0 \
     --body '{"prompt":"Test","max_tokens":10}' \
     --region us-east-1 \
     output.json
   ```

### Solutions

1. **Request Quota Increase**
   - Open AWS Support case for Bedrock quota increase
   - Request higher requests-per-second limit
   - Consider reserved capacity for production

2. **Optimize Lambda VPC Configuration**
   - Ensure NAT gateway has sufficient capacity
   - Add VPC endpoints for Bedrock (if available)
   - Monitor VPC flow logs for network issues

3. **Improve Error Handling**
   - Increase retry attempts from 3 to 5
   - Add jitter to exponential backoff
   - Implement circuit breaker pattern

4. **Add Response Validation**
   - Log raw Bedrock responses before parsing
   - Add more robust JSON extraction logic
   - Handle edge cases in schema validation

---

## Incorrect Name Extraction

### Symptoms

- Card name doesn't match expected value
- Name field has low confidence score
- Fuzzy matching not correcting obvious errors

### Possible Causes

1. **OCR Misread Card Name**
   - Similar-looking characters confused (O/0, I/l, S/5)
   - Stylized fonts not recognized
   - Name split across multiple OCR blocks

2. **Fuzzy Matching Threshold Too Low**
   - Levenshtein distance threshold too strict
   - Valid corrections rejected
   - No match found in candidate list

3. **Card Name Not in Knowledge Base**
   - New Pokémon not in Claude's training data
   - Regional variants or alternate forms
   - Promotional cards with unique names

### Diagnostic Steps

1. **Review OCR Blocks**

   ```typescript
   // Check topmost OCR blocks (card name area)
   const topBlocks = features.ocrBlocks
     .filter((b) => b.boundingBox.top < 0.3)
     .sort((a, b) => a.boundingBox.top - b.boundingBox.top);

   logger.debug('Top OCR blocks', { topBlocks });
   ```

2. **Check Name Rationale**

   ```typescript
   // Review correction details
   logger.info('Name extraction', {
     extractedName: cardMetadata.name.value,
     confidence: cardMetadata.name.confidence,
     rationale: cardMetadata.name.rationale,
   });
   ```

3. **Test Fuzzy Matching**

   ```typescript
   import { findBestMatch } from './utils/fuzzy-matching.js';

   const result = findBestMatch(ocrText, knownPokemonNames, 0.7);
   logger.debug('Fuzzy match result', { result });
   ```

### Solutions

1. **Improve OCR Block Selection**
   - Prioritize blocks in top 20% of image
   - Filter by minimum confidence (>0.8)
   - Combine adjacent blocks if name is split

2. **Adjust Fuzzy Matching**
   - Lower threshold to 0.6 for more matches
   - Add character substitution rules (O→0, I→l)
   - Implement phonetic matching (Soundex)

3. **Expand Knowledge Base**
   - Add new Pokémon to `pokemon-knowledge.ts`
   - Include regional variants (Alolan, Galarian)
   - Support alternate forms (Mega, Gigantamax)

4. **User Feedback Loop**
   - Allow users to correct names
   - Store corrections in DynamoDB
   - Use corrections to improve future extractions

---

## Ambiguous Set Detection

### Symptoms

- Multiple set candidates with similar confidence
- Set field returns candidates array instead of single value
- Users unsure which set is correct

### Possible Causes

1. **Copyright Text Unclear**
   - Copyright text damaged or illegible
   - Multiple copyright years (reprints)
   - Generic copyright without set-specific info

2. **Set Symbol Not Visible**
   - Symbol obscured by glare or damage
   - Symbol too small for OCR
   - Card from era without set symbols

3. **Card from Reprint Set**
   - Base Set vs Base Set 2
   - Original vs Legendary Collection
   - Multiple printings with same copyright

### Diagnostic Steps

1. **Review Set Candidates**

   ```typescript
   // Check all candidates and confidence scores
   if ('candidates' in cardMetadata.set) {
     logger.info('Set candidates', {
       candidates: cardMetadata.set.candidates,
       rationale: cardMetadata.set.rationale,
     });
   }
   ```

2. **Check Copyright Text**

   ```typescript
   // Review copyright OCR blocks
   const copyrightBlocks = features.ocrBlocks.filter((b) => b.boundingBox.top > 0.85);

   logger.debug('Copyright blocks', { copyrightBlocks });
   ```

3. **Use Collector Number**
   ```typescript
   // Collector number can disambiguate sets
   logger.info('Collector number', {
     number: cardMetadata.collectorNumber.value,
     confidence: cardMetadata.collectorNumber.confidence,
   });
   ```

### Solutions

1. **Use Collector Number for Disambiguation**
   - Cross-reference collector number with set ranges
   - Base Set: 1-102, Base Set 2: 1-130
   - Implement set lookup by number

2. **Improve Copyright Pattern Matching**
   - Add more specific copyright patterns to `pokemon-knowledge.ts`
   - Match year ranges to set release dates
   - Handle multiple copyright formats

3. **Visual Set Symbol Detection**
   - Use Rekognition label detection for set symbols
   - Match symbol shapes to known sets
   - Combine with copyright text for higher confidence

4. **User Selection Interface**
   - Present candidates to user for selection
   - Show confidence scores and rationale
   - Learn from user selections to improve future extractions

---

## Bedrock Invocation Timeout

### Symptoms

- Lambda timeout after 30 seconds
- "Task timed out" errors in CloudWatch logs
- Incomplete Bedrock responses

### Possible Causes

1. **Large OCR Block Count**
   - > 100 OCR blocks in image
   - Prompt exceeds token limit
   - Bedrock processing time too long

2. **Bedrock Service Latency**
   - Service experiencing high load
   - Regional latency issues
   - Cold start delays

3. **Network Issues**
   - VPC routing problems
   - NAT gateway bottleneck
   - DNS resolution delays

### Diagnostic Steps

1. **Check OCR Block Count**

   ```typescript
   logger.info('OCR block count', {
     blockCount: features.ocrBlocks.length,
     totalTextLength: features.ocrBlocks.reduce((sum, b) => sum + b.text.length, 0),
   });
   ```

2. **Measure Bedrock Latency**

   ```typescript
   const startTime = Date.now();
   const response = await bedrockClient.invokeModel(params);
   const latency = Date.now() - startTime;

   logger.info('Bedrock latency', { latency });
   ```

3. **Review Lambda Timeout Setting**
   ```bash
   # Check current timeout
   aws lambda get-function-configuration \
     --function-name ocr-reasoning-agent \
     --query 'Timeout'
   ```

### Solutions

1. **Filter OCR Blocks**
   - Remove low-confidence blocks (<0.7)
   - Limit to top 50 blocks by confidence
   - Exclude duplicate or redundant text

2. **Increase Lambda Timeout**
   - Increase from 30s to 60s
   - Update Terraform configuration
   - Monitor P95 latency to set appropriate timeout

3. **Optimize Prompt Size**
   - Reduce prompt verbosity
   - Remove unnecessary context
   - Use shorter field names in JSON schema

4. **Implement Streaming**
   - Use Bedrock streaming API (if available)
   - Process response incrementally
   - Reduce time to first token

---

## Invalid JSON Response

### Symptoms

- "Failed to parse Bedrock response" errors
- Malformed JSON in logs
- Schema validation failures

### Possible Causes

1. **Bedrock Returning Non-JSON**
   - Response wrapped in markdown code blocks
   - Additional text before/after JSON
   - Incomplete JSON due to token limit

2. **Schema Mismatch**
   - Response doesn't match expected structure
   - Missing required fields
   - Incorrect data types

3. **Parsing Errors**
   - Invalid escape sequences
   - Unquoted keys or values
   - Trailing commas

### Diagnostic Steps

1. **Log Raw Response**

   ```typescript
   logger.debug('Raw Bedrock response', {
     response: response.body.toString(),
   });
   ```

2. **Test JSON Extraction**

   ```typescript
   // Test parseResponse() with raw response
   try {
     const metadata = parseResponse(rawResponse);
     logger.info('Parsed successfully', { metadata });
   } catch (error) {
     logger.error('Parse failed', error);
   }
   ```

3. **Validate Against Schema**

   ```typescript
   import { CardMetadataSchema } from './bedrock-ocr-reasoning.js';

   const result = CardMetadataSchema.safeParse(data);
   if (!result.success) {
     logger.error('Schema validation failed', {
       errors: result.error.errors,
     });
   }
   ```

### Solutions

1. **Improve JSON Extraction**
   - Extract JSON from markdown code blocks
   - Handle multiple JSON objects in response
   - Remove non-JSON text before parsing

2. **Add Response Validation**
   - Validate response before parsing
   - Check for required fields
   - Provide default values for missing fields

3. **Adjust Token Limit**
   - Increase `max_tokens` from 4096 to 6000
   - Monitor token usage to find optimal limit
   - Truncate long rationales if needed

4. **Update System Prompt**
   - Emphasize JSON-only output
   - Provide example response format
   - Request no markdown formatting

---

## Missing OCR Metadata

### Symptoms

- `cardMeta.ocrMetadata` is undefined
- Downstream agents using legacy metadata
- "OCR reasoning metadata not available" warnings

### Possible Causes

1. **OCR Reasoning Agent Not Invoked**
   - Step Functions workflow not updated
   - Agent skipped due to error
   - Workflow using old version

2. **Agent Failed Silently**
   - Error caught but not logged
   - Fallback returned empty metadata
   - Response not propagated to downstream

3. **Schema Mismatch**
   - Aggregator not persisting OCR metadata
   - DynamoDB schema missing fields
   - Frontend not requesting OCR fields

### Diagnostic Steps

1. **Check Step Functions Execution**

   ```bash
   # Review execution history
   aws stepfunctions describe-execution \
     --execution-arn <execution-arn> \
     --query 'status'
   ```

2. **Verify Agent Output**

   ```typescript
   // Log OCR reasoning agent output
   logger.info('OCR reasoning output', {
     hasOcrMetadata: !!cardMeta.ocrMetadata,
     overallConfidence: cardMeta.ocrMetadata?.overallConfidence,
   });
   ```

3. **Check DynamoDB Item**
   ```bash
   # Query card item
   aws dynamodb get-item \
     --table-name CollectIQ \
     --key '{"PK":{"S":"USER#<userId>"},"SK":{"S":"CARD#<cardId>"}}'
   ```

### Solutions

1. **Update Step Functions Workflow**
   - Ensure OCR reasoning task is in workflow
   - Verify task is between Rekognition and parallel agents
   - Deploy updated workflow definition

2. **Fix Error Handling**
   - Ensure errors are logged and propagated
   - Don't silently swallow exceptions
   - Return partial metadata on failure

3. **Update Aggregator**
   - Persist OCR metadata to DynamoDB
   - Include all fields in card update
   - Add timestamp for OCR extraction

4. **Update Frontend**
   - Request OCR metadata fields in API calls
   - Display confidence scores to users
   - Show reasoning trail for transparency

---

## High Token Usage

### Symptoms

- Average output tokens >3000
- High Bedrock costs
- CloudWatch alarm triggered

### Possible Causes

1. **Verbose Rationales**
   - Bedrock providing excessive explanations
   - Reasoning trail too detailed
   - Repeated information across fields

2. **Large Prompt Size**
   - Too many OCR blocks in prompt
   - Unnecessary context included
   - Redundant instructions

3. **Multiple Candidates**
   - Many candidates for ambiguous fields
   - Each candidate has detailed rationale
   - Confidence scores for all possibilities

### Diagnostic Steps

1. **Monitor Token Usage**

   ```typescript
   logger.info('Token usage', {
     inputTokens: response.usage.inputTokens,
     outputTokens: response.usage.outputTokens,
     totalTokens: response.usage.totalTokens,
   });
   ```

2. **Analyze Prompt Size**

   ```typescript
   const promptLength = systemPrompt.length + userPrompt.length;
   logger.info('Prompt size', {
     promptLength,
     estimatedTokens: Math.ceil(promptLength / 4),
   });
   ```

3. **Review Response Length**
   ```typescript
   const responseLength = JSON.stringify(cardMetadata).length;
   logger.info('Response size', {
     responseLength,
     estimatedTokens: Math.ceil(responseLength / 4),
   });
   ```

### Solutions

1. **Optimize System Prompt**
   - Remove redundant instructions
   - Use concise language
   - Reduce example verbosity

2. **Limit Rationale Length**
   - Request brief rationales (1-2 sentences)
   - Truncate long explanations
   - Focus on key decision factors

3. **Reduce Candidate Count**
   - Limit to top 3 candidates per field
   - Only return candidates with confidence >0.3
   - Combine similar candidates

4. **Filter OCR Blocks**
   - Remove low-confidence blocks
   - Deduplicate similar text
   - Limit to most relevant blocks

---

## Throttling Errors

### Symptoms

- "ThrottlingException" errors in logs
- Retry attempts exhausted
- High fallback rate during peak usage

### Possible Causes

1. **Exceeded Service Quotas**
   - Too many requests per second
   - Burst capacity exhausted
   - Account-level throttling

2. **No Backoff Strategy**
   - Retries too aggressive
   - No jitter in backoff
   - All requests retrying simultaneously

3. **Concurrent Executions**
   - Multiple Step Functions running
   - Lambda concurrency too high
   - No rate limiting

### Diagnostic Steps

1. **Check Throttling Metrics**

   ```bash
   # Query CloudWatch metrics
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Bedrock \
     --metric-name ThrottledRequests \
     --start-time $(date -u -d '1 hour ago' +%s) \
     --end-time $(date -u +%s) \
     --period 300 \
     --statistics Sum
   ```

2. **Review Service Quotas**

   ```bash
   # List Bedrock quotas
   aws service-quotas list-service-quotas \
     --service-code bedrock \
     --query 'Quotas[?QuotaName==`Requests per second`]'
   ```

3. **Check Lambda Concurrency**
   ```bash
   # Get concurrent executions
   aws lambda get-function-concurrency \
     --function-name ocr-reasoning-agent
   ```

### Solutions

1. **Request Quota Increase**
   - Open AWS Support case
   - Request higher requests-per-second limit
   - Provide usage justification

2. **Improve Backoff Strategy**
   - Add jitter to exponential backoff
   - Increase initial delay to 2 seconds
   - Implement token bucket algorithm

3. **Add Rate Limiting**
   - Limit Lambda concurrency
   - Use SQS queue for request buffering
   - Implement distributed rate limiter

4. **Optimize Request Pattern**
   - Batch multiple cards if possible
   - Spread requests over time
   - Use reserved capacity for predictable load

---

## Additional Resources

- [Bedrock OCR Reasoning Design](../../.kiro/specs/bedrock-ocr-reasoning/design.md)
- [Bedrock OCR Reasoning Requirements](../../.kiro/specs/bedrock-ocr-reasoning/requirements.md)
- [CloudWatch Monitoring Guide](../../infra/terraform/modules/cloudwatch_dashboards/OCR_REASONING_MONITORING.md)
- [IAM Permissions](../../infra/terraform/modules/lambda_fn/IAM_PERMISSIONS.md)
- [Backend README](./README.md)

## Support

For additional support:

1. Check CloudWatch logs for detailed error messages
2. Review X-Ray traces for performance bottlenecks
3. Open GitHub issue with reproduction steps
4. Contact AWS Support for service-level issues
