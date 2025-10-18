# Responsive Design Implementation

This document summarizes the responsive design and mobile optimization features implemented for CollectIQ.

## Task 12.1: Responsive Layouts

### CSS Utilities (globals.css)

- **Touch Targets**: `.touch-target` class ensures minimum 44x44px size for accessibility
- **Safe Area Padding**: iOS notch support with `safe-area-*` classes
- **Responsive Container**: Mobile-first container with breakpoint-based max-widths
- **Responsive Grid**: `.grid-responsive` adapts from 1-4 columns based on screen size
- **Responsive Text**: Fluid typography that scales with viewport
- **Responsive Spacing**: Adaptive padding for different screen sizes

### Navigation

- **Desktop**: Fixed sidebar (256px width) on left side
- **Mobile**:
  - Top header with hamburger menu
  - Bottom navigation bar for quick access
  - Collapsible menu drawer
- All navigation items have proper touch targets (44x44px minimum)

### Layout Structure

- Protected routes use responsive layout with:
  - Desktop: Left sidebar + main content area
  - Mobile: Top header + content + bottom nav
  - Proper spacing accounting for fixed navigation elements

### Component Updates

- **VaultGrid**: Uses responsive grid (1-4 columns)
- **PortfolioSummary**: Adapts from 1-3 columns based on screen size
- **Home Page**: Responsive card layout and feature grid

## Task 12.2: Mobile Upload Experience

### Image Compression (lib/image-compression.ts)

- Automatic compression for large images on mobile devices
- Configurable quality and size limits
- Device detection (mobile vs desktop)
- Recommended compression options based on device type
- Maintains aspect ratio while reducing file size

### Camera Integration

- **Native Camera Access**: Uses getUserMedia API with mobile-optimized constraints
- **iOS Compatibility**:
  - `playsinline` and `webkit-playsinline` attributes
  - Proper aspect ratio handling
  - Front/rear camera switching
- **Android Support**: Environment-facing camera preference
- **High Resolution**: Supports up to 4K capture (3840x2160)

### Upload Options

- **Mobile**:
  - Side-by-side Camera/Gallery buttons
  - Native file picker with camera capture attribute
  - Automatic image compression
- **Desktop**:
  - Camera button + drag-and-drop zone
  - Traditional file picker

### UploadDropzone Enhancements

- Auto-compression on mobile (enabled by default)
- Async file handling for compression
- Fallback to original files if compression fails
- Mobile-specific UI hints

## Task 12.3: Mobile-Specific UI Patterns

### Bottom Sheet Component (ui/bottom-sheet.tsx)

- Mobile: Slides up from bottom with drag handle
- Desktop: Center modal dialog
- Smooth animations and transitions
- Safe area padding for iOS
- Accessible with proper ARIA attributes

### Pull-to-Refresh

- **Hook** (`use-pull-to-refresh.ts`):
  - Touch gesture detection
  - Configurable threshold and resistance
  - Only triggers when scrolled to top
  - Async refresh support
- **Indicator** (`ui/pull-to-refresh.tsx`):
  - Visual feedback during pull
  - Rotating icon based on pull distance
  - Smooth animations
  - Fixed positioning with safe area support

### Vault Page Integration

- Pull-to-refresh enabled on mobile (≤768px)
- Refreshes card list on pull gesture
- Visual indicator shows progress

### Orientation Handling

- Landscape mode optimizations for mobile
- Reduced vertical spacing in landscape
- Proper viewport handling

### Swipe Gestures

- Touch-action optimizations
- User-select prevention for swipeable elements
- Smooth scrolling with `-webkit-overflow-scrolling`

## Breakpoints

The application uses the following breakpoints:

- **Mobile**: < 640px (single column)
- **Small**: 640px - 767px (2 columns)
- **Medium**: 768px - 1023px (sidebar appears, 2-3 columns)
- **Large**: 1024px - 1279px (3 columns)
- **XL**: 1280px+ (4 columns)

## Testing Recommendations

### Manual Testing

1. Test on physical devices (iOS and Android)
2. Test in both portrait and landscape orientations
3. Verify touch targets are easily tappable
4. Test pull-to-refresh gesture
5. Test camera capture on mobile
6. Verify image compression reduces file size
7. Test safe area padding on devices with notches

### Browser Testing

- iOS Safari (primary mobile browser)
- Android Chrome (primary Android browser)
- Desktop Chrome, Firefox, Safari, Edge

### Responsive Testing

- Use browser DevTools responsive mode
- Test at various viewport sizes (320px to 1920px)
- Verify no horizontal scrolling
- Check that all content is accessible

## Performance Considerations

- Image compression reduces upload times on mobile
- Lazy loading for heavy components
- Optimized touch event handlers
- Minimal reflows and repaints
- CSS transforms for smooth animations

## Accessibility

- All interactive elements meet 44x44px minimum touch target
- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader friendly
- Focus indicators visible
- Color contrast meets WCAG AA standards

## Future Enhancements

- Service worker for offline support
- Progressive Web App (PWA) features
- Native app wrappers (Capacitor/React Native)
- Advanced gesture support (swipe to delete, etc.)
- Haptic feedback on supported devices
