/**
 * Rekognition Adapter
 * Handles AWS Rekognition integration for OCR and visual feature extraction
 */

import {
  RekognitionClient,
  DetectTextCommand,
  DetectLabelsCommand,
  type DetectTextCommandOutput,
  type DetectLabelsCommandOutput,
} from '@aws-sdk/client-rekognition';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as sharpModule from 'sharp';

const sharp = sharpModule.default;
import type {
  OCRBlock,
  BoundingBox,
  FeatureEnvelope,
  BorderMetrics,
  FontMetrics,
  ImageQuality,
  ImageMetadata,
} from '@collectiq/shared';
import { logger } from '../utils/logger.js';
import { tracing } from '../utils/tracing.js';

const rekognitionClient = tracing.captureAWSv3Client(
  new RekognitionClient({
    region: process.env.AWS_REGION || 'us-east-1',
  }),
);

const s3Client = tracing.captureAWSv3Client(
  new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
  }),
);

/**
 * Extract S3 bucket and key from S3 key string
 */
function parseS3Key(s3Key: string): { bucket: string; key: string } {
  const bucket = process.env.BUCKET_UPLOADS || '';
  return { bucket, key: s3Key };
}

/**
 * Convert Rekognition bounding box to our format
 */
function convertBoundingBox(bbox: {
  Left?: number;
  Top?: number;
  Width?: number;
  Height?: number;
}): BoundingBox {
  return {
    left: bbox.Left || 0,
    top: bbox.Top || 0,
    width: bbox.Width || 0,
    height: bbox.Height || 0,
  };
}

/**
 * RekognitionAdapter class
 * Provides methods for text detection and feature extraction
 */
export class RekognitionAdapter {
  /**
   * Detect text in an image using Rekognition OCR
   * @param s3Key - S3 key of the image
   * @returns Array of OCR blocks with text, confidence, and bounding boxes
   */
  async detectText(s3Key: string): Promise<OCRBlock[]> {
    const { bucket, key } = parseS3Key(s3Key);

    logger.info('Detecting text with Rekognition', { s3Key, bucket, key });

    try {
      const command = new DetectTextCommand({
        Image: {
          S3Object: {
            Bucket: bucket,
            Name: key,
          },
        },
      });

      const response: DetectTextCommandOutput = await tracing.trace(
        'rekognition_detect_text',
        () => rekognitionClient.send(command),
        { bucket, key },
      );

      if (!response.TextDetections || response.TextDetections.length === 0) {
        logger.warn('No text detected in image', { s3Key });
        return [];
      }

      // Map Rekognition text detections to OCRBlock format
      const ocrBlocks: OCRBlock[] = response.TextDetections.filter(
        (detection) => detection.Type === 'LINE' || detection.Type === 'WORD',
      )
        .map((detection) => ({
          text: detection.DetectedText || '',
          confidence: (detection.Confidence || 0) / 100, // Convert to 0-1 range
          boundingBox: convertBoundingBox(detection.Geometry?.BoundingBox || {}),
          type: detection.Type as 'LINE' | 'WORD',
        }))
        .filter((block) => block.text.length > 0);

      logger.info('Text detection complete', {
        s3Key,
        blocksFound: ocrBlocks.length,
      });

      return ocrBlocks;
    } catch (error) {
      logger.error(
        'Failed to detect text',
        error instanceof Error ? error : new Error(String(error)),
        { s3Key },
      );
      throw new Error(
        `Rekognition text detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Detect labels in an image (used for holographic detection)
   * @param s3Key - S3 key of the image
   * @returns Rekognition labels response
   */
  async detectLabels(s3Key: string): Promise<DetectLabelsCommandOutput> {
    const { bucket, key } = parseS3Key(s3Key);

    logger.info('Detecting labels with Rekognition', { s3Key, bucket, key });

    try {
      const command = new DetectLabelsCommand({
        Image: {
          S3Object: {
            Bucket: bucket,
            Name: key,
          },
        },
        MaxLabels: 50,
        MinConfidence: 70,
      });

      const response = await tracing.trace(
        'rekognition_detect_labels',
        () => rekognitionClient.send(command),
        { bucket, key },
      );

      logger.info('Label detection complete', {
        s3Key,
        labelsFound: response.Labels?.length || 0,
      });

      return response;
    } catch (error) {
      logger.error(
        'Failed to detect labels',
        error instanceof Error ? error : new Error(String(error)),
        { s3Key },
      );
      throw new Error(
        `Rekognition label detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Download image from S3 for pixel-level analysis
   * @param s3Key - S3 key of the image
   * @returns Image buffer
   */
  async downloadImage(s3Key: string): Promise<Buffer> {
    const { bucket, key } = parseS3Key(s3Key);

    logger.info('Downloading image from S3', { s3Key, bucket, key });

    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await tracing.trace(
        's3_get_image_for_rekognition',
        () => s3Client.send(command),
        { bucket, key },
      );

      if (!response.Body) {
        throw new Error('Empty response body from S3');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as AsyncIterable<Uint8Array>;
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      logger.info('Image downloaded successfully', {
        s3Key,
        sizeBytes: buffer.length,
      });

      return buffer;
    } catch (error) {
      logger.error(
        'Failed to download image',
        error instanceof Error ? error : new Error(String(error)),
        { s3Key },
      );
      throw new Error(
        `S3 image download failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Extract complete feature envelope from an image
   * This is the main entry point that orchestrates all feature extraction
   * @param s3Key - S3 key of the image
   * @returns Complete FeatureEnvelope with all extracted features
   */
  async extractFeatures(s3Key: string): Promise<FeatureEnvelope> {
    logger.info('Starting feature extraction', { s3Key });

    try {
      // Run OCR and label detection in parallel
      const [ocrBlocks, labelsResponse, imageBuffer] = await Promise.all([
        this.detectText(s3Key),
        this.detectLabels(s3Key),
        this.downloadImage(s3Key),
      ]);

      // Extract visual features from image buffer
      const [borders, holoVariance, fontMetrics, quality, imageMeta] = await Promise.all([
        this.computeBorderMetrics(imageBuffer),
        this.computeHolographicVariance(imageBuffer, labelsResponse),
        this.extractFontMetrics(ocrBlocks),
        this.analyzeImageQuality(imageBuffer),
        this.extractImageMetadata(imageBuffer, s3Key),
      ]);

      const envelope: FeatureEnvelope = {
        ocr: ocrBlocks,
        borders,
        holoVariance,
        fontMetrics,
        quality,
        imageMeta,
      };

      logger.info('Feature extraction complete', {
        s3Key,
        ocrBlockCount: ocrBlocks.length,
        holoVariance,
        blurScore: quality.blurScore,
      });

      return envelope;
    } catch (error) {
      logger.error(
        'Feature extraction failed',
        error instanceof Error ? error : new Error(String(error)),
        { s3Key },
      );
      throw error;
    }
  }

  /**
   * Compute border metrics from image buffer
   * Analyzes border ratios and symmetry
   */
  private async computeBorderMetrics(imageBuffer: Buffer): Promise<BorderMetrics> {
    logger.debug('Computing border metrics');

    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      const { width = 0, height = 0 } = metadata;

      if (width === 0 || height === 0) {
        logger.warn('Invalid image dimensions for border analysis');
        return {
          topRatio: 0,
          bottomRatio: 0,
          leftRatio: 0,
          rightRatio: 0,
          symmetryScore: 0,
        };
      }

      // Get raw pixel data
      const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

      // Define border thickness as 5% of image dimensions
      const borderThickness = Math.floor(Math.min(width, height) * 0.05);

      // Analyze border regions
      const topBorder = this.analyzeBorderRegion(data, info, 0, 0, width, borderThickness);
      const bottomBorder = this.analyzeBorderRegion(
        data,
        info,
        0,
        height - borderThickness,
        width,
        borderThickness,
      );
      const leftBorder = this.analyzeBorderRegion(data, info, 0, 0, borderThickness, height);
      const rightBorder = this.analyzeBorderRegion(
        data,
        info,
        width - borderThickness,
        0,
        borderThickness,
        height,
      );

      // Calculate border ratios (normalized to 0-1)
      const topRatio = topBorder / 255;
      const bottomRatio = bottomBorder / 255;
      const leftRatio = leftBorder / 255;
      const rightRatio = rightBorder / 255;

      // Calculate symmetry score (how similar opposite borders are)
      const verticalSymmetry = 1 - Math.abs(topRatio - bottomRatio);
      const horizontalSymmetry = 1 - Math.abs(leftRatio - rightRatio);
      const symmetryScore = (verticalSymmetry + horizontalSymmetry) / 2;

      logger.debug('Border metrics computed', {
        topRatio,
        bottomRatio,
        leftRatio,
        rightRatio,
        symmetryScore,
      });

      return {
        topRatio,
        bottomRatio,
        leftRatio,
        rightRatio,
        symmetryScore,
      };
    } catch (error) {
      logger.error(
        'Failed to compute border metrics',
        error instanceof Error ? error : new Error(String(error)),
      );
      return {
        topRatio: 0,
        bottomRatio: 0,
        leftRatio: 0,
        rightRatio: 0,
        symmetryScore: 0,
      };
    }
  }

  /**
   * Analyze a specific border region and return average brightness
   */
  private analyzeBorderRegion(
    data: Buffer,
    info: { width: number; height: number; channels: number },
    x: number,
    y: number,
    regionWidth: number,
    regionHeight: number,
  ): number {
    const { width, channels } = info;
    let sum = 0;
    let count = 0;

    for (let row = y; row < y + regionHeight; row++) {
      for (let col = x; col < x + regionWidth; col++) {
        const idx = (row * width + col) * channels;
        // Average RGB values for brightness
        const brightness =
          channels >= 3 ? (data[idx] + data[idx + 1] + data[idx + 2]) / 3 : data[idx];
        sum += brightness;
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  /**
   * Compute holographic pixel variance
   * Analyzes holographic patterns and pixel variance
   */
  private async computeHolographicVariance(
    imageBuffer: Buffer,
    labelsResponse: DetectLabelsCommandOutput,
  ): Promise<number> {
    logger.debug('Computing holographic variance');

    try {
      // Check if Rekognition detected holographic-related labels
      const holoLabels = labelsResponse.Labels?.filter(
        (label) =>
          label.Name?.toLowerCase().includes('shiny') ||
          label.Name?.toLowerCase().includes('metallic') ||
          label.Name?.toLowerCase().includes('reflective') ||
          label.Name?.toLowerCase().includes('glossy'),
      );

      const hasHoloIndicators = (holoLabels?.length || 0) > 0;

      if (!hasHoloIndicators) {
        logger.debug('No holographic indicators detected');
        return 0;
      }

      // Analyze pixel variance in RGB channels
      const image = sharp(imageBuffer);
      const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

      const { width, height, channels } = info;

      if (channels < 3) {
        logger.warn('Image does not have RGB channels for holo analysis');
        return 0;
      }

      // Sample center region (holographic effects are typically in the center)
      const centerX = Math.floor(width * 0.25);
      const centerY = Math.floor(height * 0.25);
      const sampleWidth = Math.floor(width * 0.5);
      const sampleHeight = Math.floor(height * 0.5);

      const rgbValues: { r: number[]; g: number[]; b: number[] } = {
        r: [],
        g: [],
        b: [],
      };

      // Collect RGB values from center region
      for (let row = centerY; row < centerY + sampleHeight; row += 5) {
        for (let col = centerX; col < centerX + sampleWidth; col += 5) {
          const idx = (row * width + col) * channels;
          rgbValues.r.push(data[idx]);
          rgbValues.g.push(data[idx + 1]);
          rgbValues.b.push(data[idx + 2]);
        }
      }

      // Calculate variance for each channel
      const rVariance = this.calculateVariance(rgbValues.r);
      const gVariance = this.calculateVariance(rgbValues.g);
      const bVariance = this.calculateVariance(rgbValues.b);

      // Average variance across channels, normalized
      const avgVariance = (rVariance + gVariance + bVariance) / 3;
      const normalizedVariance = Math.min(avgVariance / 10000, 1); // Normalize to 0-1

      logger.debug('Holographic variance computed', {
        rVariance,
        gVariance,
        bVariance,
        normalizedVariance,
        holoLabelsFound: holoLabels?.length || 0,
      });

      return normalizedVariance;
    } catch (error) {
      logger.error(
        'Failed to compute holographic variance',
        error instanceof Error ? error : new Error(String(error)),
      );
      return 0;
    }
  }

  /**
   * Calculate variance of a numeric array
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

    return variance;
  }

  /**
   * Extract font metrics from OCR blocks
   * Analyzes kerning, alignment, and font size variance
   */
  private async extractFontMetrics(ocrBlocks: OCRBlock[]): Promise<FontMetrics> {
    logger.debug('Extracting font metrics', { blockCount: ocrBlocks.length });

    if (ocrBlocks.length === 0) {
      return {
        kerning: [],
        alignment: 0,
        fontSizeVariance: 0,
      };
    }

    try {
      // Filter for WORD-level blocks for kerning analysis
      const wordBlocks = ocrBlocks.filter((block) => block.type === 'WORD');

      // Calculate kerning (spacing between consecutive words)
      const kerning: number[] = [];
      for (let i = 0; i < wordBlocks.length - 1; i++) {
        const currentWord = wordBlocks[i];
        const nextWord = wordBlocks[i + 1];

        // Calculate horizontal distance between words
        const currentRight = currentWord.boundingBox.left + currentWord.boundingBox.width;
        const nextLeft = nextWord.boundingBox.left;
        const spacing = nextLeft - currentRight;

        kerning.push(spacing);
      }

      // Calculate alignment score (how well text aligns vertically)
      const lineBlocks = ocrBlocks.filter((block) => block.type === 'LINE');
      let alignment = 0;

      if (lineBlocks.length > 1) {
        // Check left edge alignment
        const leftEdges = lineBlocks.map((block) => block.boundingBox.left);
        const leftVariance = this.calculateVariance(leftEdges);

        // Check right edge alignment
        const rightEdges = lineBlocks.map(
          (block) => block.boundingBox.left + block.boundingBox.width,
        );
        const rightVariance = this.calculateVariance(rightEdges);

        // Lower variance = better alignment
        // Normalize to 0-1 scale (1 = perfect alignment)
        const avgVariance = (leftVariance + rightVariance) / 2;
        alignment = Math.max(0, 1 - avgVariance * 100);
      } else {
        alignment = 1; // Single line is perfectly aligned
      }

      // Calculate font size variance
      const heights = ocrBlocks.map((block) => block.boundingBox.height);
      const fontSizeVariance = heights.length > 0 ? this.calculateVariance(heights) : 0;

      logger.debug('Font metrics extracted', {
        kerningCount: kerning.length,
        alignment,
        fontSizeVariance,
      });

      return {
        kerning,
        alignment,
        fontSizeVariance,
      };
    } catch (error) {
      logger.error(
        'Failed to extract font metrics',
        error instanceof Error ? error : new Error(String(error)),
      );
      return {
        kerning: [],
        alignment: 0,
        fontSizeVariance: 0,
      };
    }
  }

  /**
   * Analyze image quality
   * Computes blur score, glare detection, and brightness
   */
  private async analyzeImageQuality(imageBuffer: Buffer): Promise<ImageQuality> {
    logger.debug('Analyzing image quality');

    try {
      const image = sharp(imageBuffer);
      const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

      const { width, height, channels } = info;

      // Calculate blur score using Laplacian variance method
      const blurScore = await this.calculateBlurScore(imageBuffer);

      // Detect glare by analyzing brightness distribution
      const brightnessValues: number[] = [];

      // Sample pixels across the image
      for (let row = 0; row < height; row += 10) {
        for (let col = 0; col < width; col += 10) {
          const idx = (row * width + col) * channels;
          const brightness =
            channels >= 3 ? (data[idx] + data[idx + 1] + data[idx + 2]) / 3 : data[idx];
          brightnessValues.push(brightness);
        }
      }

      // Calculate average brightness
      const avgBrightness =
        brightnessValues.reduce((sum, val) => sum + val, 0) / brightnessValues.length;

      // Detect glare: check for high brightness values (> 240) in significant portions
      const highBrightnessCount = brightnessValues.filter((val) => val > 240).length;
      const glareDetected = highBrightnessCount / brightnessValues.length > 0.15; // More than 15% very bright

      logger.debug('Image quality analyzed', {
        blurScore,
        glareDetected,
        brightness: avgBrightness,
      });

      return {
        blurScore,
        glareDetected,
        brightness: avgBrightness / 255, // Normalize to 0-1
      };
    } catch (error) {
      logger.error(
        'Failed to analyze image quality',
        error instanceof Error ? error : new Error(String(error)),
      );
      return {
        blurScore: 0,
        glareDetected: false,
        brightness: 0,
      };
    }
  }

  /**
   * Calculate blur score using Laplacian variance
   * Higher score = sharper image
   */
  private async calculateBlurScore(imageBuffer: Buffer): Promise<number> {
    try {
      // Convert to grayscale and get stats
      const stats = await sharp(imageBuffer).grayscale().stats();

      // Use standard deviation as a proxy for sharpness
      // Higher stdev = more edges = sharper image
      const stdev = stats.channels[0].stdev;

      // Normalize to 0-1 scale (typical range is 0-100)
      const blurScore = Math.min(stdev / 100, 1);

      return blurScore;
    } catch (error) {
      logger.error(
        'Failed to calculate blur score',
        error instanceof Error ? error : new Error(String(error)),
      );
      return 0;
    }
  }

  /**
   * Extract image metadata
   * Gets dimensions, format, and file size
   */
  private async extractImageMetadata(imageBuffer: Buffer, s3Key: string): Promise<ImageMetadata> {
    logger.debug('Extracting image metadata', { s3Key });

    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      const imageMeta: ImageMetadata = {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        sizeBytes: imageBuffer.length,
      };

      logger.debug('Image metadata extracted', imageMeta);

      return imageMeta;
    } catch (error) {
      logger.error(
        'Failed to extract image metadata',
        error instanceof Error ? error : new Error(String(error)),
        { s3Key },
      );
      return {
        width: 0,
        height: 0,
        format: 'unknown',
        sizeBytes: imageBuffer.length,
      };
    }
  }
}

// Export singleton instance
export const rekognitionAdapter = new RekognitionAdapter();
