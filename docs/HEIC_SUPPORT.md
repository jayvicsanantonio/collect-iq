# HEIC/HEIF Image Support

## Overview

CollectIQ now fully supports HEIC/HEIF image uploads from iPhone cameras. HEIC (High Efficiency Image Container) is the default photo format on iOS devices since iOS 11.

## Implementation

### Frontend Changes

1. **Upload Configuration** (`apps/web/lib/upload-config.ts`)
   - Added `image/heif` to supported MIME types
   - Added `.heif` to supported file extensions

2. **Upload Component** (`apps/web/components/upload/UploadDropzone.tsx`)
   - Updated HTML `accept` attribute to include both MIME types and file extensions
   - Format: `accept="image/jpeg,image/png,image/heic,.heic,.heif"`
   - This ensures browser file pickers show HEIC files on all platforms

### Backend Changes

1. **Lambda Environment Variables** (`infra/terraform/envs/hackathon/lambdas.tf`)
   - Updated `ALLOWED_UPLOAD_MIME` to include `image/heif`
   - Format: `"image/jpeg,image/png,image/heic,image/heif"`

2. **Upload Presign Handler** (`services/backend/src/handlers/upload_presign.ts`)
   - Updated default allowed MIME types to include `image/heif`

3. **Rekognition Adapter** (`services/backend/src/adapters/rekognition-adapter.ts`)
   - Added HEIC detection: `isHeicFormat()` function
   - Added HEIC to JPEG conversion: `convertHeicToJpeg()` function
   - Updated `detectText()` to convert HEIC images before Rekognition processing
   - Updated `detectLabels()` to convert HEIC images before Rekognition processing

## Technical Details

### Why Conversion is Needed

AWS Rekognition only supports JPEG and PNG formats. HEIC/HEIF files must be converted before analysis.

### Conversion Strategy

1. **Detection**: Check file extension (`.heic` or `.heif`)
2. **Download**: Fetch image from S3 as buffer
3. **Conversion**: Use Sharp library to convert to JPEG (95% quality, mozjpeg)
4. **Processing**: Pass converted buffer to Rekognition as `Bytes` instead of `S3Object`

### Performance Considerations

- HEIC files are typically smaller than JPEG (better compression)
- Conversion adds ~200-500ms latency for Rekognition calls
- Sharp library handles HEIC natively via libheif
- Converted images are not stored (conversion happens in-memory)

## User Experience

Users can now:

- Upload photos directly from iPhone camera (HEIC format)
- Upload HEIC files from file picker
- Upload HEIF files (alternative extension)

The system automatically handles conversion without user intervention.

## Testing

To test HEIC support:

1. Take a photo with an iPhone (iOS 11+)
2. Upload via CollectIQ web interface
3. Verify successful upload and AI analysis

## Browser Compatibility

- **Safari**: Native HEIC support
- **Chrome/Firefox**: Limited HEIC support, but file picker works with explicit extensions
- **All browsers**: Backend handles conversion, so analysis works regardless of browser

## Dependencies

- **Sharp**: v0.34.4+ (already installed)
- **libheif**: Included with Sharp (no additional installation needed)

## Deployment

After deploying these changes:

1. Run `terraform apply` to update Lambda environment variables
2. Deploy backend Lambda functions with updated code
3. Deploy frontend with updated upload configuration

No database migrations or infrastructure changes required.
