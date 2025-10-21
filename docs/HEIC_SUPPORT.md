# HEIC/HEIF Image Support

## Overview

CollectIQ fully supports HEIC/HEIF image uploads from iPhone cameras by converting them to JPEG **client-side** before upload. This provides the best user experience with minimal backend complexity.

## Implementation Strategy

### Client-Side Conversion (Recommended Approach)

HEIC/HEIF files are converted to JPEG in the browser before uploading to S3. This approach:

- ✅ Simplifies backend (no HEIC handling needed)
- ✅ Provides instant vault display (no conversion wait)
- ✅ Reduces costs (no Lambda CPU for conversion, no duplicate storage)
- ✅ Better performance (conversion on user's device)
- ✅ Immediate compatibility everywhere

### Frontend Changes

1. **Upload Handler** (`apps/web/app/(protected)/upload/page.tsx`)
   - Detects HEIC/HEIF files by extension
   - Converts to JPEG using `heic2any` library (90% quality)
   - Renames file from `.heic` to `.jpg`
   - Uploads converted JPEG to S3

2. **Upload Preview** (`apps/web/components/upload/UploadProgress.tsx`)
   - Shows conversion progress with spinner
   - Displays preview after conversion (70% quality for speed)
   - Same UX for all image formats

3. **Upload Configuration** (`apps/web/lib/upload-config.ts`)
   - Accepts HEIC/HEIF in file picker
   - Converts before validation/upload

### Backend Changes

1. **Validation** (`packages/shared/src/schemas.ts`)
   - Only accepts `image/jpeg` and `image/png`
   - HEIC files are converted before reaching backend

2. **Upload Presign Handler** (`services/backend/src/handlers/upload_presign.ts`)
   - Removed HEIC from allowed MIME types
   - Simplified validation

3. **Rekognition Adapter** (`services/backend/src/adapters/rekognition-adapter.ts`)
   - Removed HEIC conversion logic
   - Uses S3Object references directly (no Bytes conversion)

4. **Image Presign Handler** (`services/backend/src/handlers/image_presign.ts`)
   - Removed HEIC detection and conversion
   - Simplified to just generate presigned URLs

### Infrastructure Changes

1. **Lambda Configuration** (`infra/terraform/envs/hackathon/lambdas.tf`)
   - Removed Sharp layer from `image_presign` Lambda
   - Reduced memory from 1024MB to 512MB
   - Reduced timeout from 60s to 30s
   - Removed S3 PutObject permission (only GetObject needed)
   - Updated environment variables to remove HEIC/HEIF

## Technical Details

### Conversion Flow

```
User selects HEIC file
    ↓
Browser detects .heic/.heif extension
    ↓
heic2any converts to JPEG (90% quality)
    ↓
File renamed to .jpg
    ↓
Preview shown (70% quality conversion)
    ↓
JPEG uploaded to S3
    ↓
Backend processes as regular JPEG
    ↓
Rekognition analyzes JPEG
    ↓
Vault displays JPEG instantly
```

### Quality Considerations

- **Upload Quality**: 90% JPEG (high quality, minimal loss)
- **Preview Quality**: 70% JPEG (faster conversion, good enough for preview)
- **Visual Difference**: Negligible for trading cards
- **AI Analysis**: Works perfectly with JPEG

### Performance

- **Conversion Time**: 1-3 seconds on modern devices
- **Upload Size**: JPEG typically 20-40% larger than HEIC
- **Vault Display**: Instant (no conversion needed)
- **Backend Processing**: Faster (no conversion overhead)

## User Experience

### Upload Flow

**JPEG/PNG Upload:**

- ✅ Instant preview thumbnail
- ✅ Upload progress
- ✅ Displays in vault

**HEIC/HEIF Upload:**

- ✅ Shows "Converting..." spinner (1-3 seconds)
- ✅ Preview thumbnail after conversion
- ✅ Upload progress
- ✅ Displays in vault instantly (no conversion wait)

### Benefits

1. **Consistent Experience**: All images show previews
2. **Fast Vault Display**: No "first view" conversion penalty
3. **Predictable Performance**: No Lambda cold starts affecting display
4. **Lower Costs**: No duplicate storage or conversion Lambda costs

## Dependencies

### Frontend

- **heic2any**: Latest version (~50KB gzipped)
- Handles HEIC to JPEG conversion in browser
- Works in all modern browsers

### Backend

- **Sharp**: Still used for image processing (card detection, quality analysis)
- **No HEIC support needed**: All images are JPEG/PNG by the time they reach backend

## Browser Compatibility

### Upload

- **Safari**: Native HEIC support for file picker
- **Chrome/Firefox**: File picker works with explicit extensions
- **All browsers**: `heic2any` handles conversion

### Display

- **All browsers**: JPEG images display natively
- **No conversion needed**: Images are already JPEG

## Deployment

After deploying these changes:

1. Run `terraform apply` to update Lambda configurations:
   - Remove Sharp layer from `image_presign`
   - Reduce memory and timeout
   - Update environment variables
2. Deploy backend Lambda functions with simplified code
3. Deploy frontend with conversion logic

No database migrations required.

## Storage Considerations

- **Only JPEG stored**: No duplicate HEIC files
- **Smaller codebase**: Less conversion logic to maintain
- **Lower costs**: Single copy of each image

## Edge Cases

### Large HEIC Files

- Conversion might take 3-5 seconds on older devices
- Solution: Show progress indicator (already implemented)

### Conversion Failure

- Browser might not support `heic2any` (rare)
- Solution: Show error message, suggest using JPEG/PNG

### File Naming

- `.heic` → `.jpg` automatically
- `.heif` → `.jpg` automatically
- Original filename preserved in metadata

## Testing

To test HEIC support:

1. Take a photo with an iPhone (iOS 11+)
2. Upload via CollectIQ web interface
3. Verify:
   - Conversion progress shown
   - Preview displays after conversion
   - Upload completes successfully
   - Image displays in vault immediately

## Comparison with Server-Side Conversion

| Aspect            | Client-Side (Current) | Server-Side (Alternative) |
| ----------------- | --------------------- | ------------------------- |
| **Complexity**    | Simple                | Complex                   |
| **Vault Display** | Instant               | 1-2s first view           |
| **Storage**       | Single JPEG           | HEIC + JPEG               |
| **Lambda CPU**    | None                  | High                      |
| **Costs**         | Lower                 | Higher                    |
| **Quality**       | 90% JPEG              | 90-95% JPEG               |
| **User Device**   | Does conversion       | No conversion             |
| **Maintenance**   | Less code             | More code                 |

**Verdict**: Client-side conversion is better for this use case.
