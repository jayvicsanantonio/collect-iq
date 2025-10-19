# Upload Components

This directory contains components for the card image upload flow in CollectIQ.

## Components

### UploadDropzone

Drag-and-drop file upload zone with validation and error handling.

**Props:**

```typescript
interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  onError: (error: string) => void;
  maxSizeMB?: number;
  disabled?: boolean;
}
```

**Features:**

- Drag-and-drop and click-to-upload
- Client-side validation (size, format, dimensions)
- Live validation feedback during drag-over
- Accessible keyboard navigation
- Screen reader announcements

**Validation Rules:**

- Max file size: 12 MB (configurable via `NEXT_PUBLIC_MAX_UPLOAD_MB`)
- Supported formats: JPG, PNG, HEIC
- Recommended dimensions: 2000–4000 px (long edge)
- Minimum dimensions: 1200 px (warning only, non-blocking)

**Error Messages:**

- "File is too large. Max is 12 MB."
- "That format isn't supported. Use JPG, PNG, or HEIC."
- "Low-resolution image; results may be less accurate." (toast)

**Usage:**

```tsx
import { UploadDropzone } from '@/components/upload/UploadDropzone';

function UploadPage() {
  const handleFileSelected = async (file: File) => {
    // Request presign URL and upload
  };

  const handleError = (error: string) => {
    toast.error(error);
  };

  return (
    <UploadDropzone onFileSelected={handleFileSelected} onError={handleError} />
  );
}
```

---

### CameraCapture

Mobile camera capture with orientation handling.

**Props:**

```typescript
interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}
```

**Features:**

- Native camera access via `getUserMedia`
- EXIF orientation preservation
- iOS Safari compatibility
- Permission request handling
- Fallback to file picker

**Usage:**

```tsx
import { CameraCapture } from '@/components/upload/CameraCapture';

function UploadPage() {
  return <CameraCapture onCapture={handleFileSelected} onError={handleError} />;
}
```

---

### UploadProgress

Progress indicator for S3 upload.

**Props:**

```typescript
interface UploadProgressProps {
  progress: number; // 0-100
  fileName: string;
  onCancel: () => void;
}
```

**Features:**

- Animated progress bar
- File name display
- Cancel button
- Accessible progress announcements

**Usage:**

```tsx
import { UploadProgress } from '@/components/upload/UploadProgress';

function UploadPage() {
  const [progress, setProgress] = useState(0);

  return (
    <UploadProgress
      progress={progress}
      fileName="card.jpg"
      onCancel={handleCancel}
    />
  );
}
```

---

## Validation Utilities

### validateUploadFile

Client-side file validation before presign request.

```typescript
import { validateUploadFile } from '@/lib/upload-validators';

const result = validateUploadFile(file);

if (!result.valid) {
  showError(result.error);
  return;
}

// Proceed with upload
```

**Returns:**

```typescript
{
  valid: boolean;
  error?: string;
  warnings?: string[];
  metadata?: {
    dimensions?: { width: number; height: number };
    longestEdge?: number;
  };
}
```

---

## Image Compression

### compressImage

Client-side image downscaling for oversized files (mobile).

```typescript
import { compressImage } from '@/lib/image-compression';

const compressedFile = await compressImage(file, {
  targetSizeMB: 8,
  preserveExif: true,
});
```

**Options:**

```typescript
{
  targetSizeMB?: number;      // Default: 8
  quality?: number;           // Default: 0.85
  preserveExif?: boolean;     // Default: true
  maxDimension?: number;      // Default: 4000
}
```

---

## UI Copy

### Dropzone States

**Default:**

```
📷  Drag & drop or click to upload

JPG, PNG, or HEIC • Up to 12 MB
Best results: 2000–4000 px
```

**Drag-Over (Valid):**

```
✓  Drop to upload
```

**Drag-Over (Invalid):**

```
✗  File is too large (15.2 MB)
```

**Error:**

```
⚠️  File is too large. Max is 12 MB.

[Try another file]
```

### Compression Dialog (Mobile)

```
Compress Image?

This file is 14.3 MB. Compress to upload faster?

Original: 14.3 MB → ~8 MB

[Cancel]  [Compress & Upload]
```

### Toast Messages

**Low Resolution Warning:**

```
Low-resolution image; results may be less accurate.
```

**Upload Success:**

```
Image uploaded successfully
```

**Upload Failed:**

```
Upload failed. Check your connection and try again.
```

---

## Accessibility

### Keyboard Navigation

- `Tab`: Focus dropzone
- `Enter` or `Space`: Open file picker
- `Escape`: Cancel upload in progress

### ARIA Attributes

```tsx
<div
  role="button"
  tabIndex={0}
  aria-label="Upload card image. Accepts JPG, PNG, or HEIC up to 12 megabytes."
  aria-describedby="upload-hint"
  aria-invalid={hasError}
  aria-live="polite"
>
  {/* Dropzone content */}
</div>
```

### Screen Reader Announcements

- File selected: "Selected [filename], [size]. Ready to upload."
- Validation error: "Upload blocked. File is too large. Maximum is 12 megabytes."
- Upload progress: "Uploading [filename], [progress] percent complete."
- Upload complete: "Upload complete. Analyzing card."

---

## Telemetry

### Events Emitted

| Event                             | Trigger                     | Metadata                                                  |
| --------------------------------- | --------------------------- | --------------------------------------------------------- |
| `upload_start`                    | File selected and validated | fileSize, fileType, pathway                               |
| `upload_blocked_too_large`        | File exceeds 12 MB          | fileSize, fileType, pathway                               |
| `upload_blocked_unsupported_type` | Unsupported format          | fileSize, fileType, pathway                               |
| `upload_compressed_client`        | Mobile compression applied  | fileSize, fileType, compressionApplied, originalSize      |
| `upload_success`                  | Upload to S3 complete       | fileSize, fileType, compressionApplied, pathway, duration |
| `upload_fail_network`             | Network error during upload | fileSize, fileType, pathway, errorCode                    |
| `upload_fail_policy`              | Server policy rejection     | fileSize, fileType, pathway, status, reason               |

**Pathway values:**

- `"drag"`: Drag-and-drop
- `"picker"`: File picker (click)
- `"camera"`: Camera capture

---

## Configuration

### Environment Variables

```bash
# apps/web/.env.local
NEXT_PUBLIC_MAX_UPLOAD_MB=12
NEXT_PUBLIC_SUPPORTED_FORMATS=jpg,jpeg,png,heic
NEXT_PUBLIC_MIN_DIMENSION_PX=1200
NEXT_PUBLIC_OPTIMAL_DIMENSION_PX=2000-4000
```

### Runtime Config

```typescript
// lib/upload-config.ts
export const UPLOAD_CONFIG = {
  maxSizeMB: Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 12,
  maxSizeBytes:
    (Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 12) * 1024 * 1024,
  supportedFormats: ['image/jpeg', 'image/png', 'image/heic'],
  supportedExtensions: ['.jpg', '.jpeg', '.png', '.heic'],
  minDimensionPx: 1200,
  optimalDimensionRange: [2000, 4000],
} as const;
```

---

## Testing

### Unit Tests

```bash
pnpm test components/upload
```

### E2E Tests

```bash
pnpm test:e2e upload
```

### Accessibility Tests

```bash
pnpm test:a11y upload
```

---

## References

- [Image Upload Specification](../../../docs/Frontend/image-upload-spec.md)
- [Acceptance Criteria](../../../docs/Frontend/image-upload-acceptance.md)
- [Design System](../../../docs/Frontend/Design%20System.md)
- [Error Handling](../../lib/ERROR_HANDLING.md)
