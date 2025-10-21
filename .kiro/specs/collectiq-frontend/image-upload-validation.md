# Image Upload Validation Feature

## Overview

This spec defines the implementation of user-friendly, enforceable image upload validation rules for CollectIQ, aligned with backend constraints (12 MB limit, JPG/PNG/HEIC formats) and cost/latency optimization goals. All validation is performed client-side before requesting presigned URLs, with graceful fallback handling for server-side policy enforcement.

## References

- **Detailed Specification**: #[[file:docs/Frontend/image-upload-spec.md]]
- **Acceptance Criteria**: #[[file:docs/Frontend/image-upload-acceptance.md]]
- **Component Documentation**: #[[file:apps/web/components/upload/README.md]]
- **UI Copy Reference**: #[[file:docs/Frontend/ui-copy.md]]

## Requirements

### Functional Requirements

1. **File Size Validation**
   - Hard cap: 12 MB per image (configurable via `NEXT_PUBLIC_MAX_UPLOAD_MB`)
   - Client-side enforcement before presign request
   - Live validation during drag-over and file selection
   - Error message: "File is too large. Max is 12 MB."
   - No network call for oversized files

2. **Format Validation**
   - Accepted formats: JPG/JPEG, PNG, HEIC
   - Validate both MIME type and file extension
   - Error message: "That format isn't supported. Use JPG, PNG, or HEIC."
   - Block unsupported formats before presign request

3. **Dimension Guidance**
   - Recommended: 2000–4000 px (long edge)
   - Minimum: 1200 px (warning only, non-blocking)
   - Non-blocking toast: "Low-resolution image; results may be less accurate."
   - Display hint in dropzone: "Best results: 2000–4000 px"

4. **Mobile Compression**
   - Detect oversized files on mobile devices
   - Offer client-side downscale with EXIF preservation
   - Confirmation dialog: "Compress to upload faster (recommended)?"
   - Target ~8 MB after compression
   - Maintain aspect ratio and orientation

5. **Server Error Mapping**
   - Map 413 → "File is too large. Max is 12 MB."
   - Map 415 → "Unsupported format. Use JPG, PNG, or HEIC."
   - Map presign rejection → "Upload was denied by the server policy. Try a smaller file or supported format."
   - Always provide retry action

### Non-Functional Requirements

1. **Accessibility**
   - Keyboard navigable dropzone (Tab, Enter, Space, Escape)
   - ARIA labels and live regions for validation errors
   - Screen reader announcements for all states
   - Visible focus indicators (Holo Cyan, 2px offset)
   - WCAG 2.2 AA compliance

2. **Performance**
   - Validation completes within 100ms
   - No layout shift during error display
   - Compression completes within 3 seconds on mid-range mobile

3. **Telemetry**
   - Emit events for all upload outcomes
   - Include file size (rounded to KB), type, compression status, pathway
   - Respect privacy: no file names or content in logs

4. **Security**
   - Client validation is UX optimization, not security boundary
   - Backend presign policy is authoritative
   - Defense in depth: client → presign → backend

## Design

### Validation Flow

```
User selects file
    ↓
Check file size (> 12 MB?)
    ↓ Yes (Mobile?)
    ↓ Yes
Offer compression
    ↓ Accept?
    ↓ Yes
Compress image (preserve EXIF)
    ↓
Check format (JPG/PNG/HEIC?)
    ↓ Valid
Extract dimensions
    ↓ < 1200 px?
    ↓ Yes
Show warning toast (non-blocking)
    ↓
Request presign URL
    ↓
Upload to S3
```

### Component Architecture

```
UploadDropzone (apps/web/components/upload/UploadDropzone.tsx)
    ├── File validation (lib/upload-validators.ts)
    ├── Compression dialog (mobile)
    ├── Progress indicator
    └── Error states

Supporting utilities:
    ├── lib/upload-config.ts (configuration)
    ├── lib/upload-validators.ts (validation logic)
    ├── lib/image-compression.ts (compression algorithm)
    └── lib/telemetry.ts (event tracking)
```

### Data Models

```typescript
// lib/upload-config.ts
export const UPLOAD_CONFIG = {
  maxSizeMB: Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 12,
  maxSizeBytes: (Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 12) * 1024 * 1024,
  supportedFormats: ['image/jpeg', 'image/png', 'image/heic', 'image/heif'],
  supportedExtensions: ['.jpg', '.jpeg', '.png', '.heic', '.heif'],
  minDimensionPx: 1200,
  optimalDimensionRange: [2000, 4000],
} as const;

// lib/upload-validators.ts
interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  metadata?: {
    dimensions?: { width: number; height: number };
    longestEdge?: number;
  };
}

// lib/telemetry.ts
type UploadTelemetryEvent = {
  event:
    | 'upload_start'
    | 'upload_blocked_too_large'
    | 'upload_blocked_unsupported_type'
    | 'upload_compressed_client'
    | 'upload_success'
    | 'upload_fail_network'
    | 'upload_fail_policy';

  metadata: {
    fileSize: number; // Rounded to nearest KB
    fileType: string; // MIME type
    compressionApplied: boolean;
    pathway: 'drag' | 'picker' | 'camera';
    timestamp: string; // ISO 8601
    sessionId: string; // User session identifier
  };
};
```

## Tasks

### Phase 1: Core Validation (Priority: P0)

- [ ] **Task 1.1**: Create upload configuration module
  - File: `apps/web/lib/upload-config.ts`
  - Export `UPLOAD_CONFIG` constant with environment variable support
  - Add TypeScript types for configuration
  - Write unit tests for config parsing
  - _Estimated: 1 hour_

- [ ] **Task 1.2**: Implement file validation utilities
  - File: `apps/web/lib/upload-validators.ts`
  - Implement `validateUploadFile(file: File): ValidationResult`
  - Check file size against `UPLOAD_CONFIG.maxSizeBytes`
  - Check MIME type and extension against allowed lists
  - Extract image dimensions (if needed for warnings)
  - Write comprehensive unit tests (10+ test cases)
  - _Estimated: 3 hours_

- [ ] **Task 1.3**: Update UploadDropzone component with validation
  - File: `apps/web/components/upload/UploadDropzone.tsx`
  - Add size/type checks before presign request
  - Show inline validation errors
  - Block invalid files with appropriate messages
  - Update UI to display limit: "JPG, PNG, or HEIC • Up to 12 MB"
  - Add hint text: "Best results: 2000–4000 px"
  - Emit telemetry for blocked uploads
  - _Estimated: 4 hours_

- [ ] **Task 1.4**: Implement drag-over validation feedback
  - File: `apps/web/components/upload/UploadDropzone.tsx`
  - Validate file during drag-over event
  - Show red border + error message for invalid files
  - Show blue border + success message for valid files
  - Add shake animation for invalid files
  - Add scale animation for valid files
  - _Estimated: 2 hours_

### Phase 2: Error Handling (Priority: P0)

- [ ] **Task 2.1**: Implement server error mapping
  - File: `apps/web/lib/api.ts` or `apps/web/lib/errors.ts`
  - Map HTTP 413 → "File is too large. Max is 12 MB."
  - Map HTTP 415 → "Unsupported format. Use JPG, PNG, or HEIC."
  - Map presign policy rejection (400 ProblemDetails) → friendly message
  - Add retry action to all error states
  - _Estimated: 2 hours_

- [ ] **Task 2.2**: Update error handling in upload flow
  - File: `apps/web/app/(protected)/upload/page.tsx`
  - Handle server errors with mapped messages
  - Display ErrorAlert component with retry button
  - Test error recovery flows
  - Emit telemetry for server errors
  - _Estimated: 2 hours_

### Phase 3: Mobile Compression (Priority: P1)

- [ ] **Task 3.1**: Implement image compression utility
  - File: `apps/web/lib/image-compression.ts`
  - Implement `compressImage(file: File, options): Promise<File>`
  - Use Canvas API for downscaling
  - Preserve EXIF orientation metadata
  - Target ~8 MB output size
  - High-quality downscale (imageSmoothingQuality: 'high')
  - Write unit tests for compression algorithm
  - _Estimated: 4 hours_

- [ ] **Task 3.2**: Create compression confirmation dialog
  - File: `apps/web/components/upload/CompressionDialog.tsx`
  - Design dialog UI with size comparison
  - Show original size → compressed size estimate
  - "Cancel" and "Compress & Upload" buttons
  - Accessible keyboard navigation
  - _Estimated: 2 hours_

- [ ] **Task 3.3**: Integrate compression into upload flow
  - File: `apps/web/components/upload/UploadDropzone.tsx`
  - Detect oversized files on mobile (viewport width < 768px)
  - Show CompressionDialog for files > 12 MB
  - Apply compression if user accepts
  - Emit `upload_compressed_client` telemetry
  - Test on iOS Safari and Chrome Android
  - _Estimated: 3 hours_

### Phase 4: Accessibility (Priority: P0)

- [ ] **Task 4.1**: Implement keyboard navigation
  - File: `apps/web/components/upload/UploadDropzone.tsx`
  - Make dropzone focusable (tabIndex={0})
  - Handle Enter/Space to trigger file picker
  - Handle Escape to cancel upload
  - Add visible focus ring (Holo Cyan, 2px offset)
  - Test keyboard-only navigation
  - _Estimated: 2 hours_

- [ ] **Task 4.2**: Add ARIA attributes and live regions
  - File: `apps/web/components/upload/UploadDropzone.tsx`
  - Add `role="button"` to dropzone
  - Add `aria-label` with full instructions
  - Add `aria-describedby` for hint text
  - Add `aria-invalid` for error state
  - Add `aria-live="polite"` region for announcements
  - _Estimated: 2 hours_

- [ ] **Task 4.3**: Implement screen reader announcements
  - File: `apps/web/components/upload/UploadDropzone.tsx`
  - Announce validation errors to screen readers
  - Announce successful file selection
  - Announce compression dialog
  - Announce upload progress
  - Test with VoiceOver (iOS) and TalkBack (Android)
  - _Estimated: 3 hours_

- [ ] **Task 4.4**: Ensure visual accessibility
  - File: `apps/web/components/upload/UploadDropzone.tsx`
  - Verify error text contrast ratio ≥ 4.5:1
  - Ensure font size ≥ 16px for errors
  - Add error icons alongside text (not color alone)
  - Verify focus indicators always visible
  - Test with color blindness simulators
  - _Estimated: 2 hours_

### Phase 5: Dimension Guidance (Priority: P2)

- [ ] **Task 5.1**: Implement dimension extraction
  - File: `apps/web/lib/upload-validators.ts`
  - Extract image dimensions from File object
  - Calculate longest edge
  - Return dimensions in ValidationResult
  - _Estimated: 2 hours_

- [ ] **Task 5.2**: Add low-resolution warning
  - File: `apps/web/components/upload/UploadDropzone.tsx`
  - Check if longest edge < 1200 px
  - Show non-blocking toast: "Low-resolution image; results may be less accurate."
  - Toast duration: 5 seconds, dismissible
  - Emit telemetry for dimension warnings
  - _Estimated: 2 hours_

### Phase 6: Telemetry (Priority: P0)

- [ ] **Task 6.1**: Create telemetry utility
  - File: `apps/web/lib/telemetry.ts` or use `@collectiq/telemetry`
  - Implement `emitUploadEvent(event, metadata)` function
  - Round file sizes to nearest KB
  - Never log file names or content
  - Respect Do Not Track (DNT) header
  - _Estimated: 2 hours_

- [ ] **Task 6.2**: Add telemetry to upload flow
  - Files: `apps/web/components/upload/UploadDropzone.tsx`, `apps/web/app/(protected)/upload/page.tsx`
  - Emit `upload_start` on file selection
  - Emit `upload_blocked_too_large` for oversized files
  - Emit `upload_blocked_unsupported_type` for invalid formats
  - Emit `upload_compressed_client` after compression
  - Emit `upload_success` on successful upload
  - Emit `upload_fail_network` on network errors
  - Emit `upload_fail_policy` on server policy rejection
  - _Estimated: 2 hours_

### Phase 7: Testing (Priority: P0)

- [ ] **Task 7.1**: Write unit tests for validators
  - File: `apps/web/lib/__tests__/upload-validators.test.ts`
  - Test file size validation (under, at, over limit)
  - Test format validation (valid, invalid, missing extension)
  - Test dimension extraction
  - Test edge cases (0 bytes, exactly 12 MB, no extension)
  - Target: 10+ test cases
  - _Estimated: 3 hours_

- [ ] **Task 7.2**: Write unit tests for compression
  - File: `apps/web/lib/__tests__/image-compression.test.ts`
  - Test compression reduces file size
  - Test EXIF orientation preservation
  - Test aspect ratio maintenance
  - Test quality settings
  - Target: 5+ test cases
  - _Estimated: 2 hours_

- [ ] **Task 7.3**: Write integration tests for UploadDropzone
  - File: `apps/web/components/upload/__tests__/UploadDropzone.test.tsx`
  - Test oversized file blocked without network call
  - Test unsupported format blocked
  - Test valid file accepted
  - Test error message display
  - Test compression dialog flow
  - Target: 8+ test cases
  - _Estimated: 4 hours_

- [ ] **Task 7.4**: Write E2E tests with Playwright
  - File: `apps/web/tests/e2e/upload-validation.spec.ts`
  - Test: Block 13 MB PNG with correct message
  - Test: Block unsupported GIF format
  - Test: Offer compression for 14 MB HEIC on mobile
  - Test: Low-resolution warning for small images
  - Test: Keyboard navigation
  - Test: Screen reader announcements
  - Target: 6+ scenarios
  - _Estimated: 5 hours_

- [ ] **Task 7.5**: Write accessibility tests
  - File: `apps/web/tests/a11y/upload-dropzone.spec.ts`
  - Test keyboard navigation (Tab, Enter, Space, Escape)
  - Test focus indicators visible
  - Test ARIA live region updates
  - Test screen reader announcements
  - Run axe-core automated checks
  - Target: 4+ scenarios
  - _Estimated: 3 hours_

### Phase 8: Documentation (Priority: P1)

- [ ] **Task 8.1**: Update component README
  - File: `apps/web/components/upload/README.md`
  - Document validation rules
  - Document error messages
  - Document telemetry events
  - Add usage examples
  - _Estimated: 1 hour_
  - _Status: Already completed in previous work_

- [ ] **Task 8.2**: Update environment setup docs
  - File: `apps/web/ENVIRONMENT_SETUP.md` or `apps/web/README.md`
  - Document `NEXT_PUBLIC_MAX_UPLOAD_MB` variable
  - Document other upload-related config
  - _Estimated: 30 minutes_

## Acceptance Criteria

All acceptance criteria defined in #[[file:docs/Frontend/image-upload-acceptance.md]] must pass:

### Critical Acceptance Criteria (Must Pass)

1. **AC-1**: Selecting 13 MB PNG is blocked instantly with correct message; no network call made
2. **AC-2**: Unsupported GIF format is blocked with correct message
3. **AC-3**: 14 MB HEIC on mobile offers compression; after downscale, uploads successfully
4. **AC-6**: Dropzone is keyboard accessible with visible focus ring
5. **AC-7**: Validation errors announced to screen readers
6. **AC-8**: Error text meets WCAG AA contrast requirements (4.5:1)
7. **AC-9**: All upload outcomes emit telemetry with required metadata
8. **AC-10**: Upload limit configurable via `NEXT_PUBLIC_MAX_UPLOAD_MB`

### Definition of Done

- [ ] All Phase 1-4 tasks completed (P0 priority)
- [ ] All critical acceptance criteria pass
- [ ] Unit tests pass with >80% coverage
- [ ] Integration tests pass
- [ ] E2E tests pass on Chrome and Safari
- [ ] Accessibility tests pass (axe-core + manual)
- [ ] Code review approved
- [ ] Documentation updated
- [ ] Telemetry verified in staging

## Implementation Notes

### File Size Validation

```typescript
// lib/upload-validators.ts
export function validateUploadFile(file: File): ValidationResult {
  // Check file size
  if (file.size > UPLOAD_CONFIG.maxSizeBytes) {
    return {
      valid: false,
      error: `File is too large. Max is ${UPLOAD_CONFIG.maxSizeMB} MB.`,
    };
  }

  // Check format
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  const mimeType = file.type;

  if (
    !UPLOAD_CONFIG.supportedFormats.includes(mimeType) ||
    !UPLOAD_CONFIG.supportedExtensions.includes(extension || '')
  ) {
    return {
      valid: false,
      error: "That format isn't supported. Use JPG, PNG, or HEIC.",
    };
  }

  return { valid: true };
}
```

### Compression Algorithm

```typescript
// lib/image-compression.ts
export async function compressImage(
  file: File,
  options: { targetSizeMB?: number; preserveExif?: boolean } = {}
): Promise<File> {
  const { targetSizeMB = 8, preserveExif = true } = options;

  // Load image
  const img = await loadImage(file);

  // Get EXIF orientation
  const orientation = preserveExif ? await getExifOrientation(file) : 1;

  // Calculate scale
  const scale = Math.sqrt((targetSizeMB * 1024 * 1024) / file.size);

  // Create canvas and downscale
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const { width, height } = applyOrientation(img, orientation);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Convert to blob
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(
          new File([blob!], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
        );
      },
      'image/jpeg',
      0.85
    );
  });
}
```

### Telemetry Integration

```typescript
// components/upload/UploadDropzone.tsx
const handleFileSelected = async (file: File) => {
  // Validate
  const result = validateUploadFile(file);

  if (!result.valid) {
    // Block and emit telemetry
    if (file.size > UPLOAD_CONFIG.maxSizeBytes) {
      emitUploadEvent('upload_blocked_too_large', {
        fileSize: Math.round(file.size / 1024),
        fileType: file.type,
        compressionApplied: false,
        pathway: 'picker',
      });
    } else {
      emitUploadEvent('upload_blocked_unsupported_type', {
        fileSize: Math.round(file.size / 1024),
        fileType: file.type,
        compressionApplied: false,
        pathway: 'picker',
      });
    }

    setError(result.error);
    return;
  }

  // Emit start event
  emitUploadEvent('upload_start', {
    fileSize: Math.round(file.size / 1024),
    fileType: file.type,
    compressionApplied: false,
    pathway: 'picker',
  });

  // Proceed with upload
  onFileSelected(file);
};
```

## Risks and Mitigations

### Risk 1: Browser Compatibility

**Risk**: HEIC format not supported in all browsers  
**Mitigation**: Detect support and show appropriate error; consider server-side conversion

### Risk 2: Compression Quality

**Risk**: Client-side compression may degrade image quality too much  
**Mitigation**: Use high-quality downscale settings; allow user to skip compression

### Risk 3: Performance on Low-End Devices

**Risk**: Compression may be slow on older mobile devices  
**Mitigation**: Show progress indicator; set 3-second timeout; offer skip option

### Risk 4: EXIF Orientation Loss

**Risk**: Compressed images may lose orientation metadata  
**Mitigation**: Manually apply orientation transforms before compression

## Timeline Estimate

- **Phase 1 (Core Validation)**: 10 hours
- **Phase 2 (Error Handling)**: 4 hours
- **Phase 3 (Mobile Compression)**: 9 hours
- **Phase 4 (Accessibility)**: 9 hours
- **Phase 5 (Dimension Guidance)**: 4 hours
- **Phase 6 (Telemetry)**: 4 hours
- **Phase 7 (Testing)**: 17 hours
- **Phase 8 (Documentation)**: 1.5 hours

**Total Estimated Time**: ~58.5 hours (~7-8 working days)

**Critical Path** (P0 tasks only): ~46 hours (~6 working days)

## Success Metrics

- **Validation Accuracy**: 100% of invalid files blocked client-side
- **User Experience**: <100ms validation time; clear error messages
- **Accessibility**: WCAG 2.2 AA compliance; keyboard navigation works
- **Performance**: No layout shift; compression <3s on mid-range mobile
- **Telemetry Coverage**: All upload outcomes tracked with required metadata
- **Test Coverage**: >80% unit test coverage; all E2E scenarios pass

## Related Work

- **Backend Upload Flow**: Presign endpoint enforces same limits server-side
- **S3 Bucket Policy**: Enforces file size and type at storage layer
- **Error Handling**: Uses RFC 7807 ProblemDetails format
- **Design System**: Uses Tailwind CSS tokens and shadcn/ui components
