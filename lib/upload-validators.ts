import { UPLOAD_CONFIG } from './upload-config';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  metadata?: {
    dimensions?: { width: number; height: number };
    longestEdge?: number;
  };
}

/**
 * Validate file size against configured maximum
 */
function validateFileSize(file: File): ValidationResult {
  if (file.size > UPLOAD_CONFIG.maxSizeBytes) {
    return {
      valid: false,
      error: `File is too large. Max is ${UPLOAD_CONFIG.maxSizeMB} MB.`,
    };
  }
  return { valid: true };
}

/**
 * Validate file format (MIME type and extension)
 */
function validateFileFormat(file: File): ValidationResult {
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  const mimeType = file.type;

  // Check MIME type
  const supportedFormats =
    UPLOAD_CONFIG.supportedFormats as readonly string[];
  if (!supportedFormats.includes(mimeType)) {
    return {
      valid: false,
      error: "That format isn't supported. Use JPG, PNG, or HEIC.",
    };
  }

  // Check extension
  const supportedExtensions =
    UPLOAD_CONFIG.supportedExtensions as readonly string[];
  if (extension && !supportedExtensions.includes(extension)) {
    return {
      valid: false,
      error: "That format isn't supported. Use JPG, PNG, or HEIC.",
    };
  }

  return { valid: true };
}

/**
 * Extract image dimensions from file
 */
async function extractDimensions(
  file: File
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * Validate image dimensions and provide warnings
 */
async function validateDimensions(
  file: File
): Promise<ValidationResult> {
  const dimensions = await extractDimensions(file);

  if (!dimensions) {
    // Can't extract dimensions, but don't block upload
    return { valid: true };
  }

  const longestEdge = Math.max(dimensions.width, dimensions.height);
  const warnings: string[] = [];

  if (longestEdge < UPLOAD_CONFIG.minDimensionPx) {
    warnings.push(
      'Low-resolution image; results may be less accurate.'
    );
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    metadata: {
      dimensions,
      longestEdge,
    },
  };
}

/**
 * Comprehensive file validation
 * Validates size, format, and optionally dimensions
 */
export async function validateUploadFile(
  file: File,
  options: { checkDimensions?: boolean } = {}
): Promise<ValidationResult> {
  // Check file size
  const sizeResult = validateFileSize(file);
  if (!sizeResult.valid) {
    return sizeResult;
  }

  // Check file format
  const formatResult = validateFileFormat(file);
  if (!formatResult.valid) {
    return formatResult;
  }

  // Optionally check dimensions
  if (options.checkDimensions) {
    const dimensionResult = await validateDimensions(file);
    return dimensionResult;
  }

  return { valid: true };
}

/**
 * Synchronous validation (size and format only)
 * Use this for immediate feedback during drag-over
 */
export function validateUploadFileSync(file: File): ValidationResult {
  // Check file size
  const sizeResult = validateFileSize(file);
  if (!sizeResult.valid) {
    return sizeResult;
  }

  // Check file format
  const formatResult = validateFileFormat(file);
  if (!formatResult.valid) {
    return formatResult;
  }

  return { valid: true };
}
