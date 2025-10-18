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
        // Step 1: Get presigned URL
        const presignResponse = await api.getPresignedUrl({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        });

        // Step 2: Upload to S3 with progress tracking
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
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
              reject(new Error(`Upload failed with status ${xhr.status}`));
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
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });

        // Step 3: Upload successful
        setUploadState((prev) => ({
          ...prev,
          progress: 100,
          status: 'success',
          s3Key: presignResponse.key,
          abortController: null,
        }));

        // Step 4: Redirect to identification screen
        toast({
          title: 'Upload successful',
          description: 'Analyzing your card...',
        });

        // Navigate to identification page with the S3 key
        setTimeout(() => {
          const identifyUrl =
            `/identify?key=${encodeURIComponent(presignResponse.key)}` as Route;
          router.push(identifyUrl);
        }, 500);
      } catch (error) {
        console.error('Upload error:', error);

        // Check if upload was cancelled
        if (error instanceof Error && error.message === 'Upload cancelled') {
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

        // Handle API errors
        let errorMessage = 'Failed to upload file. Please try again.';
        if (error instanceof ApiError) {
          errorMessage =
            error.problem?.detail || error.problem?.title || error.message;
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
    // Cleanup on unmount
    return () => {
      if (uploadState.abortController) {
        uploadState.abortController.abort();
      }
    };
  }, [uploadState.abortController]);

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

      <main className="flex-1 relative z-10 flex items-center justify-center px-6 py-12">
        <div className="max-w-6xl w-full">
          {/* Header */}
          <div className="mb-16 text-center">
            <h1
              className="mb-4 text-5xl sm:text-6xl md:text-7xl font-bold font-display tracking-[-0.02em]"
              style={{
                textShadow: 'var(--text-shadow, 0 2px 8px rgba(0, 0, 0, 0.3))',
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
              Choose how you'd like to add your trading card
            </p>
          </div>

          {/* Upload Progress */}
          {hasUpload && (
            <div className="mb-8 max-w-2xl mx-auto">
              <UploadProgress
                file={uploadState.file!}
                progress={uploadState.progress}
                status={uploadState.status}
                error={uploadState.error || undefined}
                onCancel={isUploading ? handleCancelUpload : undefined}
                onRetry={
                  uploadState.status === 'error' ? handleRetryUpload : undefined
                }
              />
            </div>
          )}

          {/* Upload Options - Card Layout */}
          {!hasUpload && (
            <div className="flex justify-center items-center gap-8">
              {/* Camera Capture Card */}
              <button
                onClick={() => setShowCamera(true)}
                disabled={isUploading}
                className="group relative p-10 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center border-2 border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:border-[var(--color-holo-cyan)] hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  backgroundColor: 'var(--background)',
                  width: '340px',
                  height: '476px',
                }}
              >
                <div className="flex flex-col items-center justify-center text-center space-y-6">
                  <div className="rounded-full p-6 bg-[var(--color-holo-cyan)]/10 group-hover:bg-[var(--color-holo-cyan)]/20 transition-colors">
                    <Camera
                      className="w-14 h-14 text-[var(--color-holo-cyan)]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold font-display">
                      Capture Photo
                    </h3>
                    <p className="text-base text-[var(--muted-foreground)] leading-relaxed px-4">
                      Use your camera to snap a photo of your card
                    </p>
                  </div>
                  <div className="pt-4">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-holo-cyan)] group-hover:gap-3 transition-all">
                      Open Camera
                      <span className="text-base">→</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* File Upload Card */}
              <div
                className="group relative rounded-2xl transition-all duration-300 border-2 border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:border-[var(--color-emerald-glow)] hover:shadow-xl hover:scale-[1.02] overflow-hidden"
                style={{
                  backgroundColor: 'var(--background)',
                  width: '340px',
                  height: '476px',
                }}
              >
                <UploadDropzone
                  onSelected={handleFileSelected}
                  onError={handleUploadError}
                  disabled={isUploading}
                  className="h-full w-full border-0 rounded-none p-10 min-h-0 hover:border-0 hover:bg-transparent"
                />
              </div>
            </div>
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
