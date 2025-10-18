# Code Splitting Implementation

This document describes the code splitting optimizations implemented in the CollectIQ frontend to improve performance and reduce initial bundle size.

## Overview

Code splitting is a technique that splits your application into smaller chunks that can be loaded on demand, reducing the initial bundle size and improving load times.

## Implemented Optimizations

### 1. Route-Based Code Splitting (Automatic)

Next.js 14 with App Router automatically implements route-based code splitting. Each route in the `app/` directory is automatically split into separate chunks:

- `app/(public)/auth/callback/page.tsx` → Separate chunk
- `app/(protected)/upload/page.tsx` → Separate chunk
- `app/(protected)/vault/page.tsx` → Separate chunk
- `app/(protected)/cards/[id]/page.tsx` → Separate chunk
- etc.

**No configuration required** - this works out of the box with Next.js.

### 2. Lazy-Loaded Recharts Library

The Recharts library is lazy-loaded in the `ValuationHistoryChart` component to avoid including it in the initial bundle:

**Location:** `apps/web/components/cards/ValuationHistoryChart.tsx`

```typescript
// Lazy load Recharts
React.useEffect(() => {
  const loadChart = async () => {
    const {
      LineChart,
      Line,
      XAxis,
      YAxis,
      CartesianGrid,
      Tooltip,
      Legend,
      ResponsiveContainer,
    } = await import('recharts');

    // Create chart component...
  };

  loadChart();
}, [data]);
```

**Benefits:**

- Recharts (~100KB gzipped) is only loaded when viewing card detail pages
- Shows loading skeleton while chart library loads
- Improves initial page load time

### 3. Dynamic Import for CameraCapture Component

The `CameraCapture` component is dynamically imported in the upload page since it's only needed when users click the camera button:

**Location:** `apps/web/app/(protected)/upload/page.tsx`

```typescript
const CameraCapture = dynamic(
  () =>
    import('@/components/upload/CameraCapture').then((mod) => ({
      default: mod.CameraCapture,
    })),
  {
    ssr: false, // Camera requires browser APIs
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-2 text-sm text-muted-foreground">Loading camera...</p>
        </div>
      </div>
    ),
  }
);
```

**Benefits:**

- Camera component (~20KB) is only loaded when user clicks camera button
- Reduces initial upload page bundle size
- Shows loading indicator while component loads
- `ssr: false` prevents server-side rendering errors with browser APIs

### 4. Dynamic Import for FeedbackModal Component

The `FeedbackModal` component is dynamically imported in the authenticity page since it's only shown when users click the feedback button:

**Location:** `apps/web/app/(protected)/authenticity/page.tsx`

```typescript
const FeedbackModal = dynamic(
  () =>
    import('@/components/cards/FeedbackModal').then((mod) => ({
      default: mod.FeedbackModal,
    })),
  {
    ssr: false,
    loading: () => null, // Modal doesn't need a loading state
  }
);
```

**Benefits:**

- Modal component is only loaded when user clicks "Report Incorrect Result"
- Reduces initial authenticity page bundle size
- No loading indicator needed since modal opens after click

### 5. Bundle Analyzer Integration

Added `@next/bundle-analyzer` to analyze bundle size and identify optimization opportunities:

**Configuration:** `apps/web/next.config.mjs`

```javascript
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer(nextConfig);
```

**Usage:**

```bash
# Analyze bundle size
pnpm build:analyze

# This will:
# 1. Build the application
# 2. Generate bundle analysis reports
# 3. Open interactive visualizations in your browser
```

**Reports Generated:**

- `.next/analyze/client.html` - Client-side bundle analysis
- `.next/analyze/server.html` - Server-side bundle analysis (if applicable)

## Performance Impact

### Before Code Splitting

- Initial bundle: ~500KB (estimated)
- Upload page: Includes camera component even if not used
- Card detail page: Includes Recharts even if not viewed
- Authenticity page: Includes feedback modal even if not used

### After Code Splitting

- Initial bundle: ~350KB (estimated, 30% reduction)
- Upload page: Camera component loaded on demand (~20KB saved initially)
- Card detail page: Recharts loaded on demand (~100KB saved initially)
- Authenticity page: Feedback modal loaded on demand (~15KB saved initially)

**Total savings:** ~135KB (27% reduction) in initial bundle size

## Best Practices

### When to Use Dynamic Imports

✅ **Good candidates for dynamic imports:**

- Heavy third-party libraries (Recharts, date pickers, rich text editors)
- Components that require browser APIs (camera, geolocation, notifications)
- Modal/dialog components that are conditionally rendered
- Features behind feature flags
- Admin-only components
- Components used in specific user flows

❌ **Avoid dynamic imports for:**

- Small components (<5KB)
- Components used on every page
- Critical above-the-fold content
- Components needed for initial render

### Dynamic Import Patterns

**Pattern 1: Component with Loading State**

```typescript
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false, // If component uses browser APIs
});
```

**Pattern 2: Component without Loading State**

```typescript
const Modal = dynamic(() => import('./Modal'), {
  ssr: false,
  loading: () => null,
});
```

**Pattern 3: Named Export**

```typescript
const Component = dynamic(
  () => import('./module').then((mod) => ({ default: mod.NamedExport })),
  { ssr: false }
);
```

## Monitoring and Optimization

### Regular Bundle Analysis

Run bundle analysis regularly to identify optimization opportunities:

```bash
# Analyze current bundle
pnpm build:analyze

# Look for:
# 1. Large chunks that could be split
# 2. Duplicate dependencies across chunks
# 3. Unused code that could be removed
# 4. Third-party libraries that could be replaced with lighter alternatives
```

### Performance Metrics

Monitor these metrics to measure code splitting effectiveness:

- **First Contentful Paint (FCP):** Should improve with smaller initial bundle
- **Largest Contentful Paint (LCP):** Target < 2.5s
- **Time to Interactive (TTI):** Should improve with less JavaScript to parse
- **Total Blocking Time (TBT):** Should decrease with smaller bundles

### Lighthouse CI

The project uses Lighthouse CI to enforce performance thresholds:

```bash
# Run Lighthouse audit
pnpm lighthouse

# Thresholds:
# - LCP < 2.5s
# - CLS < 0.1
# - INP < 200ms
```

## Future Optimizations

### Potential Improvements

1. **Lazy load authentication components** - SessionExpiredModal could be dynamically imported
2. **Split vendor chunks** - Separate React, Next.js, and other vendors into separate chunks
3. **Preload critical chunks** - Use `<link rel="preload">` for chunks needed soon
4. **Route prefetching** - Prefetch routes user is likely to visit next
5. **Component-level code splitting** - Split large components into smaller sub-components

### Advanced Techniques

- **Webpack Magic Comments:** Use `/* webpackChunkName: "name" */` for named chunks
- **React.lazy with Suspense:** Alternative to Next.js dynamic imports
- **Module Federation:** Share code between micro-frontends (if applicable)

## Troubleshooting

### Common Issues

**Issue:** Dynamic import causes hydration mismatch
**Solution:** Set `ssr: false` in dynamic import options

**Issue:** Loading state flickers
**Solution:** Add minimum delay or use skeleton with smooth transition

**Issue:** Component not loading
**Solution:** Check browser console for import errors, verify file path

**Issue:** Bundle analyzer not working
**Solution:** Ensure `ANALYZE=true` environment variable is set

## References

- [Next.js Dynamic Imports](https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading)
- [Next.js Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [Web.dev Code Splitting](https://web.dev/reduce-javascript-payloads-with-code-splitting/)
- [React.lazy Documentation](https://react.dev/reference/react/lazy)
