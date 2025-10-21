'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Camera } from 'lucide-react';
import { UploadDropzone } from '@/components/upload/UploadDropzone';
import { CameraCapture } from '@/components/upload/CameraCapture';
import { UploadProgress } from '@/components/upload/UploadProgress';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { UploadError } from '@/components/upload/UploadDropzone';
import type { CameraError } from '@/components/upload/CameraCapture';

// ============================================================================
// Types
// ============================================================================

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadState {
  file: File | null;
  progress: number;
  status: UploadStatus;
  error: string | null;
  s3Key: string | null;
  abortController: AbortController | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert HEIC/HEIF file to JPEG
 * Returns the original file if it's not HEIC/HEIF
 */
async function convertHeicToJpeg(file: File): Promise<File> {
  const fileName = file.name.toLowerCase();
  const isHeic =
    fileName.endsWith('.heic') || fileName.endsWith('.heif');

  if (!isHeic) {
    return file;
  }

  try {
    console.log('Converting HEIC to JPEG:', file.name);

    // Dynamically import heic2any only on client side
    const heic2any = (await import('heic2any')).default;

    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9, // High quality for upload
    });

    // heic2any can return Blob or Blob[], handle both
    const blob = Array.isArray(convertedBlob)
      ? convertedBlob[0]
      : convertedBlob;

    // Create new File with .jpg extension
    const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    const jpegFile = new File([blob], newFileName, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });

    console.log('HEIC conversion successful:', {
      original: `${file.name} (${(file.size / 1024 / 1024).toFixed(
        2
      )} MB)`,
      converted: `${jpegFile.name} (${(
        jpegFile.size /
        1024 /
        1024
      ).toFixed(2)} MB)`,
    });

    return jpegFile;
  } catch (error) {
    console.error('HEIC conversion failed:', error);
    throw new Error(
      'Failed to convert HEIC image. Please try a different format.'
    );
  }
}

// ============================================================================
// Component
// ============================================================================

export default function UploadPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showCamera, setShowCamera] = React.useState(false);
  const [uploadState, setUploadState] = React.useState<UploadState>({
    file: null,
    progress: 0,
    status: 'idle',
    error: null,
    s3Key: null,
    abortController: null,
  });

  // ============================================================================
  // Upload to S3
  // ============================================================================

  const uploadToS3 = React.useCallback(
    async (file: File) => {
      const abortController = new AbortController();

      setUploadState({
        file,
        progress: 0,
        status: 'uploading',
        error: null,
        s3Key: null,
        abortController,
      });

      try {
        // Step 1: Convert HEIC to JPEG if needed
        const fileToUpload = await convertHeicToJpeg(file);

        // Step 2: Get presigned URL
        const presignResponse = await api.getPresignedUrl({
          filename: fileToUpload.name,
          contentType: fileToUpload.type,
          sizeBytes: fileToUpload.size,
        });

        // Step 2: Upload to S3 with progress tracking
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete =
              (event.loaded / event.total) * 100;
            setUploadState((prev) => ({
              ...prev,
              progress: percentComplete,
            }));
          }
        });

        // Handle completion
        await new Promise<void>((resolve, reject) => {
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(
                new Error(`Upload failed with status ${xhr.status}`)
              );
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
          });

          xhr.addEventListener('abort', () => {
            reject(new Error('Upload cancelled'));
          });

          // Handle abort signal
          abortController.signal.addEventListener('abort', () => {
            xhr.abort();
          });

          // Start upload
          xhr.open('PUT', presignResponse.uploadUrl);
          xhr.setRequestHeader('Content-Type', fileToUpload.type);
          xhr.send(fileToUpload);
        });

        // Step 3: Upload successful - update state
        setUploadState((prev) => ({
          ...prev,
          progress: 100,
          status: 'success',
          s3Key: presignResponse.key,
          abortController: null,
        }));

        // Step 4: Create card record with S3 key
        toast({
          title: 'Upload successful',
          description: 'Creating card record...',
        });

        const card = await api.createCard({
          frontS3Key: presignResponse.key,
        });

        // Step 5: Redirect to card detail/processing screen
        toast({
          title: 'Card created',
          description: 'Analyzing your card...',
        });

        setTimeout(() => {
          const cardUrl = `/cards/${card.cardId}` as Route;
          router.push(cardUrl);
        }, 2000); // Increased delay to allow GSI propagation
      } catch (error) {
        console.error('Upload error:', error);

        // Check if upload was cancelled
        if (
          error instanceof Error &&
          error.message === 'Upload cancelled'
        ) {
          setUploadState({
            file: null,
            progress: 0,
            status: 'idle',
            error: null,
            s3Key: null,
            abortController: null,
          });
          return;
        }

        // Handle API errors with specific messages
        let errorMessage = 'Failed to upload file. Please try again.';
        if (error instanceof ApiError) {
          // Map specific error codes to user-friendly messages
          if (error.status === 413) {
            errorMessage = `File is too large. Max is 12 MB.`;
          } else if (error.status === 415) {
            errorMessage =
              'Unsupported format. Use JPG, PNG, or HEIC.';
          } else {
            errorMessage =
              error.problem?.detail ||
              error.problem?.title ||
              error.message;
          }
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }

        setUploadState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMessage,
          abortController: null,
        }));

        toast({
          variant: 'destructive',
          title: 'Upload failed',
          description: errorMessage,
        });
      }
    },
    [router, toast]
  );

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleFileSelected = React.useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        uploadToS3(files[0]);
      }
    },
    [uploadToS3]
  );

  const handleUploadError = React.useCallback(
    (error: UploadError) => {
      toast({
        variant: 'destructive',
        title: 'Invalid file',
        description: error.message,
      });
    },
    [toast]
  );

  const handleCameraCapture = React.useCallback(
    (blob: Blob) => {
      // Convert blob to file
      const file = new File([blob], `card-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      uploadToS3(file);
    },
    [uploadToS3]
  );

  const handleCameraError = React.useCallback(
    (error: CameraError) => {
      toast({
        variant: 'destructive',
        title: 'Camera error',
        description: error.message,
      });
    },
    [toast]
  );

  const handleCancelUpload = React.useCallback(() => {
    if (uploadState.abortController) {
      uploadState.abortController.abort();
    }
  }, [uploadState.abortController]);

  const handleRetryUpload = React.useCallback(() => {
    if (uploadState.file) {
      uploadToS3(uploadState.file);
    }
  }, [uploadState.file, uploadToS3]);

  // ============================================================================
  // Cleanup
  // ============================================================================

  React.useEffect(() => {
    // Cleanup on unmount - abort any ongoing uploads
    return () => {
      if (uploadState.abortController) {
        uploadState.abortController.abort();
      }
    };
  }, [uploadState.abortController]);

  // Note: Object URLs for image previews are managed by UploadProgress component

  // ============================================================================
  // Render
  // ============================================================================

  const isUploading = uploadState.status === 'uploading';
  const hasUpload = uploadState.file !== null;

  return (
    <div className="min-h-screen flex flex-col relative bg-[var(--background)]">
      {/* Gradient Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 landing-gradient" />
      </div>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 landing-radials" />
      </div>

      <main className="flex-1 relative z-10 flex items-start justify-center px-6 pt-20 pb-12">
        <div className="max-w-6xl w-full">
          {/* Header */}
          <div className="mb-12 text-center">
            <h1
              className="mb-4 text-5xl sm:text-6xl md:text-7xl font-bold font-display tracking-[-0.02em]"
              style={{
                textShadow:
                  'var(--text-shadow, 0 2px 8px rgba(0, 0, 0, 0.3))',
              }}
            >
              <span
                className="bg-gradient-to-tr from-[var(--color-holo-cyan)] via-[var(--color-emerald-glow)] to-[var(--color-vault-blue)] bg-clip-text text-transparent"
                style={{
                  textShadow: 'none',
                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
                }}
              >
                Scan Your Card
              </span>
            </h1>
            <p
              className="text-xl sm:text-2xl"
              style={{
                color: 'var(--foreground)',
                opacity: 0.9,
                textShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
              }}
            >
              Choose how you&apos;d like to add your trading card
            </p>
          </div>

          {/* Upload Progress - Centered and Prominent */}
          {hasUpload && (
            <div className="flex items-center justify-center min-h-[400px] w-full">
              <UploadProgress
                file={uploadState.file!}
                progress={uploadState.progress}
                status={uploadState.status}
                error={uploadState.error || undefined}
                onCancel={
                  isUploading ? handleCancelUpload : undefined
                }
                onRetry={
                  uploadState.status === 'error'
                    ? handleRetryUpload
                    : undefined
                }
                className="shadow-2xl"
              />
            </div>
          )}

          {/* Upload Options - Card Layout */}
          {!hasUpload && (
            <>
              <style jsx>{`
                @media (min-width: 640px) {
                  .upload-card {
                    width: 340px !important;
                    height: 476px !important;
                  }
                }
              `}</style>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8">
                {/* Camera Capture Card */}
                <button
                  onClick={() => setShowCamera(true)}
                  disabled={isUploading}
                  className="upload-card group relative p-6 sm:p-10 rounded-xl sm:rounded-2xl transition-all duration-300 flex flex-col items-center justify-center border-2 border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:border-[var(--color-holo-cyan)] hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 w-full touch-manipulation"
                  style={{
                    backgroundColor: 'var(--background)',
                    minHeight: '280px',
                  }}
                >
                  <div className="flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6">
                    <div className="rounded-full p-4 sm:p-6 bg-[var(--color-holo-cyan)]/10 group-hover:bg-[var(--color-holo-cyan)]/20 transition-colors">
                      <Camera
                        className="w-10 h-10 sm:w-14 sm:h-14 text-[var(--color-holo-cyan)]"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="space-y-2 sm:space-y-3">
                      <h3 className="text-xl sm:text-2xl font-bold font-display">
                        Capture Photo
                      </h3>
                      <p className="text-sm sm:text-base text-[var(--muted-foreground)] leading-relaxed px-2 sm:px-4">
                        Use your camera to snap a photo of your card
                      </p>
                    </div>
                    <div className="pt-2 sm:pt-4">
                      <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-holo-cyan)] group-hover:gap-3 transition-all">
                        Open Camera
                        <span className="text-base">→</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* File Upload Card */}
                <div
                  className="upload-card group relative rounded-xl sm:rounded-2xl transition-all duration-300 border-2 border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:border-[var(--color-emerald-glow)] hover:shadow-xl hover:scale-[1.02] overflow-hidden w-full"
                  style={{
                    backgroundColor: 'var(--background)',
                    minHeight: '280px',
                  }}
                >
                  <UploadDropzone
                    onSelected={handleFileSelected}
                    onError={handleUploadError}
                    disabled={isUploading}
                    className="h-full w-full border-0 rounded-none p-6 sm:p-10 min-h-0 hover:border-0 hover:bg-transparent"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Camera Capture Modal */}
      {showCamera && (
        <CameraCapture
          isOpen={showCamera}
          onCapture={handleCameraCapture}
          onError={handleCameraError}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
