# Image Display Implementation for Vault

## Overview

This document describes the implementation of secure S3 image display functionality for the CollectIQ vault feature. Users can now see their uploaded card images rendered in the vault UI using presigned URLs.

## Problem Statement

The vault displays a list of cards fetched from `GET /cards`, where each card object contains a `frontS3Key` field (e.g., `uploads/{userId}/{uuid}-{filename}.jpg`). However, S3 objects are private by default and cannot be accessed directly via URL. We needed a secure way to display these images in the browser while maintaining user-scoped access control.

## Solution Architecture

### High-Level Flow

```
1. Vault Page loads → GET /cards → Returns cards with frontS3Key
2. VaultCard component → useCardImage(frontS3Key) hook
3. Hook → GET /images/presign?key={s3Key} → Returns presigned URL
4. Presigned URL cached → Image rendered via Next.js Image component
5. URL auto-refreshes before expiration
```

### Why We Couldn't Reuse Upload Presign

The existing `upload_presign` handler generates presigned URLs for **PUT operations** (uploading files to S3), while we needed presigned URLs for **GET operations** (viewing/downloading files from S3). Here are the key differences:

| Aspect               | Upload Presign (PUT)                   | Image Presign (GET)                 |
| -------------------- | -------------------------------------- | ----------------------------------- |
| **S3 Operation**     | `PutObject`                            | `GetObject`                         |
| **IAM Permission**   | `s3:PutObject`                         | `s3:GetObject`                      |
| **HTTP Method**      | PUT                                    | GET                                 |
| **Use Case**         | Client uploads file to S3              | Client views/downloads file from S3 |
| **Expiration**       | 60 seconds (short-lived)               | 3600 seconds (1 hour)               |
| **Request Body**     | File binary data                       | None                                |
| **Headers Required** | Content-Type, Content-Length, Metadata | None                                |
| **Security Model**   | User can only upload to their folder   | User can only view their own files  |

**Technical Reasons:**

1. **Different AWS SDK Commands**: `PutObjectCommand` vs `GetObjectCommand` require different presigning logic
2. **Different IAM Policies**: Upload requires `s3:PutObject`, viewing requires `s3:GetObject`
3. **Different Expiration Times**: Uploads are short-lived (60s) to minimize security risk, while viewing URLs can be longer (1h) for better UX
4. **Different Validation**: Upload validates file size, MIME type, and generates unique keys; viewing only validates ownership
5. **Different Use Cases**: Upload is a one-time operation, viewing may happen repeatedly (caching needed)

## Implementation Details

### 1. Backend: Image Presign Handler

**File:** `services/backend/src/handlers/image_presign.ts`

```typescript
// Key features:
- Generates presigned GET URLs for S3 objects
- Validates user ownership via JWT claims
- Enforces path-based access control (uploads/{userId}/)
- 1-hour expiration for viewing convenience
- Returns { viewUrl, expiresIn }
```

**Security Model:**

- Extracts `userId` from JWT claims
- Validates that `s3Key` starts with `uploads/{userId}/`
- Throws `ForbiddenError` if user tries to access another user's images
- Uses AWS SDK's `getSignedUrl` with `GetObjectCommand`

**IAM Policy:**

```hcl
data "aws_iam_policy_document" "image_presign_s3" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["${bucket_arn}/uploads/*"]
  }
}
```

### 2. Frontend: API Client Integration

**File:** `apps/web/lib/api.ts`

Added new API method:

```typescript
export async function getImagePresignedUrl(
  s3Key: string
): Promise<{ viewUrl: string; expiresIn: number }>;
```

- Calls `GET /images/presign?key={s3Key}`
- Automatically includes JWT authorization header
- Returns presigned URL and expiration time

### 3. Frontend: Custom Hook with Caching

**File:** `apps/web/hooks/use-card-image.ts`

```typescript
export function useCardImage(s3Key: string | undefined) {
  // Returns: { imageUrl, isLoading, error }
}
```

**Key Features:**

1. **In-Memory Caching**: Stores presigned URLs in a Map to avoid redundant API calls
2. **Automatic Refresh**: Checks if cached URL is still valid (with 5-minute buffer)
3. **Expiration Handling**: Refetches URL before it expires
4. **Loading States**: Provides `isLoading` and `error` states for UI feedback
5. **Cleanup**: Properly handles component unmounting

**Cache Structure:**

```typescript
interface ImageCache {
  url: string;
  expiresAt: number; // Unix timestamp
}

const imageCache = new Map<string, ImageCache>();
```

**Cache Logic:**

- If cached URL exists and expires in > 5 minutes → Use cached URL
- Otherwise → Fetch new presigned URL from API
- Store with expiration timestamp for future checks

### 4. Frontend: VaultCard Component

**File:** `apps/web/components/vault/VaultCard.tsx`

**Changes:**

```typescript
// Added hook usage
const { imageUrl, isLoading, error } = useCardImage(card.frontS3Key);

// Added image rendering with states
{imageLoading && <LoadingSpinner />}
{imageError && <ErrorMessage />}
{imageUrl && <Image src={imageUrl} alt={card.name} />}
```

**UI States:**

1. **Loading**: Shows animated spinner while fetching presigned URL
2. **Error**: Shows "Failed to load image" message
3. **Success**: Renders image using Next.js `Image` component with optimization

**Next.js Image Optimization:**

- Responsive sizing: `sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"`
- Lazy loading by default
- Automatic format optimization (WebP when supported)
- Already configured to allow `*.amazonaws.com` domains

### 5. Infrastructure: Terraform Configuration

**Files Modified:**

- `infra/terraform/envs/hackathon/lambdas.tf`
- `infra/terraform/envs/hackathon/api_gateway.tf`
- `infra/terraform/envs/hackathon/monitoring.tf`

**Lambda Function:**

```hcl
module "lambda_image_presign" {
  function_name = "${prefix}-image-presign"
  handler       = "image_presign.handler"
  runtime       = "nodejs20.x"
  memory_size   = 512
  timeout       = 30

  environment_variables = {
    REGION         = var.aws_region
    BUCKET_UPLOADS = module.s3_uploads.bucket_name
    XRAY_ENABLED   = "false"
  }

  custom_iam_policy_json = data.aws_iam_policy_document.image_presign_s3.json
}
```

**API Gateway Route:**

```hcl
image_presign = {
  lambda_function_name = module.lambda_image_presign.function_name
  lambda_invoke_arn    = module.lambda_image_presign.invoke_arn
  route_key            = "GET /images/presign"
  require_auth         = true
}
```

**Monitoring:**

- Added to CloudWatch dashboard
- Error rate alarms (> 10% for 5 minutes)
- Invocation and duration metrics

## Security Considerations

### 1. User-Scoped Access Control

- JWT claims provide authenticated user ID
- Path validation ensures users can only access `uploads/{userId}/` paths
- No cross-user access possible

### 2. Time-Limited URLs

- Presigned URLs expire after 1 hour
- Automatic refresh before expiration
- Minimizes risk of URL sharing/leaking

### 3. HTTPS Only

- All presigned URLs use HTTPS protocol
- S3 bucket enforces encryption in transit

### 4. No Direct S3 Access

- S3 bucket is private (no public access)
- All access goes through presigned URLs
- Lambda validates ownership before generating URLs

### 5. CORS Configuration

- API Gateway CORS allows only whitelisted origins
- Credentials required for authenticated requests

## Performance Optimizations

### 1. Client-Side Caching

- In-memory cache prevents redundant API calls
- Cache shared across all VaultCard components
- Reduces API Gateway and Lambda invocations

### 2. Proactive Refresh

- URLs refreshed 5 minutes before expiration
- Prevents broken images due to expired URLs
- Seamless user experience

### 3. Next.js Image Optimization

- Automatic format conversion (WebP)
- Responsive image sizing
- Lazy loading for off-screen images
- CDN caching of optimized images

### 4. Lambda Cold Start Mitigation

- 512MB memory allocation for faster execution
- VPC configuration for private subnet access
- Minimal dependencies for faster initialization

## Usage Example

```typescript
// In vault page component
const { data } = await api.getCards({ limit: 20 });

// Each card has frontS3Key
data.items.forEach(card => {
  console.log(card.frontS3Key);
  // "uploads/user-123/abc-def-ghi-charizard.jpg"
});

// VaultCard component automatically handles image display
<VaultCard
  card={card}
  onRefresh={handleRefresh}
  onDelete={handleDelete}
/>

// Hook fetches presigned URL and caches it
// Image renders with loading/error states
```

## Testing Checklist

- [ ] Upload a card image via upload flow
- [ ] Navigate to vault page
- [ ] Verify card images display correctly
- [ ] Check browser network tab for presigned URL requests
- [ ] Verify URLs contain AWS signature parameters
- [ ] Test with multiple cards (caching should reduce API calls)
- [ ] Wait 1 hour and verify URLs auto-refresh
- [ ] Test error handling (invalid S3 key, network failure)
- [ ] Verify user cannot access another user's images
- [ ] Check CloudWatch logs for Lambda invocations

## Deployment Steps

1. **Build Backend:**

   ```bash
   cd services/backend
   pnpm run build
   ```

2. **Deploy Infrastructure:**

   ```bash
   cd infra/terraform/envs/hackathon
   terraform init
   terraform plan
   terraform apply
   ```

3. **Build Frontend:**

   ```bash
   cd apps/web
   pnpm run build
   ```

4. **Deploy Frontend:**
   ```bash
   # Amplify auto-deploys on git push to main
   git push origin main
   ```

## Monitoring and Debugging

### CloudWatch Logs

- Lambda function: `/aws/lambda/collectiq-hackathon-image-presign`
- Look for: `Processing image presign request`, `Presigned GET URL generated`

### Metrics to Watch

- Lambda invocations (should decrease over time due to caching)
- Error rate (should be < 1%)
- Duration (should be < 500ms)
- API Gateway 4xx/5xx errors

### Common Issues

**Issue:** Images not loading

- Check: JWT token validity
- Check: S3 key format matches `uploads/{userId}/` pattern
- Check: Lambda has `s3:GetObject` permission

**Issue:** Expired URL errors

- Check: Cache expiration logic (5-minute buffer)
- Check: System clock synchronization

**Issue:** Slow image loading

- Check: S3 bucket region matches Lambda region
- Check: VPC NAT Gateway bandwidth
- Check: Next.js image optimization settings

## Future Enhancements

1. **CDN Integration**: Add CloudFront distribution for S3 bucket
2. **Thumbnail Generation**: Create smaller versions for grid view
3. **Progressive Loading**: Show low-res placeholder while loading
4. **Batch Presigning**: Generate multiple URLs in single API call
5. **Service Worker Caching**: Offline image access
6. **Image Metadata**: Store dimensions, format, size in DynamoDB

## Related Documentation

- [AWS S3 Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [React Hooks Best Practices](https://react.dev/reference/react)
- [CollectIQ Architecture](./Project%20Specification.md)

## Conclusion

This implementation provides a secure, performant, and user-friendly way to display card images in the vault. The separation of upload and viewing presigned URLs follows AWS best practices and maintains proper security boundaries. The caching strategy minimizes API calls while ensuring URLs remain valid, and the infrastructure is fully monitored for production readiness.
