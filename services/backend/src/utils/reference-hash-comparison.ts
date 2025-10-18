/**
 * Reference Hash Comparison Utility
 * Compares computed perceptual hashes against authentic reference samples
 * Used for authenticity verification
 */

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { logger } from './logger.js';
import { tracing } from './tracing.js';
import { calculateHammingDistance, calculateSimilarityScore } from './phash.js';

const s3Client = tracing.captureAWSv3Client(
  new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
  }),
);

/**
 * Reference hash entry structure
 */
interface ReferenceHash {
  cardName: string;
  hash: string;
  variant?: string;
  set?: string;
}

/**
 * Comparison result structure
 */
interface HashComparisonResult {
  cardName: string;
  hammingDistance: number;
  similarityScore: number;
  variant?: string;
  set?: string;
}

/**
 * Load reference hashes from S3 for a specific card
 * Reference hashes are stored in S3 at: authentic-samples/{cardName}/{hash}.json
 *
 * @param cardName - Name of the card to load references for
 * @param bucket - Optional bucket name (defaults to BUCKET_UPLOADS)
 * @returns Array of reference hashes
 */
export async function loadReferenceHashes(
  cardName: string,
  bucket?: string,
): Promise<ReferenceHash[]> {
  const bucketName = bucket || process.env.BUCKET_UPLOADS || '';
  const prefix = `authentic-samples/${encodeURIComponent(cardName)}/`;

  logger.debug('Loading reference hashes from S3', { cardName, prefix, bucket: bucketName });

  try {
    // List all reference hash files for this card
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    });

    const listResponse = await tracing.trace(
      's3_list_reference_hashes',
      () => s3Client.send(listCommand),
      { prefix, bucket: bucketName },
    );

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      logger.warn('No reference hashes found for card', { cardName, prefix });
      return [];
    }

    // Load each reference hash file
    const referenceHashes: ReferenceHash[] = [];

    for (const object of listResponse.Contents) {
      if (!object.Key) continue;

      try {
        const getCommand = new GetObjectCommand({
          Bucket: bucketName,
          Key: object.Key,
        });

        const response = await tracing.trace(
          's3_get_reference_hash',
          () => s3Client.send(getCommand),
          { key: object.Key, bucket: bucketName },
        );

        if (!response.Body) {
          logger.warn('Empty reference hash file', { key: object.Key });
          continue;
        }

        // Convert stream to string
        const chunks: Uint8Array[] = [];
        const stream = response.Body as AsyncIterable<Uint8Array>;
        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        const content = Buffer.concat(chunks).toString('utf-8');
        const referenceData = JSON.parse(content) as ReferenceHash;

        referenceHashes.push(referenceData);
      } catch (error) {
        logger.warn('Failed to load reference hash file', {
          key: object.Key,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue loading other files
      }
    }

    logger.info('Reference hashes loaded', {
      cardName,
      count: referenceHashes.length,
    });

    return referenceHashes;
  } catch (error) {
    logger.error(
      'Failed to load reference hashes',
      error instanceof Error ? error : new Error(String(error)),
      { cardName, prefix },
    );
    // Return empty array instead of throwing - allows graceful degradation
    return [];
  }
}

/**
 * Compare a computed hash against reference hashes
 * Finds the best match and returns similarity score
 *
 * @param computedHash - The perceptual hash computed from the card image
 * @param referenceHashes - Array of reference hashes to compare against
 * @returns Best match result with similarity score
 */
export function compareWithReferenceHashes(
  computedHash: string,
  referenceHashes: ReferenceHash[],
): HashComparisonResult | null {
  if (referenceHashes.length === 0) {
    logger.warn('No reference hashes provided for comparison');
    return null;
  }

  logger.debug('Comparing hash with references', {
    computedHash,
    referenceCount: referenceHashes.length,
  });

  const comparisons: HashComparisonResult[] = [];

  for (const reference of referenceHashes) {
    try {
      const hammingDistance = calculateHammingDistance(computedHash, reference.hash);
      const similarityScore = calculateSimilarityScore(hammingDistance);

      comparisons.push({
        cardName: reference.cardName,
        hammingDistance,
        similarityScore,
        variant: reference.variant,
        set: reference.set,
      });
    } catch (error) {
      logger.warn('Failed to compare with reference hash', {
        referenceCardName: reference.cardName,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue with other comparisons
    }
  }

  if (comparisons.length === 0) {
    logger.warn('No valid comparisons could be made');
    return null;
  }

  // Find best match (highest similarity score / lowest Hamming distance)
  const bestMatch = comparisons.reduce((best, current) =>
    current.similarityScore > best.similarityScore ? current : best,
  );

  logger.info('Best reference match found', {
    cardName: bestMatch.cardName,
    hammingDistance: bestMatch.hammingDistance,
    similarityScore: bestMatch.similarityScore,
  });

  return bestMatch;
}

/**
 * Compute visual hash confidence score
 * Loads reference hashes and compares the computed hash
 *
 * @param computedHash - The perceptual hash computed from the card image
 * @param cardName - Name of the card (used to load reference hashes)
 * @param bucket - Optional bucket name (defaults to BUCKET_UPLOADS)
 * @returns Confidence score (0-1), or 0 if no references found
 */
export async function computeVisualHashConfidence(
  computedHash: string,
  cardName: string,
  bucket?: string,
): Promise<number> {
  logger.info('Computing visual hash confidence', { cardName, computedHash });

  try {
    // Load reference hashes for this card
    const referenceHashes = await loadReferenceHashes(cardName, bucket);

    if (referenceHashes.length === 0) {
      logger.warn('No reference hashes available for comparison', { cardName });
      // Return neutral confidence when no references available
      return 0.5;
    }

    // Compare with reference hashes
    const bestMatch = compareWithReferenceHashes(computedHash, referenceHashes);

    if (!bestMatch) {
      logger.warn('No valid comparison result', { cardName });
      return 0.5;
    }

    // Return similarity score as confidence
    const confidence = bestMatch.similarityScore;

    logger.info('Visual hash confidence computed', {
      cardName,
      confidence,
      hammingDistance: bestMatch.hammingDistance,
    });

    return confidence;
  } catch (error) {
    logger.error(
      'Failed to compute visual hash confidence',
      error instanceof Error ? error : new Error(String(error)),
      { cardName, computedHash },
    );
    // Return neutral confidence on error
    return 0.5;
  }
}

/**
 * Batch compare multiple hashes against references
 * Useful for comparing front and back images
 *
 * @param computedHashes - Array of computed hashes to compare
 * @param cardName - Name of the card
 * @param bucket - Optional bucket name
 * @returns Average confidence score across all hashes
 */
export async function computeAverageVisualHashConfidence(
  computedHashes: string[],
  cardName: string,
  bucket?: string,
): Promise<number> {
  if (computedHashes.length === 0) {
    logger.warn('No hashes provided for batch comparison');
    return 0.5;
  }

  logger.info('Computing average visual hash confidence', {
    cardName,
    hashCount: computedHashes.length,
  });

  try {
    // Load reference hashes once
    const referenceHashes = await loadReferenceHashes(cardName, bucket);

    if (referenceHashes.length === 0) {
      logger.warn('No reference hashes available for batch comparison', { cardName });
      return 0.5;
    }

    // Compare each hash
    const confidenceScores: number[] = [];

    for (const hash of computedHashes) {
      const bestMatch = compareWithReferenceHashes(hash, referenceHashes);
      if (bestMatch) {
        confidenceScores.push(bestMatch.similarityScore);
      }
    }

    if (confidenceScores.length === 0) {
      logger.warn('No valid comparisons in batch', { cardName });
      return 0.5;
    }

    // Calculate average confidence
    const avgConfidence =
      confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;

    logger.info('Average visual hash confidence computed', {
      cardName,
      avgConfidence,
      validComparisons: confidenceScores.length,
    });

    return avgConfidence;
  } catch (error) {
    logger.error(
      'Failed to compute average visual hash confidence',
      error instanceof Error ? error : new Error(String(error)),
      { cardName },
    );
    return 0.5;
  }
}
