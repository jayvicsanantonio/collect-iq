'use client';

import * as React from 'react';
import { Camera, X, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface CameraError {
  type:
  | 'permission-denied'
  | 'not-supported'
  | 'no-camera'
  | 'unknown';
  message: string;
  originalError?: Error;
}

export interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  onError: (error: CameraError) => void;
  onClose: () => void;
  isOpen?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

// Video constraints are defined inline in startCamera() for dynamic facingMode

// ============================================================================
// Component
// ============================================================================

export function CameraCapture({
  onCapture,
  onError,
  onClose,
  isOpen = true,
}: CameraCaptureProps) {
  const [stream, setStream] = React.useState<MediaStream | null>(
    null
  );
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [showPermissionDialog, setShowPermissionDialog] =
    React.useState(false);
  const [facingMode, setFacingMode] = React.useState<
    'user' | 'environment'
  >('environment');

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // ============================================================================
  // Camera Initialization
  // ============================================================================

  const startCamera = React.useCallback(
    async (mode: 'user' | 'environment' = facingMode) => {
      try {
        // Check if getUserMedia is supported
        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          onError({
            type: 'not-supported',
            message:
              'Camera access is not supported in this browser. Please use a modern browser like Chrome, Safari, or Firefox.',
          });
          return;
        }

        // Request camera permission
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: mode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(
          constraints
        );

        setStream(mediaStream);

        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (error) {
        console.error('Camera access error:', error);

        if (error instanceof Error) {
          // Handle specific error types
          if (
            error.name === 'NotAllowedError' ||
            error.name === 'PermissionDeniedError'
          ) {
            setShowPermissionDialog(true);
            onError({
              type: 'permission-denied',
              message:
                'Camera permission denied. Please allow camera access in your browser settings.',
              originalError: error,
            });
          } else if (
            error.name === 'NotFoundError' ||
            error.name === 'DevicesNotFoundError'
          ) {
            onError({
              type: 'no-camera',
              message:
                'No camera found. Please connect a camera and try again.',
              originalError: error,
            });
          } else {
            onError({
              type: 'unknown',
              message: `Failed to access camera: ${error.message}`,
              originalError: error,
            });
          }
        } else {
          onError({
            type: 'unknown',
            message:
              'An unknown error occurred while accessing the camera.',
          });
        }
      }
    },
    [facingMode, onError]
  );

  // ============================================================================
  // Camera Cleanup
  // ============================================================================

  const stopCamera = React.useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  // ============================================================================
  // Camera Flip (Mobile)
  // ============================================================================

  const flipCamera = React.useCallback(() => {
    stopCamera();
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    startCamera(newMode);
  }, [facingMode, stopCamera, startCamera]);

  // ============================================================================
  // Photo Capture
  // ============================================================================

  const capturePhoto = React.useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Handle orientation for mobile devices
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            onCapture(blob);
            stopCamera();
            onClose();
          } else {
            onError({
              type: 'unknown',
              message: 'Failed to capture photo. Please try again.',
            });
          }
          setIsCapturing(false);
        },
        'image/jpeg',
        0.95
      );
    } catch (error) {
      console.error('Capture error:', error);
      onError({
        type: 'unknown',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to capture photo. Please try again.',
        originalError: error instanceof Error ? error : undefined,
      });
      setIsCapturing(false);
    }
  }, [onCapture, onError, onClose, stopCamera]);

  // ============================================================================
  // Lifecycle
  // ============================================================================

  React.useEffect(() => {
    if (isOpen) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Only run on mount/unmount

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <>
      {/* Main Camera Dialog */}
      <Dialog
        open={isOpen && !showPermissionDialog}
        onOpenChange={onClose}
      >
        <DialogContent className="!max-w-6xl p-0">
          <div className="relative flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
              <div>
                <DialogTitle>Capture Card Photo</DialogTitle>
                <DialogDescription className="mt-1">
                  Position your card in the frame and tap capture
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close camera"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Video Preview */}
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  'h-full w-full object-cover',
                  facingMode === 'user' && 'scale-x-[-1]' // Mirror front camera
                )}
              />

              {/* Overlay guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-dashed border-white/50 rounded-lg w-[80%] max-w-md aspect-[2.5/3.5]" />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-4 p-4 bg-[var(--card)]">
              {/* Flip camera button (mobile) */}
              <Button
                variant="outline"
                size="icon"
                onClick={flipCamera}
                disabled={isCapturing || !stream}
                aria-label="Flip camera"
                className="sm:invisible"
              >
                <RotateCw className="h-5 w-5" />
              </Button>

              {/* Capture button */}
              <Button
                variant="primary"
                size="lg"
                onClick={capturePhoto}
                disabled={isCapturing || !stream}
                className="flex-1 max-w-xs"
              >
                <Camera className="mr-2 h-5 w-5" />
                {isCapturing ? 'Capturing...' : 'Capture Photo'}
              </Button>

              {/* Spacer for alignment */}
              <div className="w-10 sm:invisible" />
            </div>
          </div>

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>

      {/* Permission Helper Dialog */}
      <Dialog
        open={showPermissionDialog}
        onOpenChange={setShowPermissionDialog}
      >
        <DialogContent className="!max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Camera Permission Required</DialogTitle>
            <DialogDescription className="space-y-6 pt-6">
              <p className="text-base">
                CollectIQ needs access to your camera to scan trading
                cards.
              </p>
              <div className="rounded-lg bg-[var(--muted)] p-6 text-base">
                <p className="font-semibold mb-3 text-base">
                  To enable camera access:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-[var(--muted-foreground)]">
                  <li>
                    Click the camera icon in your browser&apos;s
                    address bar
                  </li>
                  <li>
                    Select &quot;Allow&quot; for camera permissions
                  </li>
                  <li>Refresh the page and try again</li>
                </ol>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setShowPermissionDialog(false);
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setShowPermissionDialog(false);
                startCamera();
              }}
            >
              Try Again
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
