---
title: CollectIQ — Image Upload Validation Specification
version: 1.0
status: Active
last_updated: 2025-10-17
---

# Image Upload Validation Specification

## Overview

This specification defines user-friendly, enforceable rules for image uploads in CollectIQ, aligned with backend constraints and cost/latency optimization goals. All validation is performed client-side before requesting presigned URLs, with graceful fallback handling for server-side policy enforcement.

## Design Principles

- **Fail fast**: Block invalid uploads immediately without network calls
- **Clear feedback**: Non-blaming, actionable error messages
- **Progressive enhancement**: Offer client-side compression for oversized images
- **Accessibility first**: Keyboard navigation, ARIA announcements, screen reader support
- **Privacy-conscious**: No file content leaves device until user confirms upload

---

## 1. File Size Constraints

### Hard Limit

- **Maximum file size**: 12 MB per image
- **Enforcement**: Client-side validation before presign request
- **Configuration**: `NEXT_PUBLIC_MAX_UPLOAD_MB` (default: 12)

### Validation Behavior

```typescript
// Validate before presign request
if (file.size > MAX_UPLOAD_BYTES) {
  // Block upload, show error
  showError('File is too large. Max is 12 MB.');
  emitTelemetry('upload_blocked_too_large', { size: roundSize(file.size) });
  return;
}
```

### User Experience

- **Live validation**: Check size during drag-over and file selection
- **Visual feedback**: Dropzone shows red border + error icon on invalid file
- **Error message**: "File is too large. Max is 12 MB."
- **No network call**: Presign request never sent for oversized files

### Mobile Optimization

For files exceeding 12 MB on mobile devices:

1. Detect oversized file
2. Show compression offer: "This file is too large. Compress to upload faster? (recommended)"
3. If user accepts:
   - Downscale image client-side (maintain EXIF orientation)
   - Target ~8 MB after compression
   - Preserve aspect ratio
4. Emit telemetry: `upload_compressed_client: true`

---

## 2. Supported Formats

### Accepted Types

- **JPEG/JPG**: `image/jpeg`, `.jpg`, `.jpeg`
- **PNG**: `image/png`, `.png`
- **HEIC**: `image/heic`, `.heic` (iOS native format)

### Validation Strategy

```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic'];

function isValidFormat(file: File): boolean {
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  const mimeType = file.type;

  // Check both MIME and extension (defense in depth)
  return ALLOWED_TYPES.includes(mimeType) && ALLOWED_EXTENSIONS.includes(extension || '');
}
```

### Error Handling

- **Unsupported format**: "That format isn't supported. Use JPG, PNG, or HEIC."
- **Missing extension**: "File type could not be determined. Use JPG, PNG, or HEIC."
- **MIME mismatch**: Block client-side; defer authoritative check to backend presign policy

### Security Note

Client-side validation filters by `File.type` and extension, but does NOT trust these as authoritative. Backend presign policy performs final validation using magic bytes and content inspection.

---

## 3. Image Dimension Guidance

### Recommended Range

- **Optimal**: 2000–4000 px (long edge)
- **Minimum**: 1200 px (long edge) for acceptable quality
- **Maximum**: No hard limit (constrained by 12 MB file size)

### Validation Behavior

```typescript
// Non-blocking quality warning
if (longestEdge < 1200) {
  showToast({
    variant: 'warning',
    title: 'Low-resolution image',
    description: 'Results may be less accurate.',
    duration: 5000,
  });
  emitTelemetry('upload_low_resolution_warning', {
    width,
    height,
    longestEdge,
  });
}
```

### User Experience

- **Non-blocking**: Upload proceeds even for low-resolution images
- **Toast notification**: Appears for 5 seconds, dismissible
- **No modal**: Avoid interrupting upload flow
- **Guidance in UI**: Dropzone hint text shows "Best results: 2000–4000 px"

---

## 4. UI Components & States

### 4.1 UploadDropzone

#### Default State

```
┌─────────────────────────────────────────┐
│  📷  Drag & drop or click to upload     │
│                                         │
│  JPG, PNG, or HEIC • Up to 12 MB       │
│  Best results: 2000–4000 px            │
└─────────────────────────────────────────┘
```

#### Drag-Over (Valid File)

```
┌─────────────────────────────────────────┐
│  ✓  Drop to upload                      │
│                                         │
│  [Blue border, slight scale animation]  │
└─────────────────────────────────────────┘
```

#### Drag-Over (Invalid File)

```
┌─────────────────────────────────────────┐
│  ✗  File is too large (15.2 MB)        │
│                                         │
│  [Red border, shake animation]          │
└─────────────────────────────────────────┘
```

#### Error State (Post-Selection)

```
┌─────────────────────────────────────────┐
│  ⚠️  File is too large. Max is 12 MB.   │
│                                         │
│  [Try another file]                     │
└─────────────────────────────────────────┘
```

### 4.2 Mobile Compression Dialog

```
┌─────────────────────────────────────────┐
│  Compress Image?                        │
├─────────────────────────────────────────┤
│  This file is 14.3 MB. Compress to      │
│  upload faster?                         │
│                                         │
│  Original: 14.3 MB → ~8 MB              │
│                                         │
│  [Cancel]  [Compress & Upload] ←        │
└─────────────────────────────────────────┘
```

### 4.3 Validation Error Messages

| Scenario                 | Message                                                                           | Action                   |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------ |
| File > 12 MB             | "File is too large. Max is 12 MB."                                                | Block upload             |
| Unsupported format       | "That format isn't supported. Use JPG, PNG, or HEIC."                             | Block upload             |
| Low resolution           | "Low-resolution image; results may be less accurate."                             | Show toast, allow upload |
| Server 413               | "File is too large. Max is 12 MB."                                                | Show error, allow retry  |
| Server 415               | "Unsupported format. Use JPG, PNG, or HEIC."                                      | Show error, allow retry  |
| Presign policy rejection | "Upload was denied by the server policy. Try a smaller file or supported format." | Show error, allow retry  |

---

## 5. Server Error Mapping

### HTTP Status Codes

#### 413 Payload Too Large

```typescript
if (response.status === 413) {
  showError('File is too large. Max is 12 MB.');
  emitTelemetry('upload_fail_policy', {
    reason: 'size_exceeded',
    status: 413,
  });
}
```

#### 415 Unsupported Media Type

```typescript
if (response.status === 415) {
  showError('Unsupported format. Use JPG, PNG, or HEIC.');
  emitTelemetry('upload_fail_policy', {
    reason: 'unsupported_type',
    status: 415,
  });
}
```

#### Presign Policy Rejection

```typescript
// Backend returns 400 with ProblemDetails
if (problemDetails.type === 'upload/policy-violation') {
  showError('Upload was denied by the server policy. ' + 'Try a smaller file or supported format.');
  emitTelemetry('upload_fail_policy', {
    reason: 'policy_violation',
    detail: problemDetails.detail,
  });
}
```

---

## 6. Accessibility Requirements

### Keyboard Navigation

- Dropzone is focusable via `Tab` key
- `Enter` or `Space` triggers file picker
- Focus ring visible (Holo Cyan, 2px offset)
- Escape key cancels upload in progress

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

<div id="upload-hint" className="sr-only">
  Best results with images between 2000 and 4000 pixels.
</div>
```

### Screen Reader Announcements

```typescript
// On validation error
announceToScreenReader('Upload blocked. File is too large. Maximum is 12 megabytes.');

// On successful selection
announceToScreenReader(`Selected ${file.name}, ${formatBytes(file.size)}. Ready to upload.`);

// On compression offer
announceToScreenReader(
  'File is too large. Compress image to upload faster? Use Tab to navigate options.',
);
```

### Visual Considerations

- Error text minimum 16px font size
- Color contrast ratio ≥ 4.5:1 (WCAG AA)
- Error icons paired with text (never color alone)
- Focus indicators never removed

---

## 7. Configuration

### Environment Variables

```bash
# apps/web/.env.local
NEXT_PUBLIC_MAX_UPLOAD_MB=12
NEXT_PUBLIC_SUPPORTED_FORMATS=jpg,jpeg,png,heic
NEXT_PUBLIC_MIN_DIMENSION_PX=1200
NEXT_PUBLIC_OPTIMAL_DIMENSION_PX=2000-4000
```

### Runtime Access

```typescript
// lib/upload-config.ts
export const UPLOAD_CONFIG = {
  maxSizeMB: Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 12,
  maxSizeBytes: (Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 12) * 1024 * 1024,
  supportedFormats: ['image/jpeg', 'image/png', 'image/heic'],
  supportedExtensions: ['.jpg', '.jpeg', '.png', '.heic'],
  minDimensionPx: 1200,
  optimalDimensionRange: [2000, 4000],
} as const;
```

### UI Display

```tsx
// Show limit in dropzone
<p className="text-sm text-muted-foreground">
  JPG, PNG, or HEIC • Up to {UPLOAD_CONFIG.maxSizeMB} MB
</p>
```

---

## 8. Telemetry Events

### Event Schema

```typescript
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

### Event Triggers

#### upload_start

```typescript
emitTelemetry('upload_start', {
  fileSize: Math.round(file.size / 1024), // KB
  fileType: file.type,
  compressionApplied: false,
  pathway: isDragEvent ? 'drag' : 'picker',
});
```

#### upload_blocked_too_large

```typescript
emitTelemetry('upload_blocked_too_large', {
  fileSize: Math.round(file.size / 1024),
  fileType: file.type,
  compressionApplied: false,
  pathway,
});
```

#### upload_compressed_client

```typescript
emitTelemetry('upload_compressed_client', {
  fileSize: Math.round(compressedFile.size / 1024),
  fileType: compressedFile.type,
  compressionApplied: true,
  pathway,
  originalSize: Math.round(originalFile.size / 1024),
});
```

#### upload_success

```typescript
emitTelemetry('upload_success', {
  fileSize: Math.round(file.size / 1024),
  fileType: file.type,
  compressionApplied,
  pathway,
  duration: Date.now() - startTime,
});
```

### Privacy Considerations

- Never log file names or content
- Round file sizes to nearest KB
- Omit user identifiers in client-side logs
- Respect Do Not Track (DNT) header

---

## 9. Client-Side Compression

### When to Offer

- File size > 12 MB
- User agent indicates mobile device
- Browser supports Canvas API

### Compression Algorithm

```typescript
async function compressImage(file: File, targetSizeMB: number = 8): Promise<File> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Preserve EXIF orientation
  const orientation = await getExifOrientation(file);
  const { width, height } = applyOrientation(img, orientation);

  // Calculate scale to target size
  const scale = Math.sqrt((targetSizeMB * 1024 * 1024) / file.size);

  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  // High-quality downscale
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
          }),
        );
      },
      'image/jpeg',
      0.85, // Quality
    );
  });
}
```

### EXIF Orientation Handling

```typescript
// Preserve orientation metadata
const ORIENTATION_TRANSFORMS = {
  1: { rotate: 0, flipH: false },
  2: { rotate: 0, flipH: true },
  3: { rotate: 180, flipH: false },
  4: { rotate: 180, flipH: true },
  5: { rotate: 90, flipH: true },
  6: { rotate: 90, flipH: false },
  7: { rotate: 270, flipH: true },
  8: { rotate: 270, flipH: false },
};
```

---

## 10. Implementation Tasks

### Phase 1: Core Validation (Priority: P0)

- [ ] Add size/type checks in `UploadDropzone.tsx` before presign
- [ ] Implement `validateUploadFile()` utility in `lib/upload-validators.ts`
- [ ] Show inline limit in dropzone UI ("JPG/PNG/HEIC up to 12 MB")
- [ ] Block invalid files with appropriate error messages
- [ ] Emit telemetry for blocked uploads

### Phase 2: Error Handling (Priority: P0)

- [ ] Map server 413 → "File is too large" error
- [ ] Map server 415 → "Unsupported format" error
- [ ] Handle presign policy rejection with friendly message
- [ ] Add retry action to all error states
- [ ] Test error recovery flows

### Phase 3: Mobile Compression (Priority: P1)

- [ ] Detect oversized files on mobile
- [ ] Implement client-side downscale with EXIF preservation
- [ ] Show compression confirmation dialog
- [ ] Emit `upload_compressed_client` telemetry
- [ ] Test on iOS Safari and Chrome Android

### Phase 4: Accessibility (Priority: P0)

- [ ] Add ARIA labels and live regions
- [ ] Implement keyboard navigation (Tab, Enter, Space, Escape)
- [ ] Test with VoiceOver (iOS) and TalkBack (Android)
- [ ] Verify focus indicators visible
- [ ] Add screen reader announcements for validation errors

### Phase 5: Dimension Guidance (Priority: P2)

- [ ] Extract image dimensions client-side
- [ ] Show non-blocking toast for low-resolution images
- [ ] Add "Best results: 2000–4000 px" hint to dropzone
- [ ] Emit telemetry for dimension warnings

### Phase 6: Testing (Priority: P0)

- [ ] Unit tests for `validateUploadFile()` with edge cases
- [ ] Unit tests for compression algorithm
- [ ] Playwright E2E: block oversized file (no network call)
- [ ] Playwright E2E: block unsupported format
- [ ] Playwright E2E: compression flow on mobile viewport
- [ ] Playwright E2E: keyboard navigation
- [ ] Playwright E2E: screen reader announcements
- [ ] Telemetry assertions for all outcomes

---

## 11. Testing Strategy

### Unit Tests (Vitest)

```typescript
describe('validateUploadFile', () => {
  it('blocks files over 12 MB', () => {
    const file = createMockFile({ size: 13 * 1024 * 1024 });
    const result = validateUploadFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('File is too large. Max is 12 MB.');
  });

  it('blocks unsupported formats', () => {
    const file = createMockFile({ type: 'image/gif' });
    const result = validateUploadFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not supported');
  });

  it('allows valid JPEG under 12 MB', () => {
    const file = createMockFile({
      type: 'image/jpeg',
      size: 8 * 1024 * 1024,
    });
    const result = validateUploadFile(file);
    expect(result.valid).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('UploadDropzone', () => {
  it('shows error for oversized file without network call', async () => {
    const { getByRole, getByText } = render(<UploadDropzone />);
    const dropzone = getByRole('button');

    const file = createMockFile({ size: 15 * 1024 * 1024 });
    await userEvent.upload(dropzone, file);

    expect(getByText(/too large/i)).toBeInTheDocument();
    expect(mockPresignRequest).not.toHaveBeenCalled();
  });
});
```

### E2E Tests (Playwright)

```typescript
test('blocks oversized PNG with correct message', async ({ page }) => {
  await page.goto('/upload');

  // Create 13 MB file
  const buffer = Buffer.alloc(13 * 1024 * 1024);
  await page.setInputFiles('input[type="file"]', {
    name: 'large.png',
    mimeType: 'image/png',
    buffer,
  });

  // Verify error shown
  await expect(page.getByText('File is too large. Max is 12 MB.')).toBeVisible();

  // Verify no network call
  const requests = page.context().requests();
  expect(requests.some((r) => r.url().includes('/presign'))).toBe(false);
});

test('offers compression for 14 MB HEIC on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 }); // iPhone
  await page.goto('/upload');

  const buffer = Buffer.alloc(14 * 1024 * 1024);
  await page.setInputFiles('input[type="file"]', {
    name: 'photo.heic',
    mimeType: 'image/heic',
    buffer,
  });

  // Verify compression dialog
  await expect(page.getByText(/Compress to upload faster/i)).toBeVisible();
  await page.getByRole('button', { name: /Compress & Upload/i }).click();

  // Verify telemetry
  const telemetry = await page.evaluate(() =>
    window.__telemetry__.find((e) => e.event === 'upload_compressed_client'),
  );
  expect(telemetry.metadata.compressionApplied).toBe(true);
});
```

### Accessibility Tests

```typescript
test('dropzone is keyboard accessible', async ({ page }) => {
  await page.goto('/upload');

  // Tab to dropzone
  await page.keyboard.press('Tab');
  const dropzone = page.getByRole('button', { name: /Upload card image/i });
  await expect(dropzone).toBeFocused();

  // Verify focus ring visible
  const focusRing = await dropzone.evaluate((el) => window.getComputedStyle(el).outlineColor);
  expect(focusRing).not.toBe('rgba(0, 0, 0, 0)');

  // Activate with Enter
  await page.keyboard.press('Enter');
  // File picker should open (browser-dependent)
});

test('announces validation errors to screen readers', async ({ page }) => {
  await page.goto('/upload');

  const file = createMockFile({ size: 15 * 1024 * 1024 });
  await page.setInputFiles('input[type="file"]', file);

  // Verify ARIA live region updated
  const liveRegion = page.locator('[aria-live="polite"]');
  await expect(liveRegion).toContainText('File is too large');
});
```

---

## 12. Copy Tone Guidelines

### Principles

- **Clear**: Use plain language, avoid jargon
- **Concise**: One sentence per error when possible
- **Non-blaming**: Never "You uploaded..." or "Your file..."
- **Actionable**: Always suggest next step

### Examples

#### ✅ Good

- "File is too large. Max is 12 MB."
- "That format isn't supported. Use JPG, PNG, or HEIC."
- "Low-resolution image; results may be less accurate."

#### ❌ Avoid

- "You uploaded a file that's too large."
- "Your file format is not supported by our system."
- "ERROR: File size exceeds maximum allowed limit of 12 MB."

---

## 13. Security & Privacy

### Client-Side Validation Limitations

- File extension and MIME type can be spoofed
- Client validation is UX optimization, not security boundary
- Backend presign policy is authoritative source of truth

### Defense in Depth

1. **Client**: Block obvious violations (size, extension, MIME)
2. **Presign**: Validate against S3 bucket policy
3. **Backend**: Inspect magic bytes, run virus scan (future)

### Privacy Protections

- File content never sent to analytics
- File names stripped from telemetry
- Compression happens on-device
- No server-side storage until user confirms upload

---

## 14. Future Enhancements

### Phase 2 (Post-Hackathon)

- [ ] WebP support (broader browser compatibility)
- [ ] Progressive upload with chunking (files > 50 MB)
- [ ] Client-side duplicate detection (perceptual hash)
- [ ] Batch upload (multiple cards at once)
- [ ] Drag-and-drop reordering for batch uploads

### Phase 3 (Venture)

- [ ] Advanced compression (WebAssembly-based)
- [ ] Background upload with service worker
- [ ] Offline queue with sync on reconnect
- [ ] Image editing (crop, rotate, enhance)

---

## 15. References

- [Frontend Project Specification](./Frontend%20Project%20Specification.md)
- [Backend Upload Flow](../Backend/Backend%20Project%20Specification.md#upload-flow)
- [Design System](./Design%20System.md)
- [Error Handling](../../apps/web/lib/ERROR_HANDLING.md)
- [WCAG 2.2 AA Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [RFC 7807 Problem Details](https://datatracker.ietf.org/doc/html/rfc7807)

---

## Appendix A: Validation Flow Diagram

```
┌─────────────────┐
│ User selects    │
│ file            │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check file size │◄─── NEXT_PUBLIC_MAX_UPLOAD_MB
└────────┬────────┘
         │
    ┌────┴────┐
    │ > 12 MB?│
    └────┬────┘
         │
    ┌────┴────┐
    │   Yes   │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│ Mobile device?  │
└────────┬────────┘
         │
    ┌────┴────┐
    │   Yes   │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│ Offer compress  │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Accept? │
    └────┬────┘
         │
    ┌────┴────┐
    │   Yes   │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│ Compress image  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check format    │◄─── ALLOWED_TYPES
└────────┬────────┘
         │
    ┌────┴────┐
    │ Valid?  │
    └────┬────┘
         │
    ┌────┴────┐
    │   Yes   │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│ Extract         │
│ dimensions      │
└────────┬────────┘
         │
    ┌────┴────┐
    │ < 1200? │
    └────┬────┘
         │
    ┌────┴────┐
    │   Yes   │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│ Show warning    │
│ toast           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Request presign │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Upload to S3    │
└─────────────────┘
```

---

## Appendix B: Error Message Matrix

| Validation         | Client Check | Server Response       | User Message                                                                      | Retry?                      |
| ------------------ | ------------ | --------------------- | --------------------------------------------------------------------------------- | --------------------------- |
| Size > 12 MB       | ✅ Block     | N/A (no request)      | "File is too large. Max is 12 MB."                                                | Yes (select different file) |
| Unsupported format | ✅ Block     | N/A (no request)      | "That format isn't supported. Use JPG, PNG, or HEIC."                             | Yes (select different file) |
| Low resolution     | ⚠️ Warn      | N/A                   | "Low-resolution image; results may be less accurate."                             | N/A (proceeds)              |
| Server 413         | ❌ Missed    | 413 Payload Too Large | "File is too large. Max is 12 MB."                                                | Yes                         |
| Server 415         | ❌ Missed    | 415 Unsupported Media | "Unsupported format. Use JPG, PNG, or HEIC."                                      | Yes                         |
| Policy violation   | ❌ Missed    | 400 ProblemDetails    | "Upload was denied by the server policy. Try a smaller file or supported format." | Yes                         |
| Network error      | N/A          | Timeout/Offline       | "Upload failed. Check your connection and try again."                             | Yes                         |

---

**End of Specification**
