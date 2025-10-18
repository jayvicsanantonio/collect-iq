/**
 * AWS X-Ray tracing utilities
 * Provides instrumentation for AWS SDK calls and custom subsegments
 *
 * Requirements: 9.4
 */

import AWSXRay from 'aws-xray-sdk-core';
import { logger } from './logger.js';

type AnnotationMap = Record<string, string | number | boolean>;
type MetadataMap = Record<string, unknown>;

type SegmentOrSubsegment = Exclude<ReturnType<typeof AWSXRay.getSegment>, undefined>;
type XRaySubsegment = SegmentOrSubsegment extends {
  addNewSubsegment: (...args: unknown[]) => infer R;
}
  ? R
  : never;

class TracingService {
  private enabled: boolean;
  private activeSubsegments: Map<string, XRaySubsegment>;

  constructor() {
    this.enabled = process.env.XRAY_ENABLED !== 'false';
    this.activeSubsegments = new Map();

    if (this.enabled) {
      try {
        AWSXRay.setContextMissingStrategy('LOG_ERROR');
        if (typeof AWSXRay.capturePromise === 'function') {
          AWSXRay.capturePromise();
        }
      } catch (error) {
        this.enabled = false;
        logger.warn('Failed to initialize AWS X-Ray SDK', {
          operation: 'xray_init',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Start a custom subsegment for business logic tracing
   */
  startSubsegment(name: string, annotations?: AnnotationMap): string {
    if (!this.enabled) {
      return name;
    }

    const segment = AWSXRay.getSegment();
    if (!segment) {
      logger.debug('AWS X-Ray segment unavailable; skipping subsegment start', {
        operation: 'xray_subsegment_start',
        subsegmentName: name,
      });
      return name;
    }

    const { addNewSubsegment } = segment as {
      addNewSubsegment?: (subsegmentName: string) => XRaySubsegment;
    };

    if (typeof addNewSubsegment !== 'function') {
      logger.debug('Current X-Ray entity cannot create subsegments', {
        operation: 'xray_subsegment_start',
        subsegmentName: name,
      });
      return name;
    }

    const subsegment = addNewSubsegment(name);

    if (annotations) {
      for (const [key, value] of Object.entries(annotations)) {
        try {
          subsegment.addAnnotation(key, value);
        } catch (error) {
          logger.debug('Failed to add X-Ray annotation', {
            operation: 'xray_annotation',
            key,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    this.activeSubsegments.set(name, subsegment);

    logger.debug('X-Ray subsegment started', {
      operation: 'xray_subsegment_start',
      subsegmentName: name,
      annotations,
    });

    return name;
  }

  /**
   * End a custom subsegment
   */
  endSubsegment(name: string, metadata?: MetadataMap): void {
    if (!this.enabled) {
      return;
    }

    const subsegment = this.activeSubsegments.get(name);
    if (!subsegment) {
      logger.warn('Attempted to end non-existent subsegment', {
        operation: 'xray_subsegment_end',
        subsegmentName: name,
      });
      return;
    }

    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        try {
          if (typeof subsegment.addMetadata === 'function') {
            subsegment.addMetadata(key, value);
          }
        } catch (error) {
          logger.debug('Failed to add X-Ray metadata', {
            operation: 'xray_metadata',
            key,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    try {
      if (typeof subsegment.close === 'function') {
        subsegment.close();
      }
    } catch (error) {
      logger.warn('Failed to close X-Ray subsegment', {
        operation: 'xray_subsegment_end',
        subsegmentName: name,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.activeSubsegments.delete(name);
    }
  }

  /**
   * Add annotation to current segment
   * Annotations are indexed and searchable in X-Ray console
   */
  addAnnotation(key: string, value: string | number | boolean): void {
    if (!this.enabled) {
      return;
    }

    const segment = AWSXRay.getSegment();
    if (!segment) {
      return;
    }

    try {
      segment.addAnnotation(key, value);
    } catch (error) {
      logger.debug('Failed to add annotation to current X-Ray segment', {
        operation: 'xray_annotation',
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Add metadata to current segment
   * Metadata is not indexed but provides additional context
   */
  addMetadata(key: string, value: unknown): void {
    if (!this.enabled) {
      return;
    }

    const segment = AWSXRay.getSegment();
    if (!segment) {
      return;
    }

    try {
      segment.addMetadata(key, value);
    } catch (error) {
      logger.debug('Failed to add metadata to current X-Ray segment', {
        operation: 'xray_metadata',
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Wrap an async function with X-Ray tracing
   */
  async trace<T>(name: string, fn: () => Promise<T>, annotations?: AnnotationMap): Promise<T> {
    const subsegmentName = this.startSubsegment(name, annotations);

    try {
      const result = await fn();
      this.endSubsegment(subsegmentName, { success: true });
      return result;
    } catch (error) {
      this.endSubsegment(subsegmentName, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Wrap a synchronous function with X-Ray tracing
   */
  traceSync<T>(name: string, fn: () => T, annotations?: AnnotationMap): T {
    const subsegmentName = this.startSubsegment(name, annotations);

    try {
      const result = fn();
      this.endSubsegment(subsegmentName, { success: true });
      return result;
    } catch (error) {
      this.endSubsegment(subsegmentName, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Instrument an AWS SDK v3 client so calls emit X-Ray subsegments
   */
  captureAWSv3Client<T extends { middlewareStack: unknown }>(client: T): T {
    if (!this.enabled) {
      return client;
    }

    try {
      const captureFn = (
        AWSXRay as unknown as {
          captureAWSv3Client?: (sdkClient: T) => T;
        }
      ).captureAWSv3Client;

      return captureFn ? captureFn.call(AWSXRay, client) : client;
    } catch (error) {
      logger.warn('Failed to instrument AWS SDK client for X-Ray', {
        operation: 'xray_capture_client',
        error: error instanceof Error ? error.message : String(error),
      });
      return client;
    }
  }

  /**
   * Check if tracing is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const tracing = new TracingService();

/**
 * Decorator for tracing async methods
 * Usage: @traced('operationName')
 */
export function traced(name: string, annotations?: AnnotationMap) {
  return function (_target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return tracing.trace(
        name || propertyKey,
        () => originalMethod.apply(this, args),
        annotations,
      );
    };

    return descriptor;
  };
}
