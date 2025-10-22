# Rekognition Extract: Complete Technical Documentation

## Executive Summary

The Rekognition Extract component is the foundational computer vision layer of CollectIQ's card processing pipeline. It transforms raw card images into structured feature envelopes containing OCR text, visual metrics, and quality assessments using AWS Rekognition and custom image processing algorithms. This component serves as the critical first step that enables all downstream AI agents to perform intelligent analysis.

**Key Capabilities:**

- OCR text detection with confidence scores and bounding boxes
- Card boundary detection and automatic cropping
- Holographic pattern analysis using pixel variance
- Border symmetry and consistency measurement
- Font metrics extraction (kerning, alignment, size variance)
- Image quality assessment (blur detection, glare detection, brightness)
- Parallel processing of front and back card images

**Output:**

- Complete FeatureEnvelope with 6 feature categories
- OCR blocks with spatial positioning
- Visual metrics (0.0-1.0 normalized scores)
- Image metadata (dimensions, format, size)
- Quality indicators for downstream filtering

---

## Architecture Overview

### System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Step Functions Workflow                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Rekognition Extract Lambda                      │
│                                                                   │
│  Input:                                                           │
│  • User ID, Card ID, Request ID                                  │
│  • S3 Keys (front image, optional back image)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
```

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Image Download from S3 │
│ │
│ 1. Parse S3 key and bucket │
│ • Bucket: BUCKET_UPLOADS environment variable │
│ • Key: Provided by Step Functions │
│ │
│ 2. Download image using S3 GetObject │
│ • Stream to buffer conversion │
│ • Size validation │
│ │
│ 3. Load image metadata with Sharp │
│ • Width and height │
│ • Format (JPEG, PNG, etc.) │
│ • Channel count (RGB, RGBA) │
│ │
│ Output: Image buffer + metadata │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Card Boundary Detection │
│ │
│ 1. Convert image to grayscale │
│ • Average RGB channels │
│ • Prepare for edge detection │
│ │
│ 2. Apply Sobel edge detection │
│ • Compute horizontal gradient (Gx) │
│ • Compute vertical gradient (Gy) │
│ • Calculate gradient magnitude: √(Gx² + Gy²) │
│ • Threshold: magnitude > 30 = edge │
│ │
│ 3. Find bounding box of edges │
│ • Locate min/max X and Y coordinates │
│ • Validate edge density (1-50% of image) │
│ • Add 5% padding on each side │
│ │
│ 4. Validate aspect ratio │
│ • Trading cards: ~0.71 (2.5:3.5 ratio) │
│ • Accept range: 0.5-1.0 │
│ • Log warning if unusual │
│ │
│ 5. Crop image to card boundaries │
│ • Extract region using Sharp │
│ • Fallback to full image if detection fails │
│ │
│ Output: Cropped image buffer (or original if detection failed) │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: AWS Rekognition Analysis │
│ │
│ Parallel execution of two Rekognition APIs: │
│ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ DetectText API │ │
│ │ • Analyzes original S3 image │ │
│ │ • Detects text blocks (LINE and WORD types) │ │
│ │ • Returns text, confidence, bounding boxes │ │
│ │ • Filters empty text blocks │ │
│ │ │ │
│ │ Output: OCRBlock[] │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ DetectLabels API │ │
│ │ • Analyzes original S3 image │ │
│ │ • Detects objects and attributes │ │
│ │ • MaxLabels: 50 │ │
│ │ • MinConfidence: 70% │ │
│ │ • Used for holographic detection │ │
│ │ │ │
│ │ Output: DetectLabelsCommandOutput │ │
│ └─────────────────────────────────────────────────────┘ │
│ │
│ Why use original image? │
│ • Better text detection (full context) │
│ • Cropping may cut off text │
│ • Rekognition optimized for full images │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: Visual Feature Extraction │
│ │
│ Parallel execution of 5 feature extraction algorithms: │
│ │
│ 1. Border Metrics │
│ • Analyze 5% border regions (top, bottom, left, right) │
│ • Calculate average brightness per region │
│ • Compute symmetry score (opposite borders similarity) │
│ • Normalize to 0-1 scale │
│ │
│ 2. Holographic Variance │
│ • Check Rekognition labels for holo indicators │
│ • Sample center 50% of image (5-pixel intervals) │
│ • Calculate RGB channel variance │
│ • Average and normalize to 0-1 │
│ │
│ 3. Font Metrics │
│ • Calculate kerning (word spacing) │
│ • Measure alignment (left/right edge variance) │
│ • Compute font size variance (height differences) │
│ │
│ 4. Image Quality │
│ • Blur score (Laplacian variance / stdev) │
│ • Glare detection (>15% pixels > 240 brightness) │
│ • Average brightness calculation │
│ │
│ 5. Image Metadata │
│ • Width and height (pixels) │
│ • Format (JPEG, PNG, etc.) │
│ • File size (bytes) │
│ │
│ All features use cropped image except OCR (uses original) │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: Feature Envelope Assembly │
│ │
│ Combine all extracted features into FeatureEnvelope: │
│ │
│ { │
│ ocr: OCRBlock[], // Text blocks with positions │
│ borders: BorderMetrics, // Border analysis │
│ holoVariance: number, // Holographic strength │
│ fontMetrics: FontMetrics, // Typography analysis │
│ quality: ImageQuality, // Blur, glare, brightness │
│ imageMeta: ImageMetadata // Dimensions, format, size │
│ } │
│ │
│ Log summary statistics for monitoring │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 6: Back Image Processing (Optional) │
│ │
│ If back image S3 key provided: │
│ • Repeat Phases 1-5 for back image │
│ • Generate separate FeatureEnvelope │
│ • Include in output as backFeatures │
│ │
│ If no back image: │
│ • Skip back processing │
│ • Log info message │
│ • Return only front features │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ Return to Step Functions │
│ │
│ RekognitionExtractOutput: │
│ • features: FeatureEnvelope (front) │
│ • backFeatures?: FeatureEnvelope (optional) │
│ • requestId: string │
│ │
│ Next Steps: │
│ • OCR Reasoning Agent uses features for AI interpretation │
│ • Pricing Agent uses metadata for card identification │
│ • Authenticity Agent uses all features for verification │
└─────────────────────────────────────────────────────────────────┘

```

---

## Detailed Component Analysis

### 1. Card Boundary Detection

#### Purpose
Automatically detect and crop to the card within the image, removing background noise.

#### Sobel Edge Detection Algorithm

**Mathematical Foundation:**

The Sobel operator computes the gradient of image intensity at each pixel:

```

Gx = [-1 0 +1] Gy = [-1 -2 -1]
[-2 0 +2] [ 0 0 0]
[-1 0 +1] [+1 +2 +1]

Gradient Magnitude = √(Gx² + Gy²)

````

**Implementation:**
```typescript
// For each pixel (x, y)
const gx =
  -grayscale[idx - width - 1] + grayscale[idx - width + 1] +
  -2 * grayscale[idx - 1] + 2 * grayscale[idx + 1] +
  -grayscale[idx + width - 1] + grayscale[idx + width + 1];

const gy =
  -grayscale[idx - width - 1] - 2 * grayscale[idx - width] - grayscale[idx - width + 1] +
  grayscale[idx + width - 1] + 2 * grayscale[idx + width] + grayscale[idx + width + 1];

const magnitude = Math.sqrt(gx * gx + gy * gy);
const isEdge = magnitude > 30;  // Threshold
````

**Why Sobel?**

- **Fast:** Simple convolution operation
- **Effective:** Detects edges in both directions
- **Robust:** Works well with card edges
- **Standard:** Industry-proven algorithm

**Edge Density Validation:**

```typescript
const edgeRatio = edgeCount / (width * height);

if (edgeRatio < 0.01) {
  // Too few edges - likely solid color image
  return null;
}

if (edgeRatio > 0.5) {
  // Too many edges - likely noisy/complex image
  return null;
}
```

**Aspect Ratio Validation:**

```typescript
const aspectRatio = cardBox.width / cardBox.height;

// Trading cards: 2.5" × 3.5" = 0.714 ratio
// Accept range: 0.5 - 1.0 (allows for perspective distortion)

if (aspectRatio < 0.5 || aspectRatio > 1.0) {
  logger.warn('Unusual aspect ratio', { aspectRatio });
  // Still return it, but log warning
}
```

**Padding Strategy:**

```typescript
// Add 5% padding to ensure full card capture
const paddingX = Math.floor((maxX - minX) * 0.05);
const paddingY = Math.floor((maxY - minY) * 0.05);

const cardBox = {
  x: Math.max(0, minX - paddingX),
  y: Math.max(0, minY - paddingY),
  width: Math.min(width - (minX - paddingX), maxX - minX + 2 * paddingX),
  height: Math.min(height - (minY - paddingY), maxY - minY + 2 * paddingY),
};
```

**Why 5% Padding?**

- Ensures no card edges are cut off
- Accounts for edge detection imprecision
- Maintains card context for analysis
- Industry standard for object detection

**Pros:**

- Removes background noise automatically
- Improves feature extraction accuracy
- Reduces processing time (smaller image)
- Focuses analysis on relevant area

**Cons:**

- May fail on complex backgrounds
- Adds processing overhead (~200-300ms)
- May crop important context
- Requires good lighting and contrast

---

### 2. AWS Rekognition Integration

#### DetectText API

**Purpose:** Extract text from card images with confidence scores and spatial positioning.

**API Configuration:**

```typescript
const command = new DetectTextCommand({
  Image: {
    S3Object: {
      Bucket: process.env.BUCKET_UPLOADS,
      Name: s3Key,
    },
  },
});
```

**Response Structure:**

```typescript
{
  TextDetections: [
    {
      DetectedText: 'Charizard VMAX',
      Type: 'LINE', // or "WORD"
      Confidence: 99.4,
      Geometry: {
        BoundingBox: {
          Left: 0.2, // 20% from left
          Top: 0.1, // 10% from top
          Width: 0.6, // 60% of image width
          Height: 0.05, // 5% of image height
        },
      },
    },
  ];
}
```

**Text Type Filtering:**

- **LINE:** Complete text lines (e.g., "Charizard VMAX")
- **WORD:** Individual words (e.g., "Charizard", "VMAX")
- Both types included for different analysis needs

**Confidence Conversion:**

```typescript
// Rekognition returns 0-100, we normalize to 0-1
confidence: (detection.Confidence || 0) / 100;
```

**Why Use Original Image for OCR?**

- Cropping may cut off text at edges
- Full context improves accuracy
- Rekognition optimized for complete images
- Better handling of perspective distortion

**Pros:**

- High accuracy (95%+ for clear text)
- Spatial positioning included
- Handles multiple languages
- Scales automatically

**Cons:**

- Cost: $1.50 per 1000 images
- Latency: 500-1000ms per image
- May miss stylized fonts
- Requires good image quality

#### DetectLabels API

**Purpose:** Detect objects and attributes for holographic pattern identification.

**API Configuration:**

```typescript
const command = new DetectLabelsCommand({
  Image: {
    S3Object: {
      Bucket: process.env.BUCKET_UPLOADS,
      Name: s3Key,
    },
  },
  MaxLabels: 50,
  MinConfidence: 70,
});
```

**Holographic Indicators:**

```typescript
const holoLabels = labels.filter(
  (label) =>
    label.Name?.toLowerCase().includes('shiny') ||
    label.Name?.toLowerCase().includes('metallic') ||
    label.Name?.toLowerCase().includes('reflective') ||
    label.Name?.toLowerCase().includes('glossy')
);
```

**Why These Keywords?**

- **Shiny:** Direct holographic indicator
- **Metallic:** Foil/holo finish
- **Reflective:** Light reflection from holo
- **Glossy:** Smooth holographic surface

**Pros:**

- Fast detection (~300-500ms)
- No custom training needed
- Handles various lighting conditions
- Cost-effective ($1 per 1000 images)

**Cons:**

- May miss subtle holographic effects
- False positives from lighting
- Limited to predefined labels
- No intensity measurement

---

### 3. Border Metrics Computation

#### Purpose

Analyze border regions to detect printing quality and symmetry.

#### Algorithm

**Step 1: Define Border Regions**

```typescript
// Border thickness = 5% of smallest dimension
const borderThickness = Math.floor(Math.min(width, height) * 0.05);

// Four border regions
const topBorder = [0, 0, width, borderThickness];
const bottomBorder = [0, height - borderThickness, width, borderThickness];
const leftBorder = [0, 0, borderThickness, height];
const rightBorder = [width - borderThickness, 0, borderThickness, height];
```

**Step 2: Calculate Average Brightness**

```typescript
function analyzeBorderRegion(data, x, y, regionWidth, regionHeight) {
  let sum = 0;
  let count = 0;

  for (let row = y; row < y + regionHeight; row++) {
    for (let col = x; col < x + regionWidth; col++) {
      const idx = (row * width + col) * channels;
      // Average RGB for brightness
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      sum += brightness;
      count++;
    }
  }

  return sum / count;
}
```

**Step 3: Normalize to 0-1 Scale**

```typescript
const topRatio = topBorder / 255; // 0-1 range
const bottomRatio = bottomBorder / 255;
const leftRatio = leftBorder / 255;
const rightRatio = rightBorder / 255;
```

**Step 4: Calculate Symmetry Score**

```typescript
// How similar are opposite borders?
const verticalSymmetry = 1 - Math.abs(topRatio - bottomRatio);
const horizontalSymmetry = 1 - Math.abs(leftRatio - rightRatio);
const symmetryScore = (verticalSymmetry + horizontalSymmetry) / 2;
```

**Interpretation:**

| Symmetry Score | Meaning            | Typical Cards                        |
| -------------- | ------------------ | ------------------------------------ |
| 0.9-1.0        | Perfect symmetry   | Professional prints, authentic cards |
| 0.7-0.9        | Good symmetry      | Acceptable quality, minor variations |
| 0.5-0.7        | Moderate asymmetry | Poor cutting, damaged cards          |
| 0.0-0.5        | High asymmetry     | Fake cards, severe damage            |

**Pros:**

- Objective measurement
- Catches printing/cutting errors
- Fast computation (~10-20ms)
- Works regardless of card content

**Cons:**

- Sensitive to image cropping
- May flag legitimate variations
- Requires well-framed photos
- Affected by lighting

---

### 4. Holographic Variance Analysis

#### Purpose

Quantify holographic effects through pixel variance analysis.

#### Algorithm

**Step 1: Check for Holographic Indicators**

```typescript
const hasHoloIndicators = holoLabels.length > 0;

if (!hasHoloIndicators) {
  return 0; // No holographic effect detected
}
```

**Step 2: Sample Center Region**

```typescript
// Focus on center 50% (holographic effects typically centered)
const centerX = Math.floor(width * 0.25);
const centerY = Math.floor(height * 0.25);
const sampleWidth = Math.floor(width * 0.5);
const sampleHeight = Math.floor(height * 0.5);

// Sample every 5th pixel (performance optimization)
for (let row = centerY; row < centerY + sampleHeight; row += 5) {
  for (let col = centerX; col < centerX + sampleWidth; col += 5) {
    const idx = (row * width + col) * channels;
    rgbValues.r.push(data[idx]);
    rgbValues.g.push(data[idx + 1]);
    rgbValues.b.push(data[idx + 2]);
  }
}
```

**Why Sample Every 5th Pixel?**

- Reduces computation time by 96%
- Still captures holographic patterns
- Sufficient statistical sample
- Balances speed vs accuracy

**Step 3: Calculate RGB Variance**

```typescript
function calculateVariance(values: number[]): number {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
}

const rVariance = calculateVariance(rgbValues.r);
const gVariance = calculateVariance(rgbValues.g);
const bVariance = calculateVariance(rgbValues.b);
```

**Step 4: Normalize to 0-1 Scale**

```typescript
const avgVariance = (rVariance + gVariance + bVariance) / 3;
const normalizedVariance = Math.min(avgVariance / 10000, 1);
```

**Why Divide by 10000?**

- Typical variance range: 0-10000
- Normalization to 0-1 scale
- Empirically determined threshold
- Allows for extreme cases

**Interpretation:**

| Variance | Meaning          | Card Type               |
| -------- | ---------------- | ----------------------- |
| 0.0-0.2  | No/minimal holo  | Common, Uncommon        |
| 0.2-0.5  | Moderate holo    | Reverse Holo            |
| 0.5-0.8  | Strong holo      | Holo Rare               |
| 0.8-1.0  | Very strong holo | Ultra Rare, Secret Rare |

**Pros:**

- Quantitative measurement
- Captures holographic intensity
- Fast computation (~50-100ms)
- Works with various lighting

**Cons:**

- Lighting-dependent
- May miss subtle holographic effects
- False positives from glare
- Requires RGB image

---

### 5. Font Metrics Extraction

#### Purpose

Analyze typography for authenticity verification and quality assessment.

#### Kerning Analysis

**Definition:** Spacing between consecutive words.

**Calculation:**

```typescript
const wordBlocks = ocrBlocks.filter((block) => block.type === 'WORD');
const kerning: number[] = [];

for (let i = 0; i < wordBlocks.length - 1; i++) {
  const currentRight = wordBlocks[i].boundingBox.left + wordBlocks[i].boundingBox.width;
  const nextLeft = wordBlocks[i + 1].boundingBox.left;
  const spacing = nextLeft - currentRight;
  kerning.push(spacing);
}
```

**Why Kerning Matters:**

- Authentic cards have consistent spacing
- Fake cards often have irregular kerning
- Professional typography indicator
- Quality control metric

#### Alignment Analysis

**Definition:** How well text lines align vertically.

**Calculation:**

```typescript
const lineBlocks = ocrBlocks.filter((block) => block.type === 'LINE');

// Check left edge alignment
const leftEdges = lineBlocks.map((block) => block.boundingBox.left);
const leftVariance = calculateVariance(leftEdges);

// Check right edge alignment
const rightEdges = lineBlocks.map((block) => block.boundingBox.left + block.boundingBox.width);
const rightVariance = calculateVariance(rightEdges);

// Lower variance = better alignment
const avgVariance = (leftVariance + rightVariance) / 2;
const alignment = Math.max(0, 1 - avgVariance * 100);
```

**Interpretation:**

| Alignment Score | Meaning                                |
| --------------- | -------------------------------------- |
| 0.9-1.0         | Perfect alignment (professional print) |
| 0.7-0.9         | Good alignment (acceptable quality)    |
| 0.5-0.7         | Poor alignment (low quality print)     |
| 0.0-0.5         | Very poor alignment (likely fake)      |

#### Font Size Variance

**Definition:** Variation in text height across the card.

**Calculation:**

```typescript
const heights = ocrBlocks.map((block) => block.boundingBox.height);
const fontSizeVariance = calculateVariance(heights);
```

**Why This Matters:**

- Authentic cards have consistent font sizes within sections
- High variance suggests unprofessional printing
- Helps detect fake cards with mixed fonts

**Pros:**

- Objective typography metrics
- Catches low-quality reproductions
- Fast computation (~5-10ms)
- No external dependencies

**Cons:**

- Requires accurate OCR bounding boxes
- Sensitive to image perspective
- May flag legitimate design variations
- Needs multiple text blocks

---

### 6. Image Quality Assessment

#### Blur Score Calculation

**Purpose:** Measure image sharpness using Laplacian variance method.

**Algorithm:**

```typescript
async function calculateBlurScore(imageBuffer: Buffer): Promise<number> {
  // Convert to grayscale and get statistics
  const stats = await sharp(imageBuffer).grayscale().stats();

  // Use standard deviation as sharpness proxy
  // Higher stdev = more edges = sharper image
  const stdev = stats.channels[0].stdev;

  // Normalize to 0-1 scale (typical range: 0-100)
  return Math.min(stdev / 100, 1);
}
```

**Why Standard Deviation?**

- Sharp images have high contrast (high stdev)
- Blurry images have low contrast (low stdev)
- Fast computation (Sharp library optimized)
- Industry-standard method

**Interpretation:**

| Blur Score | Meaning       | Action                      |
| ---------- | ------------- | --------------------------- |
| 0.8-1.0    | Very sharp    | Excellent for analysis      |
| 0.6-0.8    | Sharp         | Good for analysis           |
| 0.4-0.6    | Moderate blur | Acceptable, may affect OCR  |
| 0.2-0.4    | Blurry        | Poor OCR accuracy           |
| 0.0-0.2    | Very blurry   | Reject or request re-upload |

#### Glare Detection

**Purpose:** Identify light reflections that obscure card details.

**Algorithm:**

```typescript
// Sample pixels across image (every 10th pixel)
const brightnessValues: number[] = [];

for (let row = 0; row < height; row += 10) {
  for (let col = 0; col < width; col += 10) {
    const idx = (row * width + col) * channels;
    const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    brightnessValues.push(brightness);
  }
}

// Count very bright pixels (> 240 out of 255)
const highBrightnessCount = brightnessValues.filter((val) => val > 240).length;

// Glare detected if > 15% of pixels are very bright
const glareDetected = highBrightnessCount / brightnessValues.length > 0.15;
```

**Why 240 Threshold?**

- 240/255 = 94% brightness
- Indicates overexposure or reflection
- Empirically determined for card images
- Balances sensitivity and false positives

**Why 15% Threshold?**

- Small glare spots acceptable
- Large glare areas problematic
- Empirically validated
- Allows for holographic reflections

#### Brightness Analysis

**Purpose:** Measure overall image exposure.

**Calculation:**

```typescript
const avgBrightness = brightnessValues.reduce((sum, val) => sum + val, 0) / brightnessValues.length;

const normalizedBrightness = avgBrightness / 255; // 0-1 scale
```

**Interpretation:**

| Brightness | Meaning                    |
| ---------- | -------------------------- |
| 0.7-0.9    | Well-exposed (ideal)       |
| 0.5-0.7    | Slightly dark (acceptable) |
| 0.3-0.5    | Dark (may affect analysis) |
| 0.9-1.0    | Overexposed (glare likely) |
| 0.0-0.3    | Very dark (poor quality)   |

**Pros:**

- Fast computation (~20-30ms)
- Objective quality metrics
- Helps filter poor images
- Guides user feedback

**Cons:**

- Doesn't catch all quality issues
- May flag artistic lighting
- Threshold tuning needed
- Lighting-dependent

---

## Data Structures

### Input: RekognitionExtractInput

```typescript
interface RekognitionExtractInput {
  userId: string;
  cardId: string;
  s3Keys: {
    front: string; // Required
    back?: string; // Optional
  };
  requestId: string;
}
```

### Output: FeatureEnvelope

```typescript
interface FeatureEnvelope {
  ocr: OCRBlock[];
  borders: BorderMetrics;
  holoVariance: number;
  fontMetrics: FontMetrics;
  quality: ImageQuality;
  imageMeta: ImageMetadata;
}

interface OCRBlock {
  text: string;
  confidence: number; // 0-1
  boundingBox: BoundingBox;
  type: 'LINE' | 'WORD';
}

interface BoundingBox {
  left: number; // 0-1 (percentage from left)
  top: number; // 0-1 (percentage from top)
  width: number; // 0-1 (percentage of image width)
  height: number; // 0-1 (percentage of image height)
}

interface BorderMetrics {
  topRatio: number; // 0-1
  bottomRatio: number; // 0-1
  leftRatio: number; // 0-1
  rightRatio: number; // 0-1
  symmetryScore: number; // 0-1
}

interface FontMetrics {
  kerning: number[]; // Spacing values
  alignment: number; // 0-1
  fontSizeVariance: number; // Variance value
}

interface ImageQuality {
  blurScore: number; // 0-1 (higher = sharper)
  glareDetected: boolean;
  brightness: number; // 0-1
}

interface ImageMetadata {
  width: number; // Pixels
  height: number; // Pixels
  format: string; // 'jpeg', 'png', etc.
  sizeBytes: number; // File size
}
```

---

## Performance Characteristics

### Latency Breakdown

**Typical Execution Time:** 1.5-3 seconds

| Phase                    | Duration   | Notes                     |
| ------------------------ | ---------- | ------------------------- |
| S3 Download              | 200-500ms  | Depends on image size     |
| Card Detection           | 200-300ms  | Edge detection + cropping |
| Rekognition DetectText   | 500-1000ms | AWS API call              |
| Rekognition DetectLabels | 300-500ms  | AWS API call (parallel)   |
| Border Metrics           | 10-20ms    | Pure computation          |
| Holographic Variance     | 50-100ms   | Pixel sampling            |
| Font Metrics             | 5-10ms     | OCR block analysis        |
| Image Quality            | 20-30ms    | Blur + glare detection    |
| Image Metadata           | 5-10ms     | Sharp metadata extraction |
| **Total**                | **1.5-3s** | End-to-end                |

**Optimization Strategies:**

- Parallel Rekognition API calls
- Pixel sampling (every 5th pixel for holo)
- Lazy loading of Sharp library
- Efficient buffer operations

### Cost Analysis

**Per Image:**

| Component                | Cost         | Notes                    |
| ------------------------ | ------------ | ------------------------ |
| Lambda execution         | $0.0000002   | 1GB RAM, 3s duration     |
| S3 GET request           | $0.0000004   | Image download           |
| S3 data transfer         | $0.00009     | ~1MB image               |
| Rekognition DetectText   | $0.0015      | $1.50 per 1000 images    |
| Rekognition DetectLabels | $0.001       | $1 per 1000 images       |
| **Total per image**      | **~$0.0026** | Dominated by Rekognition |

**Monthly Cost (1000 cards, front only):**

- $2.60 for Rekognition
- <$1 for Lambda + S3
- **Total: ~$3-4/month**

**With Back Images (2000 images):**

- $5.20 for Rekognition
- <$2 for Lambda + S3
- **Total: ~$6-8/month**

### Scalability

**Bottlenecks:**

1. **Rekognition Rate Limits:**
   - DetectText: 50 TPS (transactions per second)
   - DetectLabels: 50 TPS
   - Can request increase

2. **Lambda Concurrency:**
   - 1000 concurrent executions (default)
   - Can request increase
   - Step Functions manages parallelism

3. **S3 Throughput:**
   - 5,500 GET requests/second per prefix
   - Not a bottleneck for typical usage

**Horizontal Scaling:**

- Lambda auto-scales to handle load
- Rekognition scales automatically
- No single point of failure
- Parallel processing of front/back images

---

## Pros and Cons Analysis

### Overall System Pros

✅ **Comprehensive Feature Extraction**

- 6 feature categories
- Covers text, visual, and quality aspects
- Enables multi-faceted analysis

✅ **Automatic Card Detection**

- Removes background noise
- Focuses analysis on card
- Improves accuracy

✅ **Parallel Processing**

- Rekognition APIs run in parallel
- Feature extraction parallelized
- Reduces total latency

✅ **Quality Assessment**

- Blur detection
- Glare detection
- Brightness analysis
- Enables filtering

✅ **Scalable Architecture**

- Serverless components
- Auto-scaling
- Cost-effective

✅ **Robust Error Handling**

- Graceful degradation
- Fallback to full image
- Detailed logging

### Overall System Cons

❌ **Rekognition Dependency**

- Requires AWS service availability
- Cost per image ($0.0026)
- Rate limits (50 TPS)
- No offline mode

❌ **Latency**

- 1.5-3 seconds typical
- Dominated by Rekognition calls
- Blocks downstream agents

❌ **Image Quality Sensitivity**

- Poor images yield poor features
- Blur affects OCR accuracy
- Glare obscures details
- Lighting critical

❌ **Card Detection Limitations**

- May fail on complex backgrounds
- Requires good contrast
- Adds processing overhead
- May crop important context

❌ **No Deep Learning**

- Rule-based algorithms
- Limited pattern recognition
- Can't learn from data
- Fixed thresholds

❌ **Cost Scaling**

- Linear cost with volume
- $2.60 per 1000 images
- Not suitable for free tier
- Adds up at scale

---

## Future Improvements

### 1. Custom ML Models

**Goal:** Replace rule-based algorithms with trained models.

**Approach:**

- Train CNN for card detection
- Use object detection (YOLO, SSD)
- Custom holographic classifier
- Font recognition model

**Impact:**

- Higher accuracy
- Better edge case handling
- Adaptive to new card types
- Requires training data

### 2. Multi-Image Analysis

**Goal:** Analyze multiple angles/lighting conditions.

**Approach:**

- Request 2-3 images per card
- Combine features from all images
- Vote on ambiguous features
- Select best quality image

**Impact:**

- More robust feature extraction
- Better holographic detection
- Reduced false positives
- Higher user friction

### 3. Real-Time Quality Feedback

**Goal:** Guide users to take better photos.

**Approach:**

- Analyze image quality in real-time
- Provide immediate feedback
- Suggest improvements (lighting, angle)
- Auto-retry on poor quality

**Impact:**

- Better input images
- Higher accuracy
- Reduced processing failures
- Better user experience

### 4. Caching Layer

**Goal:** Cache extracted features for duplicate images.

**Approach:**

- Hash image content
- Store features in DynamoDB
- TTL: 30 days
- Cache hit = instant response

**Impact:**

- 20-30% cache hit rate (estimated)
- Sub-second response times
- Cost reduction
- Requires cache management

### 5. Advanced Holographic Detection

**Goal:** More accurate holographic pattern analysis.

**Approach:**

- Fourier transform analysis
- Spectral analysis
- Multi-angle capture
- Machine learning classifier

**Impact:**

- Better rarity inference
- Reduced false positives
- More granular scoring
- Higher complexity

### 6. Text Region Segmentation

**Goal:** Identify specific card regions (name, HP, attacks, etc.).

**Approach:**

- Train segmentation model
- Label card regions
- Extract region-specific features
- Structured metadata output

**Impact:**

- Better OCR reasoning
- Targeted feature extraction
- Improved accuracy
- Requires labeled dataset

---

## Integration with CollectIQ Pipeline

### Upstream Dependencies

**1. S3 Upload**

- Card images must be uploaded to S3
- Presigned URLs expire in 60 seconds
- Images must be accessible to Lambda

**2. Step Functions Workflow**

- Orchestrates Rekognition Extract invocation
- Provides S3 keys and metadata
- Handles retries and errors

### Downstream Consumers

**1. OCR Reasoning Agent**

- Uses OCR blocks for AI interpretation
- Uses visual context for rarity inference
- Uses quality metrics for confidence scoring

**2. Pricing Agent**

- Uses OCR metadata for card identification
- Uses quality metrics for filtering
- Indirectly benefits from accurate OCR

**3. Authenticity Agent**

- Uses all features for verification
- Border metrics for print quality
- Holographic variance for rarity validation
- Font metrics for typography analysis

**4. Aggregator**

- Stores features in DynamoDB
- Emits EventBridge events
- Persists for future reference

### Step Functions Orchestration

```json
{
  "StartAt": "RekognitionExtract",
  "States": {
    "RekognitionExtract": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:function:rekognition-extract",
      "Next": "OcrReasoningAgent",
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "IntervalSeconds": 2,
          "MaxAttempts": 2,
          "BackoffRate": 2.0
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "HandleExtractionFailure"
        }
      ]
    }
  }
}
```

---

## Monitoring and Observability

### CloudWatch Metrics

**Custom Metrics:**

```typescript
await metrics.recordFeatureExtraction({
  latency: number,
  ocrBlockCount: number,
  holoVariance: number,
  blurScore: number,
  cardDetected: boolean,
});
```

**Key Metrics:**

- `FeatureExtractionLatency` (p50, p95, p99)
- `OcrBlockCount` (average, min, max)
- `HolographicVariance` (distribution)
- `BlurScore` (average, distribution)
- `CardDetectionRate` (percentage)
- `GlareDetectionRate` (percentage)

### X-Ray Tracing

**Traced Operations:**

```typescript
tracing.trace('rekognition_detect_text', () => client.send(command));
tracing.trace('rekognition_detect_labels', () => client.send(command));
tracing.trace('s3_get_image_for_rekognition', () => client.send(command));
```

**Trace Insights:**

- End-to-end latency breakdown
- Rekognition API performance
- S3 download times
- Feature extraction bottlenecks

### Structured Logging

**Log Levels:**

- `DEBUG`: Detailed computation steps
- `INFO`: Major milestones and results
- `WARN`: Quality issues, detection failures
- `ERROR`: Failures requiring attention

**Key Log Events:**

```typescript
logger.info('RekognitionExtract task invoked', { userId, cardId });
logger.info('Card boundaries detected', { cardBox, aspectRatio });
logger.warn('Card boundaries not detected, using full image');
logger.info('Feature extraction complete', { ocrBlockCount, holoVariance });
logger.error('Feature extraction failed', error, { s3Key });
```

### Alerting

**Critical Alerts:**

- Rekognition API failure rate > 5%
- Average blur score < 0.4
- Card detection failure rate > 30%
- Lambda errors or timeouts

**Warning Alerts:**

- High glare detection rate (> 20%)
- Low OCR block count (< 5)
- Unusual holographic variance distribution
- High latency (> 5s)

---

## Security Considerations

### 1. IAM Permissions

**Required:**

- `rekognition:DetectText` - For OCR
- `rekognition:DetectLabels` - For label detection
- `s3:GetObject` - For image download
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` - CloudWatch logging

**Least Privilege:**

- Read-only S3 access
- Specific bucket access only
- No write permissions
- No cross-account access

### 2. Input Validation

**Validation:**

- S3 keys validated before use
- Image format validated
- File size limits enforced
- Malicious content scanning

**Risk Mitigation:**

- Prevents injection attacks
- Limits resource consumption
- Ensures data integrity
- Protects against abuse

### 3. Data Privacy

**Considerations:**

- Images may contain personal information
- Temporary processing only
- No long-term storage of images
- Compliance with data regulations

**Mitigation:**

- Process in memory only
- Delete temporary files
- Encrypt at rest and in transit
- User data isolation

---

## Troubleshooting Guide

### Issue: No OCR Blocks Detected

**Symptoms:**

- `ocrBlockCount: 0`
- Empty OCR array in features

**Possible Causes:**

1. No text in image
2. Very blurry image
3. Poor lighting
4. Text too small

**Diagnosis:**

```bash
# Check image quality metrics
aws logs filter-pattern "blurScore" \
  --log-group-name /aws/lambda/rekognition-extract

# Check Rekognition response
aws logs filter-pattern "No text detected" \
  --log-group-name /aws/lambda/rekognition-extract
```

**Resolution:**

- Request better quality image
- Improve lighting guidance
- Increase image resolution
- Manual text entry fallback

### Issue: Card Detection Failure

**Symptoms:**

- Log: "Card boundaries not detected"
- Using full image for analysis

**Possible Causes:**

1. Complex background
2. Poor contrast
3. Card not centered
4. Multiple objects in image

**Diagnosis:**

```bash
# Check detection rate
aws logs filter-pattern "Card boundaries not detected" \
  --log-group-name /aws/lambda/rekognition-extract

# Check edge ratio
aws logs filter-pattern "edgeRatio" \
  --log-group-name /aws/lambda/rekognition-extract
```

**Resolution:**

- Improve background guidance
- Request centered photos
- Adjust edge detection threshold
- Accept full image processing

### Issue: High Glare Detection Rate

**Symptoms:**

- `glareDetected: true` frequently
- Low OCR confidence

**Possible Causes:**

1. Flash photography
2. Reflective surfaces
3. Direct sunlight
4. Holographic cards

**Diagnosis:**

```bash
# Check glare rate
aws cloudwatch get-metric-statistics \
  --metric-name GlareDetectionRate \
  --namespace CollectIQ

# Check brightness distribution
aws logs filter-pattern "brightness" \
  --log-group-name /aws/lambda/rekognition-extract
```

**Resolution:**

- Disable flash in camera guidance
- Suggest diffused lighting
- Angle adjustment guidance
- Accept for holographic cards

---

## Document Metadata

**Version:** 1.0  
**Last Updated:** October 22, 2025  
**Author:** CollectIQ Engineering Team  
**Status:** Production  
**Audience:** Developers, DevOps, Product Managers

**Change Log:**

- v1.0 (2025-10-22): Initial comprehensive documentation

---

**End of Document**

---

## Content Safety & Card Validation

### Purpose

Ensure uploaded images are:

1. **Safe for kids** - No explicit, suggestive, or inappropriate content
2. **Trading cards** - Not other objects (people, animals, food, etc.)

This prevents wasted processing, maintains a kid-friendly environment, and provides clear user feedback.

### Implementation

Two-stage validation using AWS Rekognition:

#### Stage 1: Content Moderation (Kid-Friendly Safety)

Uses Rekognition's `DetectModerationLabels` API to detect inappropriate content.

**Blocked Content Categories** (confidence > 60%):

- Explicit Nudity
- Suggestive content
- Violence
- Visually Disturbing
- Rude Gestures
- Drugs, Tobacco, Alcohol
- Gambling
- Hate Symbols
- Exposed body parts
- Partial Nudity

**API Configuration:**

```typescript
const command = new DetectModerationLabelsCommand({
  Image: { S3Object: { Bucket: bucket, Name: key } },
  MinConfidence: 60, // Lower threshold for safety
});
```

**Why 60% confidence?**

- Better safe than sorry for kid-friendly app
- Catches borderline inappropriate content
- Reduces risk of explicit content slipping through
- Can be tuned based on false positive rate

#### Stage 2: Card Type Validation

Uses Rekognition's `DetectLabels` API to ensure image is a trading card.

**Invalid Labels** (confidence > 80%):

- Person, Human, Face, Portrait
- Animal, Pet, Dog, Cat, Bird
- Food, Meal, Dish
- Vehicle, Car, Truck
- Building, Architecture
- Nature, Landscape
- Screen, Monitor, Television
- Furniture, Chair, Table

**Valid Labels** (confidence > 70%):

- Text, Document, Paper, Card
- Poster, Flyer, Advertisement
- Art, Drawing, Painting

### Validation Logic

```typescript
private validateCardImage(labelsResponse: DetectLabelsCommandOutput): void {
  const labels = labelsResponse.Labels || [];

  const foundInvalidLabels = labels
    .filter(label =>
      invalidLabels.some(invalid =>
        label.Name?.toLowerCase().includes(invalid.toLowerCase())
      ) && (label.Confidence || 0) > 80
    )
    .map(label => label.Name);

  const foundValidLabels = labels
    .filter(label =>
      validLabels.some(valid =>
        label.Name?.toLowerCase().includes(valid.toLowerCase())
      ) && (label.Confidence || 0) > 70
    )
    .map(label => label.Name);

  // Reject if strong invalid labels and no valid labels
  if (foundInvalidLabels.length > 0 && foundValidLabels.length === 0) {
    throw new Error(
      `Image does not appear to be a trading card. Detected: ${foundInvalidLabels.join(', ')}`
    );
  }
}
```

### Error Messages

When validation fails, users receive clear, kid-friendly feedback:

**Content Safety Errors:**

```
Image contains inappropriate content and cannot be uploaded. This app is kid-friendly.
```

**Card Type Errors:**

```
Image does not appear to be a trading card. Detected: Person, Face
```

```
Image does not appear to be a trading card. Detected: Dog, Animal
```

```
Image does not appear to be a trading card. Detected: Food, Meal
```

Note: Content safety errors don't reveal specific inappropriate content detected to maintain privacy and avoid exposing users to details.

### Pipeline Integration

Validation occurs early in the extraction pipeline (Steps 3-4):

1. Download image from S3
2. Get image metadata
3. **Run content moderation check** ← Kid-friendly safety
4. **Run label detection and validate** ← Card type check
5. Detect card boundaries
6. Crop to card
7. Extract features

This "fail fast" approach saves processing time and costs by rejecting invalid images before expensive operations.

### Pros

✅ **Kid-Friendly Safety**

- Blocks explicit and inappropriate content
- Protects young users
- Maintains brand reputation
- Complies with child safety regulations

✅ **Clear User Feedback**

- Descriptive error messages (for card type)
- Generic message for inappropriate content (privacy)
- Guides re-upload behavior

✅ **Cost Savings**

- Prevents wasted Rekognition calls
- Avoids unnecessary processing
- Fails before expensive operations
- DetectModerationLabels: $1/1000 images

✅ **Better Data Quality**

- Ensures only cards in database
- Prevents garbage data
- Improves downstream accuracy

✅ **Fast Validation**

- Parallel API calls possible
- Minimal latency impact (~300-500ms)
- Fail fast approach

### Cons

❌ **False Positives (Card Type)**

- May reject valid cards with people/animals in artwork
- Pokémon cards often feature creatures
- Needs careful threshold tuning

❌ **False Positives (Content Safety)**

- May flag artistic nudity in card artwork
- Some fantasy creatures might trigger warnings
- Requires manual review process for appeals

❌ **Threshold Sensitivity**

- 60% for moderation may be too strict
- 80% for card validation may be too strict
- Requires empirical testing and tuning

❌ **Limited Label Coverage**

- Rekognition may not detect all inappropriate content
- New edge cases may emerge
- Requires ongoing maintenance

❌ **Additional Cost**

- DetectModerationLabels adds $1/1000 images
- Total validation cost: ~$2/1000 images
- Worth it for safety but increases per-image cost

### Tuning Recommendations

**If too many false positives (rejecting valid cards):**

- Increase invalid label confidence threshold (80% → 90%)
- Decrease valid label confidence threshold (70% → 60%)
- Add more valid labels (e.g., "Illustration", "Graphic")

**If too many false negatives (accepting non-cards):**

- Decrease invalid label confidence threshold (80% → 70%)
- Increase valid label confidence threshold (70% → 80%)
- Add more invalid labels based on user uploads

**Monitoring:**

- Track validation rejection rate
- Log rejected images for review
- Collect user feedback on false positives
- Adjust thresholds based on data

### Automatic Cleanup on Validation Failure

When validation fails, the system automatically cleans up to prevent orphaned data:

**Cleanup Process:**

1. Validation error is detected in the catch block
2. Check if error message contains "does not appear to be a trading card"
3. If validation error, call `deleteCard(userId, cardId, requestId, true)`
4. Hard delete removes:
   - DynamoDB card record (PK: USER#{userId}, SK: CARD#{cardId})
   - S3 front image (s3Keys.front)
   - S3 back image (s3Keys.back, if exists)
5. Log cleanup success or failure
6. Re-throw original validation error to Step Functions

**Benefits:**

- No orphaned S3 objects consuming storage
- No incomplete card records in database
- Clean state for user to retry upload
- Prevents billing for invalid uploads
- Maintains data consistency

**Error Handling:**

- Cleanup failures are logged but don't mask validation error
- Original validation error always propagated to user
- Step Functions receives validation error for proper error handling
- User sees clear message: "Image does not appear to be a trading card. Detected: Person, Face"

**Code Implementation:**

```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isValidationError = errorMessage.includes('does not appear to be a trading card');

  if (isValidationError) {
    logger.info('Cleaning up invalid card upload', { userId, cardId, s3Keys, requestId });

    try {
      // Hard delete: removes DynamoDB + S3
      await deleteCard(userId, cardId, requestId, true);
      logger.info('Invalid card upload cleaned up successfully', { userId, cardId, requestId });
    } catch (cleanupError) {
      // Log but don't mask original error
      logger.error('Failed to clean up invalid card upload', cleanupError, { userId, cardId, s3Keys, requestId });
    }
  }

  throw error; // Always propagate original error
}
```

**Monitoring Cleanup:**

- Track cleanup success rate
- Alert on high cleanup failure rate
- Monitor S3 storage savings from cleanup
- Log cleanup latency
