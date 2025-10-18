'use client';

import * as React from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  compressImage,
  isMobileDevice,
  getRecommendedCompressionOptions,
} from '@/lib/image-compression';

// ============================================================================
// Types
// ============================================================================

export interface UploadError {
  type: 'file-type' | 'file-size' | 'unknown';
  message: string;
  file?: File;
}

export interface UploadDropzoneProps {
  accept?: string[];
  maxSizeMB?: number;
  onSelected: (files: File[]) => void;
  onError: (error: UploadError) => void;
  disabled?: boolean;
  className?: string;
  autoCompress?: boolean; // Auto-compress on mobile (default: true)
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ACCEPT = ['image/jpeg', 'image/png', 'image/heic'];
const DEFAULT_MAX_SIZE_MB = 12;
const BYTES_PER_MB = 1024 * 1024;

// ============================================================================
// Validation
// ============================================================================

function validateFile(
  file: File,
  acceptedTypes: string[],
  maxSizeBytes: number
): UploadError | null {
  // Check file type
  if (!acceptedTypes.includes(file.type)) {
    return {
      type: 'file-type',
      message: `Unsupported file type. Please use ${acceptedTypes.map((t) => t.split('/')[1].toUpperCase()).join(', ')}.`,
      file,
    };
  }

  // Check file size
  if (file.size > maxSizeBytes) {
    const maxSizeMB = Math.floor(maxSizeBytes / BYTES_PER_MB);
    const fileSizeMB = (file.size / BYTES_PER_MB).toFixed(2);
    return {
      type: 'file-size',
      message: `File too large (${fileSizeMB} MB). Maximum size is ${maxSizeMB} MB.`,
      file,
    };
  }

  return null;
}

// ============================================================================
// Component
// ============================================================================

export function UploadDropzone({
  accept = DEFAULT_ACCEPT,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  onSelected,
  onError,
  disabled = false,
  className,
  autoCompress = true,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dragCounterRef = React.useRef(0);

  const maxSizeBytes = maxSizeMB * BYTES_PER_MB;

  // ============================================================================
  // File Handling
  // ============================================================================

  const handleFiles = React.useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const validFiles: File[] = [];

      // Validate each file
      for (const file of fileArray) {
        const error = validateFile(file, accept, maxSizeBytes);
        if (error) {
          onError(error);
          return; // Stop on first error
        }
        validFiles.push(file);
      }

      // Compress images on mobile if enabled
      if (validFiles.length > 0) {
        const shouldCompress = autoCompress !== false && isMobileDevice();

        if (shouldCompress) {
          try {
            const compressionOptions = getRecommendedCompressionOptions();
            const compressedFiles = await Promise.all(
              validFiles.map((file) => compressImage(file, compressionOptions))
            );
            onSelected(compressedFiles);
          } catch (error) {
            console.error('Compression error:', error);
            // Fall back to original files if compression fails
            onSelected(validFiles);
          }
        } else {
          onSelected(validFiles);
        }
      }
    },
    [accept, maxSizeBytes, onSelected, onError, autoCompress]
  );

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleClick = React.useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled]);

  const handleFileInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(event.target.files);
      // Reset input so same file can be selected again
      event.target.value = '';
    },
    [handleFiles]
  );

  const handleDragEnter = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (disabled) return;

      dragCounterRef.current += 1;
      if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (disabled) return;

      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    },
    [disabled]
  );

  const handleDragOver = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (disabled) return;

      setIsDragging(false);
      dragCounterRef.current = 0;

      const files = event.dataTransfer.files;
      handleFiles(files);
    },
    [disabled, handleFiles]
  );

  // ============================================================================
  // Keyboard Accessibility
  // ============================================================================

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick();
      }
    },
    [disabled, handleClick]
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload card image"
      aria-disabled={disabled}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all',
        'cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-emerald-glow)] focus-visible:ring-offset-2',
        isDragging && !disabled
          ? 'border-[var(--color-emerald-glow)] bg-[var(--color-emerald-glow)]/10 scale-[1.02]'
          : 'border-[var(--border)] hover:border-[var(--color-emerald-glow)]',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
        aria-hidden="true"
      />

      {/* Icon */}
      <div
        className={cn(
          'mb-6 rounded-full p-6 transition-colors',
          isDragging && !disabled
            ? 'bg-[var(--color-emerald-glow)]/20'
            : 'bg-[var(--color-emerald-glow)]/10'
        )}
      >
        {isDragging ? (
          <ImageIcon
            className="h-14 w-14 text-[var(--color-emerald-glow)]"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        ) : (
          <Upload
            className="h-14 w-14 text-[var(--color-emerald-glow)]"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Text */}
      <div className="text-center space-y-3">
        <h3 className="text-2xl font-bold font-display">
          {isDragging ? 'Drop Here' : 'Upload File'}
        </h3>
        <p className="text-base text-[var(--muted-foreground)] leading-relaxed px-4">
          {isDragging
            ? 'Release to upload'
            : 'Drag and drop or click to browse'}
        </p>
        <p className="text-sm text-[var(--muted-foreground)] pt-2">
          JPG, PNG, HEIC • Max {maxSizeMB} MB
        </p>
      </div>

      {/* Action hint */}
      <div className="pt-4">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-emerald-glow)] group-hover:gap-3 transition-all">
          Choose File
          <span className="text-base">→</span>
        </div>
      </div>
    </div>
  );
}
