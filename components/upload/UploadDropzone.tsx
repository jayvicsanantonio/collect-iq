'use client';

import * as React from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UPLOAD_CONFIG } from '@/lib/upload-config';
import { validateUploadFileSync } from '@/lib/upload-validators';

// ============================================================================
// Types
// ============================================================================

export interface UploadError {
  type: 'file-type' | 'file-size' | 'unknown';
  message: string;
  file?: File;
}

export interface UploadDropzoneProps {
  onSelected: (files: File[]) => void;
  onError: (error: UploadError) => void;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function UploadDropzone({
  onSelected,
  onError,
  disabled = false,
  className,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(
    null
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dragCounterRef = React.useRef(0);

  // ============================================================================
  // File Handling
  // ============================================================================

  const handleFiles = React.useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      // Clear any previous inline errors
      setInlineError(null);

      const fileArray = Array.from(files);
      const validFiles: File[] = [];

      // Validate each file
      for (const file of fileArray) {
        const result = validateUploadFileSync(file);
        if (!result.valid) {
          const error: UploadError = {
            type: result.error?.includes('too large')
              ? 'file-size'
              : 'file-type',
            message: result.error || 'Invalid file',
            file,
          };
          setInlineError(result.error || 'Invalid file');
          onError(error);
          return; // Stop on first error
        }
        validFiles.push(file);
      }

      // All files valid
      if (validFiles.length > 0) {
        onSelected(validFiles);
      }
    },
    [onSelected, onError]
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
      if (
        event.dataTransfer.items &&
        event.dataTransfer.items.length > 0
      ) {
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

  const handleDragOver = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    },
    []
  );

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
      aria-label="Upload card image. Supports JPG, PNG, HEIC. Maximum 12 MB. Best results with 2000 to 4000 pixel images."
      aria-disabled={disabled}
      aria-describedby={inlineError ? 'upload-error' : undefined}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all',
        'min-h-[280px] cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--holo-cyan)] focus-visible:ring-offset-2',
        !className?.includes('border-0') &&
          (isDragging && !disabled
            ? 'border-[var(--holo-cyan)] bg-[var(--holo-cyan)]/10 scale-[1.02]'
            : 'border-[var(--border)] hover:border-[var(--vault-blue)] hover:bg-[var(--muted)]/50'),
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
        accept={UPLOAD_CONFIG.supportedFormats.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
        aria-hidden="true"
      />

      <div className="flex flex-col items-center justify-center text-center space-y-6">
        {/* Icon */}
        <div
          className={cn(
            'rounded-full p-6 transition-colors bg-[var(--color-emerald-glow)]/10 group-hover:bg-[var(--color-emerald-glow)]/20',
            isDragging && !disabled && 'bg-[var(--holo-cyan)]/20'
          )}
        >
          {isDragging ? (
            <ImageIcon
              className="w-14 h-14 text-[var(--color-emerald-glow)]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          ) : (
            <Upload
              className="w-14 h-14 text-[var(--color-emerald-glow)]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Text */}
        <div className="space-y-3">
          <h3 className="text-2xl font-bold font-display">
            {isDragging ? 'Drop your image here' : 'Upload File'}
          </h3>
          <p className="text-base text-[var(--muted-foreground)] leading-relaxed px-4">
            {isDragging
              ? 'Release to upload'
              : 'Drag and drop or click to browse'}
          </p>
          {!isDragging && (
            <p className="text-sm text-[var(--muted-foreground)] opacity-75">
              JPG, PNG, HEIC • Max {UPLOAD_CONFIG.maxSizeMB} MB
            </p>
          )}
        </div>

        {/* Action hint */}
        <div className="pt-4">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-emerald-glow)] group-hover:gap-3 transition-all">
            {isDragging ? 'Drop Now' : 'Choose File'}
            <span className="text-base">→</span>
          </div>
        </div>
      </div>
    </div>
  );
}
