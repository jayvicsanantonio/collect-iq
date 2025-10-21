'use client';

import * as React from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface UploadProgressProps {
  file: File;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

export function UploadProgress({
  file,
  progress,
  status,
  error,
  onCancel,
  onRetry,
  className,
}: UploadProgressProps) {
  const [thumbnailUrl, setThumbnailUrl] = React.useState<
    string | null
  >(null);
  const [isConverting, setIsConverting] = React.useState(false);

  React.useEffect(() => {
    let objectUrl: string | null = null;

    const loadThumbnail = async () => {
      try {
        const fileName = file.name.toLowerCase();
        const isHeicFile =
          fileName.endsWith('.heic') || fileName.endsWith('.heif');

        if (isHeicFile) {
          // Convert HEIC to JPEG for preview
          setIsConverting(true);

          // Dynamically import heic2any only on client side
          const heic2any = (await import('heic2any')).default;

          const convertedBlob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.7, // Lower quality for preview (faster)
          });

          // heic2any can return Blob or Blob[], handle both cases
          const blob = Array.isArray(convertedBlob)
            ? convertedBlob[0]
            : convertedBlob;
          objectUrl = URL.createObjectURL(blob);
          setThumbnailUrl(objectUrl);
          setIsConverting(false);
        } else {
          // For JPEG/PNG, create object URL directly
          objectUrl = URL.createObjectURL(file);
          setThumbnailUrl(objectUrl);
        }
      } catch (err) {
        console.error('Failed to load thumbnail:', err);
        setIsConverting(false);
        // Keep thumbnailUrl as null to show loading state
      }
    };

    loadThumbnail();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file]);

  const progressPercent = Math.min(Math.max(progress, 0), 100);
  const isComplete = status === 'success';
  const hasError = status === 'error';

  return (
    <div className={cn('w-full max-w-4xl mx-auto', className)}>
      <div
        className={cn(
          'relative flex flex-row items-center gap-8 rounded-2xl border-[3px] p-10 transition-all w-full min-h-[200px]',
          hasError
            ? 'border-red-400 bg-red-50 dark:bg-red-900/30'
            : 'border-emerald-400/70 bg-emerald-50/50 dark:bg-emerald-950/30'
        )}
        style={{
          boxShadow: hasError
            ? '0 8px 30px rgba(239, 68, 68, 0.4)'
            : '0 8px 30px rgba(16, 185, 129, 0.5)',
        }}
      >
        <div className="relative h-48 w-48 flex-shrink-0 overflow-hidden rounded-xl bg-white dark:bg-gray-700 border-2 border-emerald-300/50 shadow-lg">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={file.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 dark:border-gray-600 border-t-emerald-500" />
              {isConverting && (
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Converting...
                </span>
              )}
            </div>
          )}

          {isComplete && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-500/90">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
          )}
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-500/90">
              <AlertCircle className="h-10 w-10 text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3 break-words">
            {file.name}
          </h3>

          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
            {formatFileSize(file.size)}
          </p>

          {(status === 'idle' || status === 'uploading') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-lg">
                <span className="text-gray-700 dark:text-gray-200 font-semibold">
                  {status === 'idle'
                    ? 'Preparing...'
                    : 'Uploading...'}
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-2xl">
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div className="h-5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-emerald-500 transition-all duration-300 ease-out shadow-lg"
                  style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center gap-3 text-lg font-bold text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-8 w-8" />
              <span>Upload complete</span>
            </div>
          )}

          {status === 'error' && error && (
            <div className="flex items-start gap-3 text-lg text-red-600 dark:text-red-400">
              <AlertCircle className="h-8 w-8 flex-shrink-0 mt-0.5" />
              <span className="break-words font-semibold">
                {error}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {status === 'uploading' && onCancel && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              aria-label="Cancel upload"
              className="h-14 w-14"
            >
              <X className="h-7 w-7" />
            </Button>
          )}

          {status === 'error' && onRetry && (
            <Button
              variant="outline"
              size="lg"
              onClick={onRetry}
              className="text-lg px-8 py-6"
            >
              Retry Upload
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${
    sizes[i]
  }`;
}
