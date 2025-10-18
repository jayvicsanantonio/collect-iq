# Upload Flow Implementation

## Overview

This PR implements the complete upload flow for CollectIQ, including drag-and-drop file upload, camera capture, progress tracking, and first-run empty state experience.

## Changes

### New Components

#### 1. **UploadDropzone** (`apps/web/components/upload/UploadDropzone.tsx`)

- Drag-and-drop area with visual feedback (hover, active, dragging states)
- File picker integration with click-to-browse
- Client-side validation:
  - File type: JPG, PNG, HEIC only
  - File size: Maximum 12 MB
- Inline error messages for validation failures
- Mobile-optimized with tap-to-upload
- Full keyboard accessibility (Enter/Space to activate)

#### 2. **CameraCapture** (`apps/web/components/upload/CameraCapture.tsx`)

- getUserMedia API integration for camera access
- Camera permission request handling with helper dialog
- Photo capture functionality with canvas-based image processing
- Front/back camera flip for mobile devices
- iOS Safari compatibility with proper orientation handling
- Visual guide overlay for card positioning
- Error handling for permission denied, no camera, and unsupported browsers

#### 3. **UploadProgress** (`apps/web/components/upload/UploadProgress.tsx`)

- Real-time progress bar with percentage display
- Thumbnail preview using object URLs
- Cancel button with abort functionality during upload
- Retry button for failed uploads
- Status indicators (uploading, success, error)
- Automatic cleanup of object URLs on unmount

#### 4. **EmptyVault** (`apps/web/components/vault/EmptyVault.tsx`)

- Hero layout with gradient icon and compelling headline
- Dual CTAs for camera and file upload
- Feature cards highlighting:
  - Real-time valuation
  - Authenticity verification
  - Secure storage
- Mobile-responsive design

### Updated Pages

#### **Upload Page** (`apps/web/app/(protected)/upload/page.tsx`)

- Complete upload workflow implementation:
  1. Request presigned URL from API
  2. Direct S3 upload with XMLHttpRequest for progress tracking
  3. Automatic redirect to identification screen on success
- Camera capture integration with blob-to-file conversion
- Upload state management (idle, uploading, success, error)
- Abort controller for cancellable uploads
- Error handling with retry capability
- Object URL cleanup on unmount

#### **Vault Page** (`apps/web/app/(protected)/vault/page.tsx`)

- Check for existing cards on mount
- Display EmptyVault component for first-run users
- Loading state with spinner
- Graceful error handling (shows empty state on API error)

### Task Tracking

Updated `.kiro/specs/collectiq-frontend/tasks.md` to mark all upload flow tasks as completed:

- ✅ 5.1 Create UploadDropzone component
- ✅ 5.2 Create CameraCapture component
- ✅ 5.3 Create UploadProgress component
- ✅ 5.4 Implement upload workflow
- ✅ 5.5 Create first-run empty state

## Requirements Implemented

This PR implements the following requirements from the frontend spec:

- **2.1**: File type validation (JPG, PNG, HEIC)
- **2.2**: File size validation (≤ 12 MB)
- **2.3**: Inline error messages for validation failures
- **2.4**: Presigned URL request flow
- **2.5**: Direct S3 upload
- **2.6**: Camera capture with getUserMedia API
- **2.7**: Camera permission handling
- **2.8**: Upload progress tracking
- **2.9**: Cancel/retry functionality
- **2.10**: Automatic redirect to identification screen

## Technical Details

### File Upload Flow

1. User selects file via dropzone or camera
2. Client-side validation (type, size)
3. Request presigned URL from backend API
4. Upload directly to S3 with progress tracking
5. On success, redirect to `/identify?key={s3Key}`

### Camera Capture Flow

1. User clicks "Take Photo" button
2. Request camera permission via getUserMedia
3. Display video preview with guide overlay
4. Capture frame to canvas on button click
5. Convert canvas to JPEG blob (95% quality)
6. Convert blob to File and trigger upload flow

### State Management

- Upload state tracked with React useState
- AbortController for cancellable uploads
- Object URLs created for thumbnails and cleaned up on unmount
- Toast notifications for errors and success

### Accessibility

- Keyboard navigation support (Enter/Space)
- ARIA labels and roles
- Focus management
- Screen reader friendly error messages

## Testing

### Manual Testing Checklist

- [ ] Drag and drop image file
- [ ] Click to browse and select file
- [ ] Validate file type rejection (try .pdf, .txt)
- [ ] Validate file size rejection (try >12MB file)
- [ ] Camera capture on desktop
- [ ] Camera capture on mobile (front/back flip)
- [ ] Camera permission denial handling
- [ ] Upload progress display
- [ ] Cancel upload mid-progress
- [ ] Retry failed upload
- [ ] Empty vault state display
- [ ] Redirect to identification screen

### Browser Compatibility

- Chrome/Edge (Chromium)
- Safari (desktop and iOS)
- Firefox

## Screenshots

### Upload Page

- Dropzone with drag-and-drop
- Camera capture modal
- Upload progress with thumbnail

### Empty Vault

- Hero section with CTAs
- Feature cards

## Dependencies

No new dependencies added. Uses existing:

- `@radix-ui/react-dialog` for camera modal
- `lucide-react` for icons
- Existing API client and toast system

## Breaking Changes

None. This is a new feature implementation.

## Next Steps

After this PR is merged, the next task will be to implement the identification screen that receives the uploaded S3 key and displays card analysis results.

## Related Issues

Implements task 5 from `.kiro/specs/collectiq-frontend/tasks.md`
