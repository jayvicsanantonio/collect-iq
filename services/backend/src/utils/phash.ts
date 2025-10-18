/**
 * Perceptual Hash (pHash) Utility
 * Implements perceptual hashing algorithm for image similarity detection
 * Used for authenticity verification by comparing card images to reference samples
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as sharpModule from 'sharp';
const sharp = sharpModule.default;
import { logger } from './logger.js';
import { tracing } from './tracing.js';

const s3Client = tracing.captureAWSv3Client(
  new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
  }),
);

/**
 * Download image from S3
 * @param s3Key - S3 key of the image
 * @param bucket - Optional bucket name (defaults to BUCKET_UPLOADS)
 * @returns Image buffer
 */
async function downloadImageFromS3(s3Key: string, bucket?: string): Promise<Buffer> {
  const bucketName = bucket || process.env.BUCKET_UPLOADS || '';

  logger.debug('Downloading image for pHash computation', { s3Key, bucket: bucketName });

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    const response = await tracing.trace('s3_get_phash_source', () => s3Client.send(command), {
      bucket: bucketName,
      key: s3Key,
    });

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

    logger.debug('Image downloaded for pHash', {
      s3Key,
      sizeBytes: buffer.length,
    });

    return buffer;
  } catch (error) {
    logger.error(
      'Failed to download image for pHash',
      error instanceof Error ? error : new Error(String(error)),
      { s3Key, bucket: bucketName },
    );
    throw new Error(
      `S3 image download failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Compute Discrete Cosine Transform (DCT) for a matrix
 * Used in perceptual hashing algorithm
 * @param matrix - 2D array of pixel values
 * @returns DCT coefficients
 */
function computeDCT(matrix: number[][]): number[][] {
  const size = matrix.length;
  const dct: number[][] = Array(size)
    .fill(0)
    .map(() => Array(size).fill(0));

  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let sum = 0;

      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          sum +=
            matrix[x][y] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size));
        }
      }

      // Apply normalization factors
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;

      dct[u][v] = (2 / size) * cu * cv * sum;
    }
  }

  return dct;
}

/**
 * Compute perceptual hash (pHash) for an image
 * Algorithm:
 * 1. Resize image to 32x32 pixels
 * 2. Convert to grayscale
 * 3. Compute DCT (Discrete Cosine Transform)
 * 4. Extract top-left 8x8 DCT coefficients (low frequencies)
 * 5. Compute median of these coefficients
 * 6. Generate binary hash: 1 if coefficient > median, 0 otherwise
 * 7. Convert binary to hexadecimal string
 *
 * @param imageBuffer - Image buffer to hash
 * @returns Hexadecimal hash string (16 characters representing 64 bits)
 */
export async function computePerceptualHash(imageBuffer: Buffer): Promise<string> {
  logger.debug('Computing perceptual hash');

  try {
    // Step 1 & 2: Resize to 32x32 and convert to grayscale
    const resized = await sharp(imageBuffer)
      .resize(32, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = resized;
    const { width, height } = info;

    // Convert buffer to 2D matrix
    const matrix: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(data[y * width + x]);
      }
      matrix.push(row);
    }

    // Step 3: Compute DCT
    const dct = computeDCT(matrix);

    // Step 4: Extract top-left 8x8 coefficients (excluding DC component at [0,0])
    const coefficients: number[] = [];
    for (let u = 0; u < 8; u++) {
      for (let v = 0; v < 8; v++) {
        if (u === 0 && v === 0) continue; // Skip DC component
        coefficients.push(dct[u][v]);
      }
    }

    // Step 5: Compute median
    const sorted = [...coefficients].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Step 6: Generate binary hash
    const binaryHash: number[] = [];
    for (let u = 0; u < 8; u++) {
      for (let v = 0; v < 8; v++) {
        if (u === 0 && v === 0) continue; // Skip DC component
        binaryHash.push(dct[u][v] > median ? 1 : 0);
      }
    }

    // Step 7: Convert binary to hexadecimal
    let hexHash = '';
    for (let i = 0; i < binaryHash.length; i += 4) {
      const nibble =
        binaryHash[i] * 8 + binaryHash[i + 1] * 4 + binaryHash[i + 2] * 2 + binaryHash[i + 3];
      hexHash += nibble.toString(16);
    }

    logger.debug('Perceptual hash computed', { hash: hexHash });

    return hexHash;
  } catch (error) {
    logger.error(
      'Failed to compute perceptual hash',
      error instanceof Error ? error : new Error(String(error)),
    );
    throw new Error(
      `Perceptual hash computation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Compute perceptual hash from S3 image
 * @param s3Key - S3 key of the image
 * @param bucket - Optional bucket name (defaults to BUCKET_UPLOADS)
 * @returns Hexadecimal hash string
 */
export async function computePerceptualHashFromS3(s3Key: string, bucket?: string): Promise<string> {
  logger.info('Computing perceptual hash from S3 image', { s3Key });

  try {
    const imageBuffer = await downloadImageFromS3(s3Key, bucket);
    const hash = await computePerceptualHash(imageBuffer);

    logger.info('Perceptual hash computed from S3', { s3Key, hash });

    return hash;
  } catch (error) {
    logger.error(
      'Failed to compute perceptual hash from S3',
      error instanceof Error ? error : new Error(String(error)),
      { s3Key },
    );
    throw error;
  }
}

/**
 * Calculate Hamming distance between two hash strings
 * Hamming distance is the number of positions at which the corresponding bits differ
 * Used to measure similarity between two perceptual hashes
 *
 * @param hash1 - First hexadecimal hash string
 * @param hash2 - Second hexadecimal hash string
 * @returns Hamming distance (0 = identical, higher = more different)
 */
export function calculateHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hash strings must be of equal length');
  }

  let distance = 0;

  for (let i = 0; i < hash1.length; i++) {
    const nibble1 = parseInt(hash1[i], 16);
    const nibble2 = parseInt(hash2[i], 16);

    // XOR to find differing bits
    const xor = nibble1 ^ nibble2;

    // Count set bits in XOR result
    let bits = xor;
    while (bits > 0) {
      distance += bits & 1;
      bits >>= 1;
    }
  }

  return distance;
}

/**
 * Calculate similarity score from Hamming distance
 * Converts Hamming distance to a 0-1 similarity score
 *
 * @param hammingDistance - Hamming distance between two hashes
 * @param maxDistance - Maximum possible distance (default 64 for 64-bit hash)
 * @returns Similarity score (0 = completely different, 1 = identical)
 */
export function calculateSimilarityScore(
  hammingDistance: number,
  maxDistance: number = 64,
): number {
  return Math.max(0, 1 - hammingDistance / maxDistance);
}
