/**
 * Image compression utilities for mobile upload optimization
 * Compresses large images before upload to reduce bandwidth and improve performance
 */

export interface CompressionOptions {
  maxSizeMB: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  quality?: number;
}

/**
 * Compress an image file for mobile upload
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Compressed file or original if compression not needed
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = { maxSizeMB: 12, quality: 0.9 }
): Promise<File> {
  // Skip compression if file is already small enough
  const fileSizeMB = file.size / 1024 / 1024;
  if (fileSizeMB <= options.maxSizeMB * 0.8) {
    return file;
  }

  // Only compress on mobile devices to save bandwidth
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) {
    return file;
  }

  try {
    // Create canvas for compression
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Load image
    const img = await loadImage(file);

    // Calculate new dimensions
    let { width, height } = img;
    const maxDimension = options.maxWidthOrHeight || 2000;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = (height / width) * maxDimension;
        width = maxDimension;
      } else {
        width = (width / height) * maxDimension;
        height = maxDimension;
      }
    }

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    // Draw image on canvas
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to blob with compression
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        options.quality || 0.9
      );
    });

    // Create new file from blob
    const compressedFile = new File([blob], file.name, {
      type: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
      lastModified: Date.now(),
    });

    // Only return compressed file if it's actually smaller
    if (compressedFile.size < file.size) {
      console.log(
        `Compressed image from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`
      );
      return compressedFile;
    }

    return file;
  } catch (error) {
    console.error('Image compression failed:', error);
    // Return original file if compression fails
    return file;
  }
}

/**
 * Load an image file into an HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Check if the device is mobile
 */
export function isMobileDevice(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * Get optimal compression settings based on device
 */
export function getOptimalCompressionSettings(): CompressionOptions {
  const isMobile = isMobileDevice();

  if (isMobile) {
    return {
      maxSizeMB: 8, // More aggressive compression on mobile
      maxWidthOrHeight: 2000,
      quality: 0.85,
    };
  }

  return {
    maxSizeMB: 12,
    maxWidthOrHeight: 4000,
    quality: 0.92,
  };
}
