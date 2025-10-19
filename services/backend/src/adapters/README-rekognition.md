# Rekognition Adapter

## Overview

The Rekognition Adapter provides comprehensive image analysis capabilities for Pokémon TCG card authentication and identification. It integrates AWS Rekognition for OCR and label detection, combined with custom image processing algorithms for visual feature extraction.

## Features

### 1. Text Detection (OCR)

- Extracts text blocks from card images using AWS Rekognition
- Returns structured OCRBlock objects with:
  - Detected text content
  - Confidence scores (normalized to 0-1 range)
  - Bounding box coordinates
  - Block type (LINE or WORD)

### 2. Visual Feature Extraction

#### Border Metrics

- Analyzes border regions (top, bottom, left, right)
- Computes border ratios based on brightness
- Calculates symmetry score for authenticity verification
- Uses 5% of image dimensions for border thickness

#### Holographic Analysis

- Detects holographic patterns using Rekognition labels
- Computes pixel variance in RGB channels
- Samples center region (50% of image)
- Returns normalized variance score (0-1)

#### Font Metrics

- Extracts kerning (spacing between words)
- Calculates text alignment score
- Measures font size variance
- Useful for detecting counterfeit cards with inconsistent typography

#### Image Quality

- Computes blur score using Laplacian variance method
- Detects glare (>15% of pixels with brightness >240)
- Measures overall brightness
- All metrics normalized to 0-1 range

### 3. Image Metadata

- Extracts dimensions (width, height)
- Identifies format (jpeg, png, heic, etc.)
- Records file size in bytes

## Usage

```typescript
import { rekognitionAdapter } from './adapters/rekognition-adapter.js';

// Extract complete feature envelope
const features = await rekognitionAdapter.extractFeatures('uploads/user123/card.jpg');

// Individual operations
const ocrBlocks = await rekognitionAdapter.detectText('uploads/user123/card.jpg');
const labels = await rekognitionAdapter.detectLabels('uploads/user123/card.jpg');
const imageBuffer = await rekognitionAdapter.downloadImage('uploads/user123/card.jpg');
```

## FeatureEnvelope Structure

```typescript
{
  ocr: OCRBlock[],              // Text detections
  borders: BorderMetrics,        // Border analysis
  holoVariance: number,          // Holographic pattern variance
  fontMetrics: FontMetrics,      // Typography analysis
  quality: ImageQuality,         // Image quality metrics
  imageMeta: ImageMetadata       // Image metadata
}
```

## Dependencies

- `@aws-sdk/client-rekognition` - AWS Rekognition integration
- `@aws-sdk/client-s3` - S3 image download
- `sharp` - Image processing library
- `@collectiq/shared` - Shared types and schemas

## Environment Variables

- `AWS_REGION` - AWS region for Rekognition and S3 (default: us-east-1)
- `BUCKET_UPLOADS` - S3 bucket name for card images

## Error Handling

All methods include comprehensive error handling:

- Logs errors with structured context
- Returns safe default values on failure
- Throws descriptive errors for critical failures
- Never exposes PII in logs

## Testing

Unit tests cover:

- Variance calculation
- Border region analysis
- Helper functions (S3 key parsing, bounding box conversion)

Integration tests with actual AWS services should be implemented separately with proper mocking.

## Performance Considerations

- Parallel execution of OCR, label detection, and image download
- Parallel execution of all feature extraction methods
- In-memory image processing (no disk I/O)
- Efficient pixel sampling for holographic analysis (every 5th pixel)

## Future Enhancements

1. Perceptual hashing (pHash) for visual fingerprinting
2. Reference hash comparison for authenticity verification
3. Advanced edge detection for border analysis
4. Machine learning model integration for card identification
5. Multi-angle holographic analysis
