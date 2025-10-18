# Image Optimization Guide

This document describes the image optimization strategy implemented in the CollectIQ frontend application.

## Overview

All images in the application use Next.js Image component for automatic optimization, including:

- Automatic WebP/AVIF format conversion
- Responsive image sizing with srcset
- Blur placeholders for smooth loading
- Lazy loading by default
- Constrained aspect ratios to prevent layout shift

## Configuration

### Next.js Config (`next.config.mjs`)

```javascript
images: {
  formats: ['image/webp', 'image/avif'],
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '**.amazonaws.com',
    },
    {
      protocol: 'https',
      hostname: '**.cloudfront.net',
    },
  ],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
}
```

### Image Optimization Utilities (`lib/image-optimization.ts`)

Centralized utilities for consistent image handling:

- `BLUR_DATA_URL`: Minimal gray pixel for blur placeholders
- `getCardImageSizes()`: Responsive sizes based on context
- `getImageUrlFromS3Key()`: Convert S3 keys to URLs
- `getCardImageUrl()`: Get card image by ID
- `getImageQuality()`: Context-based quality settings

## Implementation by Component

### VaultGrid (Card Thumbnails)

**Context**: Grid of card thumbnails in vault view

**Configuration**:

- Sizes: `(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw`
- Quality: 75
- Placeholder: Blur with gray pixel
- Aspect ratio: 2.5/3.5 (standard card dimensions)

**Usage**:

```tsx
<Image
  src={getCardImageUrl(card.cardId)}
  alt={getCardThumbnailAlt(card)}
  fill
  sizes={getCardImageSizes('thumbnail')}
  className="object-cover"
  placeholder="blur"
  blurDataURL={BLUR_DATA_URL}
  quality={75}
/>
```

### CardDetail (Large Card View)

**Context**: Full card detail page with zoomable image

**Configuration**:

- Sizes: `(max-width: 768px) 100vw, (max-width: 1024px) 80vw, 600px`
- Quality: 90 (high quality for detail view)
- Placeholder: Blur with gray pixel
- Priority: true (above-the-fold content)
- Aspect ratio: 2.5/3.5

**Usage**:

```tsx
<Image
  src={getImageUrlFromS3Key(card.frontS3Key)}
  alt={getCardImageAlt(card)}
  fill
  sizes={getCardImageSizes('detail')}
  className="object-contain"
  placeholder="blur"
  blurDataURL={BLUR_DATA_URL}
  quality={90}
  priority
/>
```

### CandidateList (Identification Results)

**Context**: Small thumbnails in identification candidate list

**Configuration**:

- Sizes: `64px` (fixed small size)
- Quality: 75
- Placeholder: Blur with gray pixel
- Aspect ratio: 2.5/3.5

**Usage**:

```tsx
<Image
  src={candidate.imageUrl}
  alt={`${candidate.name} card`}
  fill
  sizes={getCardImageSizes('candidate')}
  className="object-cover"
  placeholder="blur"
  blurDataURL={BLUR_DATA_URL}
  quality={75}
/>
```

### UploadProgress (Upload Preview)

**Context**: Thumbnail preview during upload

**Configuration**:

- Sizes: `64px` (fixed small size)
- Unoptimized: true (blob URLs from File objects)
- No placeholder (immediate display)

**Usage**:

```tsx
<Image
  src={thumbnailUrl}
  alt={file.name}
  fill
  sizes="64px"
  className="object-cover"
  unoptimized
/>
```

### ValuationPanel (Source Logos)

**Context**: Small logos for data sources (eBay, TCGPlayer, etc.)

**Configuration**:

- Sizes: `16px` (fixed icon size)
- Quality: default
- Object-fit: contain (preserve logo aspect ratio)

**Usage**:

```tsx
<div className="relative h-4 w-4">
  <Image
    src={source.logo}
    alt={`${source.name} logo`}
    fill
    sizes="16px"
    className="object-contain"
  />
</div>
```

## Performance Benefits

### Automatic Format Conversion

Next.js automatically serves WebP or AVIF formats to supporting browsers, reducing file sizes by 25-35% compared to JPEG/PNG.

### Responsive Images

The `sizes` attribute generates appropriate srcset values, ensuring:

- Mobile devices load smaller images (e.g., 640px width)
- Desktop devices load larger images (e.g., 1920px width)
- Bandwidth savings of 50-70% on mobile

### Blur Placeholders

Inline blur data URLs provide instant visual feedback:

- Prevents layout shift (CLS improvement)
- Better perceived performance
- Minimal overhead (< 100 bytes)

### Lazy Loading

Images below the fold are lazy-loaded by default:

- Faster initial page load
- Reduced bandwidth for users who don't scroll
- Priority loading for above-fold images

## Layout Shift Prevention

All images use one of these strategies to prevent CLS:

1. **Fill with aspect ratio container**:

   ```tsx
   <div className="relative aspect-[2.5/3.5]">
     <Image src={url} fill ... />
   </div>
   ```

2. **Fixed dimensions**:
   ```tsx
   <div className="relative h-16 w-16">
     <Image src={url} fill ... />
   </div>
   ```

## Best Practices

### DO:

- ✅ Use `fill` with aspect ratio containers for responsive images
- ✅ Specify appropriate `sizes` attribute for responsive images
- ✅ Use blur placeholders for smooth loading
- ✅ Set `priority` for above-the-fold images
- ✅ Use higher quality (90) for detail views
- ✅ Use lower quality (60-75) for thumbnails

### DON'T:

- ❌ Use `<img>` tags directly (use Next.js Image)
- ❌ Omit `sizes` attribute for responsive images
- ❌ Use `unoptimized` unless necessary (blob URLs)
- ❌ Set `priority` on all images (defeats lazy loading)
- ❌ Use fixed width/height without responsive sizing

## Future Enhancements

### Phase 2:

- [ ] Implement custom image loader for CloudFront CDN
- [ ] Add image preloading for predictive navigation
- [ ] Implement progressive JPEG loading
- [ ] Add image caching strategy with service worker
- [ ] Implement responsive image art direction

### Phase 3:

- [ ] Add image compression pipeline for uploads
- [ ] Implement automatic thumbnail generation
- [ ] Add image format detection and conversion
- [ ] Implement image CDN with edge caching
- [ ] Add image analytics and monitoring

## Testing

### Manual Testing Checklist:

- [ ] Images load correctly on all screen sizes
- [ ] Blur placeholders display before image loads
- [ ] No layout shift when images load
- [ ] WebP/AVIF formats served to supporting browsers
- [ ] Lazy loading works for below-fold images
- [ ] Priority loading works for above-fold images

### Performance Testing:

- [ ] Lighthouse score > 90 for Performance
- [ ] LCP < 2.5s on mobile
- [ ] CLS < 0.1
- [ ] Image file sizes reduced by 25-35%

## Troubleshooting

### Images not loading:

1. Check remote patterns in `next.config.mjs`
2. Verify image URL is accessible
3. Check browser console for errors

### Layout shift issues:

1. Ensure aspect ratio container is used
2. Verify `fill` prop is set
3. Check CSS for conflicting styles

### Performance issues:

1. Verify `sizes` attribute is appropriate
2. Check if too many images have `priority`
3. Ensure lazy loading is working

## References

- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [Web.dev Image Optimization](https://web.dev/fast/#optimize-your-images)
- [Core Web Vitals](https://web.dev/vitals/)
