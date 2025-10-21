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

// Lazy load sharp to avoid bundling issues in Lambdas that don't need it
type SharpModule = typeof import('sharp');
let sharpInstance: SharpModule | null = null;

async function getSharp(): Promise<SharpModule> {
  if (!sharpInstance) {
    const sharpModule = await import('sharp');
    sharpInstance = sharpModule.default as unknown as SharpModule;
  }
  return sharpInstance;
}

const rekognitionClient = tracing.captureAWSv3Client(
  new RekognitionClient({
    region: process.env.AWS_REGION || 'us-east-1',
  })
);

const s3Client = tracing.captureAWSv3Client(
  new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
  })
);

/**
 * Extract S3 bucket and key from S3 key string
 */
function parseS3Key(s3Key: string): { bucket: string; key: string } {
  const bucket = process.env.BUCKET_UPLOADS || '';
  return { bucket, key: s3Key };
}

/**
 * Check if file is HEIC/HEIF format based on S3 key
 */
function isHeicFormat(s3Key: string): boolean {
  const lowerKey = s3Key.toLowerCase();
  return lowerKey.endsWith('.heic') || lowerKey.endsWith('.heif');
}

/**
 * Convert HEIC/HEIF image to JPEG for Rekognition compatibility
 * Rekognition only supports JPEG and PNG formats
 */
async function convertHeicToJpeg(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const sharp = await getSharp();
    logger.info('Converting HEIC/HEIF to JPEG for Rekognition');

    // Convert to JPEG with high quality
    const jpegBuffer = await sharp(imageBuffer).jpeg({ quality: 95, mozjpeg: true }).toBuffer();

    logger.info('HEIC/HEIF conversion successful', {
      originalSize: imageBuffer.length,
      convertedSize: jpegBuffer.length,
    });

    return jpegBuffer;
  } catch (error) {
    logger.error('Failed to convert HEIC/HEIF to JPEG', error as Error);
    throw new Error(
      `HEIC conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
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
 * Card bounding box in pixel coordinates
 */
interface CardBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
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
      let command: DetectTextCommand;

      // Check if image is HEIC/HEIF format
      if (isHeicFormat(s3Key)) {
        logger.info('HEIC/HEIF detected, converting to JPEG for Rekognition', { s3Key });

        // Download image from S3
        const getObjectCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
        const s3Response = await s3Client.send(getObjectCommand);

        // Convert stream to buffer
        const chunks: Uint8Array[] = [];
        const stream = s3Response.Body as AsyncIterable<Uint8Array>;
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const imageBuffer = Buffer.concat(chunks);

        // Convert HEIC to JPEG
        const jpegBuffer = await convertHeicToJpeg(imageBuffer);

        // Use Bytes instead of S3Object
        command = new DetectTextCommand({
          Image: {
            Bytes: jpegBuffer,
          },
        });
      } else {
        // Use S3Object reference for JPEG/PNG
        command = new DetectTextCommand({
          Image: {
            S3Object: {
              Bucket: bucket,
              Name: key,
            },
          },
        });
      }

      const response: DetectTextCommandOutput = await tracing.trace(
        'rekognition_detect_text',
        () => rekognitionClient.send(command),
        { bucket, key }
      );

      if (!response.TextDetections || response.TextDetections.length === 0) {
        logger.warn('No text detected in image', { s3Key });
        return [];
      }

      // Map Rekognition text detections to OCRBlock format
      const ocrBlocks: OCRBlock[] = response.TextDetections.filter(
        (detection) => detection.Type === 'LINE' || detection.Type === 'WORD'
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
        { s3Key }
      );
      throw new Error(
        `Rekognition text detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      let command: DetectLabelsCommand;

      // Check if image is HEIC/HEIF format
      if (isHeicFormat(s3Key)) {
        logger.info('HEIC/HEIF detected, converting to JPEG for Rekognition', { s3Key });

        // Download image from S3
        const getObjectCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
        const s3Response = await s3Client.send(getObjectCommand);

        // Convert stream to buffer
        const chunks: Uint8Array[] = [];
        const stream = s3Response.Body as AsyncIterable<Uint8Array>;
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const imageBuffer = Buffer.concat(chunks);

        // Convert HEIC to JPEG
        const jpegBuffer = await convertHeicToJpeg(imageBuffer);

        // Use Bytes instead of S3Object
        command = new DetectLabelsCommand({
          Image: {
            Bytes: jpegBuffer,
          },
          MaxLabels: 50,
          MinConfidence: 70,
        });
      } else {
        // Use S3Object reference for JPEG/PNG
        command = new DetectLabelsCommand({
          Image: {
            S3Object: {
              Bucket: bucket,
              Name: key,
            },
          },
          MaxLabels: 50,
          MinConfidence: 70,
        });
      }

      const response = await tracing.trace(
        'rekognition_detect_labels',
        () => rekognitionClient.send(command),
        { bucket, key }
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
        { s3Key }
      );
      throw new Error(
        `Rekognition label detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Detect card boundaries in the image
   * Uses label detection to find rectangular objects that likely represent the card
   * @param imageBuffer - Image buffer to analyze
   * @param metadata - Image metadata with dimensions
   * @returns Card bounding box in pixel coordinates, or null if card not detected
   */
  private async detectCardBoundaries(
    imageBuffer: Buffer,
    metadata: { width: number; height: number }
  ): Promise<CardBoundingBox | null> {
    logger.debug('Detecting card boundaries');

    try {
      const sharp = await getSharp();
      const image = sharp(imageBuffer);
      const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
      const { width, height, channels } = info;

      if (channels < 3) {
        logger.warn('Image does not have RGB channels for edge detection');
        return null;
      }

      // Convert to grayscale for edge detection
      const grayscale: number[] = [];
      for (let i = 0; i < data.length; i += channels) {
        const gray = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
        grayscale.push(gray);
      }

      // Simple edge detection using gradient magnitude
      const edges: number[] = new Array(grayscale.length).fill(0);
      const threshold = 30; // Edge detection threshold

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;

          // Sobel operator for gradient
          const gx =
            -grayscale[idx - width - 1] +
            grayscale[idx - width + 1] -
            2 * grayscale[idx - 1] +
            2 * grayscale[idx + 1] -
            grayscale[idx + width - 1] +
            grayscale[idx + width + 1];

          const gy =
            -grayscale[idx - width - 1] -
            2 * grayscale[idx - width] -
            grayscale[idx - width + 1] +
            grayscale[idx + width - 1] +
            2 * grayscale[idx + width] +
            grayscale[idx + width + 1];

          const magnitude = Math.sqrt(gx * gx + gy * gy);
          edges[idx] = magnitude > threshold ? 255 : 0;
        }
      }

      // Find bounding box of edge pixels
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      let edgeCount = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (edges[idx] > 0) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            edgeCount++;
          }
        }
      }

      // Check if we found enough edges to constitute a card
      const edgeRatio = edgeCount / (width * height);
      if (edgeRatio < 0.01 || edgeRatio > 0.5) {
        logger.warn('Edge detection failed: unusual edge ratio', { edgeRatio });
        return null;
      }

      // Add padding to ensure we capture the full card (5% on each side)
      const paddingX = Math.floor((maxX - minX) * 0.05);
      const paddingY = Math.floor((maxY - minY) * 0.05);

      const cardBox: CardBoundingBox = {
        x: Math.max(0, minX - paddingX),
        y: Math.max(0, minY - paddingY),
        width: Math.min(width - (minX - paddingX), maxX - minX + 2 * paddingX),
        height: Math.min(height - (minY - paddingY), maxY - minY + 2 * paddingY),
      };

      // Validate aspect ratio (trading cards are typically 2.5:3.5 ratio, ~0.71)
      const aspectRatio = cardBox.width / cardBox.height;
      if (aspectRatio < 0.5 || aspectRatio > 1.0) {
        logger.warn('Detected card has unusual aspect ratio', { aspectRatio });
        // Still return it, but log the warning
      }

      logger.info('Card boundaries detected', {
        cardBox,
        aspectRatio,
        edgeRatio,
        coveragePercent: ((cardBox.width * cardBox.height) / (width * height)) * 100,
      });

      return cardBox;
    } catch (error) {
      logger.error(
        'Failed to detect card boundaries',
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Crop image to card boundaries
   * @param imageBuffer - Original image buffer
   * @param cardBox - Card bounding box in pixel coordinates
   * @returns Cropped image buffer
   */
  private async cropToCard(imageBuffer: Buffer, cardBox: CardBoundingBox): Promise<Buffer> {
    logger.debug('Cropping image to card boundaries', { cardBox });

    try {
      const sharp = await getSharp();
      const croppedBuffer = await sharp(imageBuffer)
        .extract({
          left: cardBox.x,
          top: cardBox.y,
          width: cardBox.width,
          height: cardBox.height,
        })
        .toBuffer();

      logger.info('Image cropped to card', {
        originalSize: imageBuffer.length,
        croppedSize: croppedBuffer.length,
      });

      return croppedBuffer;
    } catch (error) {
      logger.error(
        'Failed to crop image',
        error instanceof Error ? error : new Error(String(error))
      );
      // Return original buffer if cropping fails
      return imageBuffer;
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
        { bucket, key }
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
        { s3Key }
      );
      throw new Error(
        `S3 image download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      // Step 1: Download image first for card detection
      const imageBuffer = await this.downloadImage(s3Key);

      // Step 2: Get image metadata for card detection
      const sharp = await getSharp();
      const metadata = await sharp(imageBuffer).metadata();
      const { width = 0, height = 0 } = metadata;

      // Step 3: Detect card boundaries in the image
      logger.info('Detecting card boundaries before feature extraction');
      const cardBox = await this.detectCardBoundaries(imageBuffer, { width, height });

      // Step 4: Crop to card if detected, otherwise use full image
      let processedBuffer = imageBuffer;
      if (cardBox) {
        logger.info('Card detected, cropping to card boundaries', { cardBox });
        processedBuffer = await this.cropToCard(imageBuffer, cardBox);
      } else {
        logger.warn('Card boundaries not detected, using full image for analysis');
      }

      // Step 5: Run OCR and label detection on the original image (for better text detection)
      // But use cropped image for visual analysis
      const [ocrBlocks, labelsResponse] = await Promise.all([
        this.detectText(s3Key),
        this.detectLabels(s3Key),
      ]);

      // Step 6: Extract visual features from cropped/processed image buffer
      const [borders, holoVariance, fontMetrics, quality, imageMeta] = await Promise.all([
        this.computeBorderMetrics(processedBuffer),
        this.computeHolographicVariance(processedBuffer, labelsResponse),
        this.extractFontMetrics(ocrBlocks),
        this.analyzeImageQuality(processedBuffer),
        this.extractImageMetadata(processedBuffer, s3Key),
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
        cardDetected: !!cardBox,
        ocrBlockCount: ocrBlocks.length,
        holoVariance,
        blurScore: quality.blurScore,
      });

      return envelope;
    } catch (error) {
      logger.error(
        'Feature extraction failed',
        error instanceof Error ? error : new Error(String(error)),
        { s3Key }
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
      const sharp = await getSharp();
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
        borderThickness
      );
      const leftBorder = this.analyzeBorderRegion(data, info, 0, 0, borderThickness, height);
      const rightBorder = this.analyzeBorderRegion(
        data,
        info,
        width - borderThickness,
        0,
        borderThickness,
        height
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
        error instanceof Error ? error : new Error(String(error))
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
    regionHeight: number
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
    labelsResponse: DetectLabelsCommandOutput
  ): Promise<number> {
    logger.debug('Computing holographic variance');

    try {
      // Check if Rekognition detected holographic-related labels
      const holoLabels = labelsResponse.Labels?.filter(
        (label) =>
          label.Name?.toLowerCase().includes('shiny') ||
          label.Name?.toLowerCase().includes('metallic') ||
          label.Name?.toLowerCase().includes('reflective') ||
          label.Name?.toLowerCase().includes('glossy')
      );

      const hasHoloIndicators = (holoLabels?.length || 0) > 0;

      if (!hasHoloIndicators) {
        logger.debug('No holographic indicators detected');
        return 0;
      }

      // Analyze pixel variance in RGB channels
      const sharp = await getSharp();
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
        error instanceof Error ? error : new Error(String(error))
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
          (block) => block.boundingBox.left + block.boundingBox.width
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
        error instanceof Error ? error : new Error(String(error))
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
      const sharp = await getSharp();
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
        error instanceof Error ? error : new Error(String(error))
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
      const sharp = await getSharp();
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
        error instanceof Error ? error : new Error(String(error))
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
      const sharp = await getSharp();
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
        { s3Key }
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
