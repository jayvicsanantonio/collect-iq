/**
 * CloudWatch Metrics emission utility
 * Provides custom metrics for API latency, errors, and business metrics
 *
 * Requirements: 9.5
 */

import { CloudWatchClient, PutMetricDataCommand, StandardUnit } from '@aws-sdk/client-cloudwatch';
import { logger } from './logger.js';

interface MetricDimension {
  [key: string]: string;
}

class MetricsService {
  private client: CloudWatchClient;
  private namespace: string;
  private stage: string;

  constructor() {
    this.client = new CloudWatchClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.stage = process.env.STAGE || 'dev';
    this.namespace = `CollectIQ/${this.stage}`;
  }

  /**
   * Emit a custom metric to CloudWatch
   */
  async putMetric(
    metricName: string,
    value: number,
    unit: StandardUnit = StandardUnit.None,
    dimensions?: MetricDimension,
  ): Promise<void> {
    try {
      const metricDimensions = dimensions
        ? Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value }))
        : [];

      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: [
          {
            MetricName: metricName,
            Value: value,
            Unit: unit,
            Timestamp: new Date(),
            Dimensions: metricDimensions,
          },
        ],
      });

      await this.client.send(command);

      logger.debug('Metric emitted', {
        operation: 'metrics_put',
        metricName,
        value,
        unit,
        dimensions,
      });
    } catch (error) {
      // Don't fail the operation if metrics fail
      logger.warn('Failed to emit metric', {
        operation: 'metrics_put',
        metricName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Emit API latency metric
   */
  async recordApiLatency(endpoint: string, method: string, latencyMs: number): Promise<void> {
    await this.putMetric('ApiLatency', latencyMs, StandardUnit.Milliseconds, {
      endpoint,
      method,
    });
  }

  /**
   * Emit authentication failure metric
   */
  async recordAuthFailure(reason: string): Promise<void> {
    await this.putMetric('AuthFailures', 1, StandardUnit.Count, {
      reason,
    });
  }

  /**
   * Emit pricing source error metric
   */
  async recordPricingSourceError(source: string, errorType: string): Promise<void> {
    await this.putMetric('PricingSourceErrors', 1, StandardUnit.Count, {
      source,
      errorType,
    });
  }

  /**
   * Emit authenticity score distribution metric
   */
  async recordAuthenticityScore(score: number, cardId: string): Promise<void> {
    await this.putMetric('AuthenticityScore', score, StandardUnit.None, {
      cardId,
      scoreRange: this.getScoreRange(score),
    });
  }

  /**
   * Emit pricing confidence metric
   */
  async recordPricingConfidence(confidence: number, source: string): Promise<void> {
    await this.putMetric('PricingConfidence', confidence, StandardUnit.None, {
      source,
    });
  }

  /**
   * Emit Step Functions execution metric
   */
  async recordStepFunctionExecution(
    status: 'success' | 'failure',
    durationMs: number,
  ): Promise<void> {
    await this.putMetric('StepFunctionsExecutions', 1, StandardUnit.Count, {
      status,
    });

    await this.putMetric('StepFunctionsDuration', durationMs, StandardUnit.Milliseconds, {
      status,
    });
  }

  /**
   * Emit DynamoDB operation metric
   */
  async recordDynamoDBOperation(operation: string, latencyMs: number): Promise<void> {
    await this.putMetric('DynamoDBLatency', latencyMs, StandardUnit.Milliseconds, {
      operation,
    });
  }

  /**
   * Emit S3 operation metric
   */
  async recordS3Operation(operation: string, latencyMs: number): Promise<void> {
    await this.putMetric('S3Latency', latencyMs, StandardUnit.Milliseconds, {
      operation,
    });
  }

  /**
   * Emit Bedrock invocation metric
   */
  async recordBedrockInvocation(
    agent: string,
    latencyMs: number,
    tokenCount?: number,
  ): Promise<void> {
    await this.putMetric('BedrockLatency', latencyMs, StandardUnit.Milliseconds, {
      agent,
    });

    if (tokenCount !== undefined) {
      await this.putMetric('BedrockTokens', tokenCount, StandardUnit.Count, {
        agent,
      });
    }
  }

  /**
   * Emit Rekognition invocation metric
   */
  async recordRekognitionInvocation(operation: string, latencyMs: number): Promise<void> {
    await this.putMetric('RekognitionLatency', latencyMs, StandardUnit.Milliseconds, {
      operation,
    });
  }

  /**
   * Emit circuit breaker state change metric
   */
  async recordCircuitBreakerStateChange(
    source: string,
    state: 'open' | 'closed' | 'half-open',
  ): Promise<void> {
    await this.putMetric('CircuitBreakerStateChange', 1, StandardUnit.Count, {
      source,
      state,
    });
  }

  /**
   * Emit cache hit/miss metric
   */
  async recordCacheOperation(operation: 'hit' | 'miss', cacheType: string): Promise<void> {
    await this.putMetric('CacheOperations', 1, StandardUnit.Count, {
      operation,
      cacheType,
    });
  }

  /**
   * Helper to categorize authenticity scores into ranges
   */
  private getScoreRange(score: number): string {
    if (score < 0.5) return '0.0-0.5';
    if (score < 0.7) return '0.5-0.7';
    if (score < 0.85) return '0.7-0.85';
    if (score < 0.95) return '0.85-0.95';
    return '0.95-1.0';
  }
}

// Export singleton instance
export const metrics = new MetricsService();
