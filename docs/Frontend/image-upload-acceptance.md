---
title: CollectIQ — Image Upload Acceptance Criteria
version: 1.0
status: Active
last_updated: 2025-10-17
---

# Image Upload Acceptance Criteria

## Overview

This document defines the acceptance criteria for image upload validation in CollectIQ. All criteria must pass before the feature is considered complete and ready for production.

---

## AC-1: File Size Validation (Client-Side)

### Scenario: User selects oversized file via file picker

**Given** a user is on the upload page  
**When** they select a PNG file that is 13 MB  
**Then** the upload is blocked immediately  
**And** the error message "File is too large. Max is 12 MB." is displayed  
**And** no network request to `/api/upload/presign` is made  
**And** telemetry event `upload_blocked_too_large` is emitted with file size rounded to KB

### Scenario: User drags oversized file into dropzone

**Given** a user is on the upload page  
**When** they drag a 15 MB JPEG file over the dropzone  
**Then** the dropzone shows a red border  
**And** the error message "File is too large (15.0 MB)" appears during drag-over  
**And** if they drop the file, it is blocked with the same error message  
**And** no presign request is made

### Scenario: User selects valid file under limit

**Given** a user is on the upload page  
**When** they select an 8 MB JPEG file  
**Then** the file is accepted  
**And** the presign request is made  
**And** telemetry event `upload_start` is emitted

---

## AC-2: Format Validation (Client-Side)

### Scenario: User selects unsupported format

**Given** a user is on the upload page  
**When** they select a GIF file  
**Then** the upload is blocked immediately  
**And** the error message "That format isn't supported. Use JPG, PNG, or HEIC." is displayed  
**And** no presign request is made  
**And** telemetry event `upload_blocked_unsupported_type` is emitted

### Scenario: User selects file with mismatched extension

**Given** a user is on the upload page  
**When** they select a file named "image.jpg" with MIME type "application/octet-stream"  
**Then** the upload is blocked client-side  
**And** the error message about unsupported format is shown

### Scenario: User selects valid HEIC file

**Given** a user is on the upload page  
**When** they select a 10 MB HEIC file  
**Then** the file is accepted  
**And** the presign request is made with `contentType: "image/heic"`

---

## AC-3: Mobile Compression Flow

### Scenario: Oversized file on mobile offers compression

**Given** a user is on a mobile device (viewport width < 768px)  
**When** they select a 14 MB HEIC file  
**Then** a dialog appears with the message "This file is too large. Compress to upload faster? (recommended)"  
**And** the dialog shows estimated compressed size (~8 MB)  
**And** two buttons are present: "Cancel" and "Compress & Upload"

### Scenario: User accepts compression

**Given** the compression dialog is shown for a 14 MB file  
**When** the user clicks "Compress & Upload"  
**Then** the image is downscaled client-side  
**And** EXIF orientation is preserved  
**And** the compressed file is under 12 MB  
**And** telemetry event `upload_compressed_client` is emitted with `compressionApplied: true`  
**And** the upload proceeds with the compressed file

### Scenario: User cancels compression

**Given** the compression dialog is shown  
**When** the user clicks "Cancel"  
**Then** the dialog closes  
**And** the upload is cancelled  
**And** the user can select a different file

---

## AC-4: Dimension Guidance (Non-Blocking)

### Scenario: Low-resolution image shows warning

**Given** a user is on the upload page  
**When** they select a 1000×800 px JPEG (longest edge < 1200 px)  
**Then** a warning toast appears with the message "Low-resolution image; results may be less accurate."  
**And** the toast is dismissible  
**And** the upload proceeds without blocking  
**And** telemetry event `upload_low_resolution_warning` is emitted with dimensions

### Scenario: Optimal resolution image proceeds silently

**Given** a user is on the upload page  
**When** they select a 3000×2000 px PNG  
**Then** no warning is shown  
**And** the upload proceeds normally

---

## AC-5: Server Error Handling

### Scenario: Server returns 413 Payload Too Large

**Given** a user uploads a file that passes client validation  
**When** the server responds with HTTP 413  
**Then** the error message "File is too large. Max is 12 MB." is displayed  
**And** a "Try Again" button is shown  
**And** telemetry event `upload_fail_policy` is emitted with `status: 413`

### Scenario: Server returns 415 Unsupported Media Type

**Given** a user uploads a file that passes client validation  
**When** the server responds with HTTP 415  
**Then** the error message "Unsupported format. Use JPG, PNG, or HEIC." is displayed  
**And** a "Try Again" button is shown  
**And** telemetry event `upload_fail_policy` is emitted with `status: 415`

### Scenario: Presign policy rejection

**Given** a user uploads a file that passes client validation  
**When** the presign endpoint returns 400 with ProblemDetails type "upload/policy-violation"  
**Then** the error message "Upload was denied by the server policy. Try a smaller file or supported format." is displayed  
**And** a "Try Again" button is shown  
**And** telemetry event `upload_fail_policy` is emitted with `reason: "policy_violation"`

---

## AC-6: Accessibility (Keyboard Navigation)

### Scenario: Dropzone is keyboard accessible

**Given** a user navigates with keyboard only  
**When** they press Tab to focus the dropzone  
**Then** the dropzone receives focus  
**And** a visible focus ring (Holo Cyan, 2px offset) is displayed  
**And** the screen reader announces "Upload card image. Accepts JPG, PNG, or HEIC up to 12 megabytes."

### Scenario: Activating dropzone with keyboard

**Given** the dropzone is focused  
**When** the user presses Enter or Space  
**Then** the file picker dialog opens

### Scenario: Cancelling upload with Escape

**Given** an upload is in progress  
**When** the user presses Escape  
**Then** the upload is cancelled  
**And** the user returns to the empty dropzone state

---

## AC-7: Accessibility (Screen Reader Announcements)

### Scenario: Validation error announced to screen reader

**Given** a screen reader user selects an oversized file  
**When** the validation error occurs  
**Then** the ARIA live region announces "Upload blocked. File is too large. Maximum is 12 megabytes."  
**And** the error message is also visible on screen

### Scenario: Successful file selection announced

**Given** a screen reader user selects a valid file  
**When** the file is accepted  
**Then** the ARIA live region announces "Selected [filename], [size]. Ready to upload."

### Scenario: Compression dialog announced

**Given** a screen reader user on mobile selects an oversized file  
**When** the compression dialog appears  
**Then** the screen reader announces "File is too large. Compress image to upload faster? Use Tab to navigate options."  
**And** focus moves to the dialog

---

## AC-8: Visual Accessibility

### Scenario: Error text meets contrast requirements

**Given** an error message is displayed  
**Then** the text color has a contrast ratio of at least 4.5:1 against the background (WCAG AA)  
**And** the font size is at least 16px

### Scenario: Error indicated by more than color

**Given** an error state is shown  
**Then** an error icon (⚠️ or ✗) is displayed alongside the text  
**And** the border color changes to red  
**And** color is not the only indicator of the error

### Scenario: Focus indicators always visible

**Given** a user navigates with keyboard  
**When** any interactive element receives focus  
**Then** a visible focus ring is displayed  
**And** the focus ring is never removed via CSS

---

## AC-9: Telemetry Coverage

### Scenario: All upload outcomes emit telemetry

**Given** telemetry is enabled  
**Then** the following events are emitted with required metadata:

| Event                             | Metadata Required                                                    |
| --------------------------------- | -------------------------------------------------------------------- |
| `upload_start`                    | fileSize (KB), fileType, pathway (drag/picker/camera)                |
| `upload_blocked_too_large`        | fileSize (KB), fileType, pathway                                     |
| `upload_blocked_unsupported_type` | fileSize (KB), fileType, pathway                                     |
| `upload_compressed_client`        | fileSize (KB), fileType, compressionApplied: true, originalSize (KB) |
| `upload_success`                  | fileSize (KB), fileType, compressionApplied, pathway, duration (ms)  |
| `upload_fail_network`             | fileSize (KB), fileType, pathway, errorCode                          |
| `upload_fail_policy`              | fileSize (KB), fileType, pathway, status, reason                     |

### Scenario: Telemetry respects privacy

**Given** telemetry is enabled  
**Then** file names are never logged  
**And** file content is never sent to analytics  
**And** file sizes are rounded to nearest KB  
**And** user identifiers are omitted from client-side logs

---

## AC-10: Configuration

### Scenario: Upload limit configurable via environment variable

**Given** `NEXT_PUBLIC_MAX_UPLOAD_MB=10` is set in `.env.local`  
**When** the upload page loads  
**Then** the dropzone displays "JPG, PNG, or HEIC • Up to 10 MB"  
**And** files over 10 MB are blocked  
**And** error messages reference "10 MB" instead of "12 MB"

### Scenario: Default limit when env var not set

**Given** `NEXT_PUBLIC_MAX_UPLOAD_MB` is not set  
**When** the upload page loads  
**Then** the default limit of 12 MB is used

---

## AC-11: UI States

### Scenario: Dropzone default state

**Given** a user visits the upload page  
**Then** the dropzone displays:

- Icon: 📷
- Primary text: "Drag & drop or click to upload"
- Secondary text: "JPG, PNG, or HEIC • Up to 12 MB"
- Hint text: "Best results: 2000–4000 px"

### Scenario: Dropzone drag-over with valid file

**Given** a user drags a valid 8 MB JPEG over the dropzone  
**Then** the dropzone border changes to blue  
**And** the text changes to "✓ Drop to upload"  
**And** a subtle scale animation plays

### Scenario: Dropzone drag-over with invalid file

**Given** a user drags a 15 MB PNG over the dropzone  
**Then** the dropzone border changes to red  
**And** the text changes to "✗ File is too large (15.0 MB)"  
**And** a shake animation plays

### Scenario: Error state after invalid selection

**Given** a user selects an invalid file  
**Then** the dropzone shows:

- Icon: ⚠️
- Error message: "[Specific error text]"
- Button: "Try another file"

---

## AC-12: Cross-Browser Compatibility

### Scenario: Works in Chrome desktop

**Given** a user on Chrome 120+ (desktop)  
**Then** all validation, compression, and upload features work correctly

### Scenario: Works in Safari desktop

**Given** a user on Safari 17+ (desktop)  
**Then** all validation, compression, and upload features work correctly  
**And** HEIC files are supported

### Scenario: Works in iOS Safari

**Given** a user on iOS Safari 16+  
**Then** all validation, compression, and upload features work correctly  
**And** HEIC files from camera are supported  
**And** EXIF orientation is preserved during compression

### Scenario: Works in Chrome Android

**Given** a user on Chrome Android 120+  
**Then** all validation, compression, and upload features work correctly  
**And** camera capture works

---

## AC-13: Performance

### Scenario: Client-side validation is instant

**Given** a user selects a file  
**When** validation runs  
**Then** the result is displayed within 100ms  
**And** no network request is made for invalid files

### Scenario: Compression completes in reasonable time

**Given** a user accepts compression for a 14 MB file  
**When** compression runs  
**Then** it completes within 3 seconds on mid-range mobile devices  
**And** a progress indicator is shown during compression

### Scenario: No layout shift during error display

**Given** a user selects an invalid file  
**When** the error message appears  
**Then** no Cumulative Layout Shift (CLS) occurs  
**And** the dropzone maintains its dimensions

---

## AC-14: Security

### Scenario: Client validation does not trust MIME type alone

**Given** a malicious user renames "malware.exe" to "image.jpg"  
**When** they attempt to upload it  
**Then** the client checks both MIME type and extension  
**And** if it passes client checks, the backend presign policy still rejects it  
**And** the user sees "Upload was denied by the server policy"

### Scenario: File content never leaves device until confirmed

**Given** a user selects a file  
**When** validation runs  
**Then** the file content is only read for dimension extraction (if needed)  
**And** no file content is sent to analytics or logging  
**And** the file is only uploaded to S3 after user confirmation

---

## AC-15: Edge Cases

### Scenario: File with no extension

**Given** a user selects a file named "image" (no extension)  
**Then** the upload is blocked  
**And** the error message "File type could not be determined. Use JPG, PNG, or HEIC." is shown

### Scenario: File exactly at 12 MB limit

**Given** a user selects a file that is exactly 12,582,912 bytes (12 MB)  
**Then** the file is accepted  
**And** the upload proceeds

### Scenario: Multiple rapid file selections

**Given** a user rapidly selects 3 different files in succession  
**Then** only the most recent selection is processed  
**And** previous selections are cancelled  
**And** no race conditions occur

### Scenario: Network failure during presign request

**Given** a user selects a valid file  
**When** the presign request fails due to network error  
**Then** the error message "Upload failed. Check your connection and try again." is shown  
**And** a "Retry" button is present  
**And** telemetry event `upload_fail_network` is emitted

---

## AC-16: Copy Tone

### Scenario: All error messages follow tone guidelines

**Given** any error occurs  
**Then** the error message:

- Uses plain language (no jargon)
- Is concise (one sentence when possible)
- Is non-blaming (never "You..." or "Your...")
- Is actionable (suggests next step)

**Examples:**

- ✅ "File is too large. Max is 12 MB."
- ❌ "You uploaded a file that exceeds the maximum allowed size."

---

## Definition of Done

All acceptance criteria (AC-1 through AC-16) must:

- ✅ Pass automated unit tests (Vitest)
- ✅ Pass automated E2E tests (Playwright)
- ✅ Pass manual accessibility audit (VoiceOver + TalkBack)
- ✅ Pass manual cross-browser testing (Chrome, Safari, iOS Safari, Chrome Android)
- ✅ Pass code review
- ✅ Have telemetry verified in staging environment
- ✅ Be documented in component README

---

## Test Execution Checklist

### Automated Tests

- [ ] Unit tests for `validateUploadFile()` (10+ test cases)
- [ ] Unit tests for `compressImage()` (5+ test cases)
- [ ] Integration tests for `UploadDropzone` component (8+ test cases)
- [ ] E2E tests for happy path (3+ scenarios)
- [ ] E2E tests for error paths (5+ scenarios)
- [ ] E2E tests for accessibility (4+ scenarios)
- [ ] E2E tests for mobile compression (3+ scenarios)
- [ ] Telemetry assertion tests (7+ events)

### Manual Tests

- [ ] Test on Chrome desktop (macOS)
- [ ] Test on Safari desktop (macOS)
- [ ] Test on iOS Safari (iPhone 13+)
- [ ] Test on Chrome Android (Pixel 6+)
- [ ] Test with VoiceOver (iOS)
- [ ] Test with TalkBack (Android)
- [ ] Test with keyboard only (no mouse)
- [ ] Test with reduced motion enabled
- [ ] Test with high contrast mode
- [ ] Test on slow 3G network
- [ ] Test with DevTools throttling (CPU 4x slowdown)

### Regression Tests

- [ ] Existing upload flow still works
- [ ] Camera capture still works
- [ ] Vault display of uploaded cards still works
- [ ] No performance degradation (Lighthouse score ≥ 90)

---

**End of Acceptance Criteria**
