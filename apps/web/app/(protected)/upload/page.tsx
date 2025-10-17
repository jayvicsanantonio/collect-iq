'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
          router.push(
            `/identify?key=${encodeURIComponent(presignResponse.key)}`
          );
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
          errorMessage = error.problem.detail || error.problem.title;
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
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Header */}
      <header className="mb-8 text-center">
        <h1
          className="mb-2 text-4xl font-bold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Upload Card
        </h1>
        <p className="text-[var(--muted-foreground)]">
          Take a photo or upload an image of your trading card
        </p>
      </header>

      {/* Upload Progress */}
      {hasUpload && (
        <section className="mb-6" aria-label="Upload progress">
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
        </section>
      )}

      {/* Upload Options */}
      {!hasUpload && (
        <section aria-label="Upload options">
          {/* Mobile: Show buttons side by side */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:hidden">
            <Button
              variant="gradient"
              size="lg"
              onClick={() => setShowCamera(true)}
              className="w-full touch-target"
            >
              <Camera className="mr-2 h-5 w-5" />
              Camera
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/jpeg,image/png,image/heic';
                input.capture = 'environment'; // Prefer rear camera on mobile
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (files && files.length > 0) {
                    handleFileSelected(Array.from(files));
                  }
                };
                input.click();
              }}
              className="w-full touch-target"
            >
              <Upload className="mr-2 h-5 w-5" />
              Gallery
            </Button>
          </div>

          {/* Desktop: Show camera button and dropzone */}
          <div className="hidden sm:block">
            <div className="mb-6">
              <Button
                variant="gradient"
                size="lg"
                onClick={() => setShowCamera(true)}
                className="w-full"
              >
                <Camera className="mr-2 h-5 w-5" />
                Take Photo
              </Button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[var(--background)] px-2 text-[var(--muted-foreground)]">
                  Or
                </span>
              </div>
            </div>

            {/* Dropzone */}
            <UploadDropzone
              onSelected={handleFileSelected}
              onError={handleUploadError}
              disabled={isUploading}
            />
          </div>

          {/* Mobile: Show dropzone below buttons */}
          <div className="sm:hidden">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[var(--background)] px-2 text-[var(--muted-foreground)]">
                  Or drag and drop
                </span>
              </div>
            </div>

            <UploadDropzone
              onSelected={handleFileSelected}
              onError={handleUploadError}
              disabled={isUploading}
              autoCompress={true}
            />
          </div>
        </section>
      )}

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
