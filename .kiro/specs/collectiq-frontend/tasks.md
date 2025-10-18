# Implementation Plan

- [x] 1. Project setup and configuration
  - Initialize Next.js 14 project in apps/web with TypeScript and App Router
  - Configure Tailwind CSS v4 with @theme directive
  - Set up ESLint, Prettier, and Husky pre-commit hooks (using packages/config)
  - Configure path aliases in tsconfig.json (@/components, @/lib, @collectiq/shared, etc.)
  - Add dependency on packages/shared for shared types and schemas
  - Create environment variable configuration with validation
  - Set up folder structure following the design specification
  - _Requirements: 15.1, 15.2_

- [x] 2. Design system foundation
- [x] 2.1 Implement core design tokens and CSS variables
  - Create globals.css with @theme directive for Tailwind v4
  - Define color tokens (Vault Blue, Holo Cyan, Carbon Gray, etc.)
  - Set up typography tokens (Inter, Space Grotesk, JetBrains Mono)
  - Configure spacing system (8px grid)
  - Define border radius, shadow, and motion tokens
  - Implement light/dark mode CSS variables
  - _Requirements: 13.4, 13.5, 13.6, 13.7, 13.8_

- [x] 2.2 Create base UI components (shadcn/ui)
  - Install and configure shadcn/ui CLI
  - Create Button component with all variants (primary, secondary, gradient, outline, ghost)
  - Create Card component with sub-components (CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
  - Create Dialog component for modals
  - Create Toast component for notifications
  - Create Input component with validation states
  - Create Select component for dropdowns
  - Create Tooltip component
  - _Requirements: 13.4, 13.5, 13.6_

- [x] 2.3 Implement theme toggle and dark mode support
  - Create ThemeProvider context with localStorage persistence
  - Create ThemeToggle component
  - Implement prefers-color-scheme detection
  - Add theme switching logic without page reload
  - Test theme persistence across sessions
  - _Requirements: 13.1, 13.2, 13.3_

- [x] 3. Authentication infrastructure
- [x] 3.1 Set up Cognito Hosted UI integration
  - Install AWS Amplify or Cognito SDK
  - Create Cognito configuration with environment variables (User Pool ID, Client ID, Domain, Redirect URIs)
  - Configure OAuth 2.0 settings (authorization code flow with PKCE)
  - Implement auth helper functions in lib/auth.ts (generateCodeVerifier, generateCodeChallenge, buildHostedUIUrl)
  - Create session management utilities (getSession, refreshSession, clearSession)
  - Implement JWT token parsing and validation
  - Set up HTTP-only cookie handling for token storage
  - _Requirements: 1.2, 1.8, 1.9, 12.1_

- [x] 3.2 Create OAuth callback handler
  - Create /auth/callback route to handle OAuth redirects
  - Implement authorization code exchange for tokens
  - Validate state parameter to prevent CSRF attacks
  - Store tokens in HTTP-only cookies
  - Extract and redirect to intended destination from state
  - Handle OAuth errors (access_denied, invalid_grant, etc.)
  - Create SessionExpiredModal component
  - _Requirements: 1.2, 1.8, 1.9_

- [x] 3.3 Implement AuthGuard and route protection
  - Create AuthGuard component with session verification
  - Implement loading spinner for auth status check
  - Add redirect logic to Cognito Hosted UI with state parameter preserving intended destination
  - Create route groups: (public) and (protected)
  - Implement middleware for server-side auth checks
  - Test redirect flows for authenticated and unauthenticated users
  - _Requirements: 1.1, 1.5, 1.9_

- [x] 3.4 Implement sign out functionality
  - Create sign out handler that clears cookies
  - Call Cognito logout endpoint to invalidate session
  - Redirect to Cognito Hosted UI or landing page after logout
  - Handle sign out errors gracefully
  - _Requirements: 1.4_

- [x] 3.5 Write authentication tests
  - Unit tests for auth helper functions (code verifier, code challenge, URL building)
  - Unit tests for state parameter validation
  - Integration tests for OAuth callback flow
  - E2E tests for authentication redirect to Hosted UI
  - E2E tests for OAuth callback and redirect to intended destination
  - Test session expiry and refresh logic
  - _Requirements: 15.4, 15.5_

- [x] 4. API client and data layer
- [x] 4.1 Create typed API client
  - Implement base API client in apps/web/lib/api.ts with fetch wrapper
  - Import types and schemas from @collectiq/shared
  - Add automatic credential inclusion (cookies)
  - Implement request/response interceptors
  - Add ProblemDetails error parsing using ProblemDetailsSchema from @collectiq/shared
  - Implement exponential backoff retry logic for GET requests
  - Add request ID tracking for traceability
  - _Requirements: 11.1, 11.2_

- [x] 4.2 Set up shared schemas
  - Ensure packages/shared is set up with Zod schemas (may already exist from backend setup)
  - Verify CardSchema, ValuationDataSchema, AuthenticityDetailsSchema, ProblemDetailsSchema are defined
  - Import schemas from @collectiq/shared in API client
  - Add schema validation to API client responses
  - Use TypeScript types exported from schemas (Card, ValuationData, etc.)
  - _Requirements: 11.1_

- [x] 4.3 Implement API endpoints
  - Implement getPresignedUrl() for S3 upload in apps/web/lib/api.ts
  - Implement createCard() for card creation using Card type from @collectiq/shared
  - Implement getCards() with pagination support
  - Implement getCard() for single card retrieval
  - Implement deleteCard() for card deletion
  - Implement refreshValuation() for valuation updates
  - Use TypeScript types from @collectiq/shared for all request/response payloads
  - Validate all responses with Zod schemas from @collectiq/shared
  - _Requirements: 2.4, 5.8, 6.9, 7.6_

- [x] 4.4 Set up SWR for data fetching
  - Configure SWR with global settings
  - Create custom hooks for common queries (useCards, useCard)
  - Implement cache key strategy (user-scoped)
  - Add optimistic UI updates for mutations
  - Implement cache invalidation on mutations
  - _Requirements: 6.9_

- [x] 4.5 Write API client tests
  - Unit tests for API client methods in apps/web/lib/api.ts
  - Test error handling and ProblemDetails parsing using schemas from @collectiq/shared
  - Test retry logic with exponential backoff
  - Test Zod schema validation with schemas from @collectiq/shared
  - Mock API responses for integration tests
  - _Requirements: 15.1_

- [x] 5. Upload flow implementation
- [x] 5.1 Create UploadDropzone component
  - Create component in apps/web/components/upload/UploadDropzone.tsx
  - Implement drag-and-drop area with visual feedback
  - Add file picker integration
  - Implement file type validation (JPG, PNG, HEIC)
  - Implement file size validation (≤ 12 MB)
  - Add hover and active states
  - Display inline error messages for validation failures
  - Create mobile-optimized version with tap-to-upload
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5.2 Create CameraCapture component
  - Create component in apps/web/components/upload/CameraCapture.tsx
  - Implement getUserMedia API integration
  - Add camera permission request handling
  - Create permission helper dialog
  - Implement photo capture functionality
  - Add orientation handling for mobile devices
  - Ensure iOS Safari compatibility
  - Add camera preview with capture button
  - _Requirements: 2.6, 2.7_

- [x] 5.3 Create UploadProgress component
  - Create component in apps/web/components/upload/UploadProgress.tsx
  - Implement progress bar with percentage display
  - Add thumbnail preview of uploading image
  - Create cancel button with abort functionality
  - Add loading states and animations
  - Implement error state display
  - _Requirements: 2.8, 2.9_

- [x] 5.4 Implement upload workflow
  - Create apps/web/app/(protected)/upload/page.tsx with UploadDropzone
  - Implement presigned URL request flow using API client
  - Add direct S3 upload with progress tracking
  - Create object URLs for image previews
  - Implement cleanup on unmount (revoke object URLs)
  - Add automatic redirect to identification screen on success
  - Handle upload errors with retry option
  - _Requirements: 2.4, 2.5, 2.8, 2.9, 2.10_

- [x] 5.5 Create first-run empty state
  - Design hero layout for empty vault
  - Add "Let's scan your first card" headline
  - Create CTAs for camera and file upload
  - Add illustrative graphics
  - _Requirements: 2.10_

- [ ]\* 5.6 Write upload flow tests
  - Unit tests for file validation logic
  - Integration test for presign → upload → redirect flow
  - E2E test for complete upload workflow
  - Test camera capture on mobile devices
  - Test error handling and retry logic
  - _Requirements: 15.2, 15.5_

- [x] 6. Card identification interface
- [x] 6.1 Create CandidateList component
  - Design card list layout with top-k results
  - Display card name, set, rarity for each candidate
  - Implement confidence bar visualization
  - Add card thumbnail images
  - Create selection interaction (click/tap)
  - Add loading skeleton state
  - _Requirements: 3.2, 3.3_

- [x] 6.2 Create identification page
  - Create /identify route (or modal)
  - Integrate CandidateList component
  - Add loading state while backend processes image
  - Implement candidate selection handler
  - Add manual confirmation option for low confidence
  - Create error state for no candidates found
  - Add retry and manual entry options
  - _Requirements: 3.1, 3.4, 3.5, 3.6_

- [ ]\* 6.3 Write identification tests
  - Unit tests for CandidateList component
  - Integration test for identification flow
  - Test low confidence scenarios
  - Test error states
  - _Requirements: 15.1_

- [x] 7. Authenticity analysis interface
- [x] 7.1 Create AuthenticityBadge component
  - Design rounded pill badge with score display
  - Implement color coding based on score (green > 0.8, yellow 0.5-0.8, red < 0.5)
  - Create tooltip with detailed breakdown
  - Display visual hash, text match, and holo pattern scores
  - Add warning indicator for low scores
  - Ensure accessibility (not relying solely on color)
  - _Requirements: 4.2, 4.3, 4.5, 4.7_

- [x] 7.2 Create authenticity analysis page/section
  - Design split-view layout (image + metrics)
  - Display card image with zoom capability
  - Integrate AuthenticityBadge component
  - Create visual fingerprint graph
  - Create text validation results display
  - Create holographic signal analysis visualization
  - Add rationale text from AI analysis
  - _Requirements: 4.1, 4.4_

- [x] 7.3 Implement feedback reporting
  - Create "Report Incorrect Result" button
  - Design feedback modal with reason selection
  - Implement feedback submission to backend
  - Add confirmation toast on successful submission
  - _Requirements: 4.6_

- [ ]\* 7.4 Write authenticity tests
  - Unit tests for AuthenticityBadge component
  - Test score color coding logic
  - Test tooltip display
  - Test accessibility compliance
  - _Requirements: 15.1, 15.8_

- [x] 8. Valuation interface
- [x] 8.1 Create ValuationPanel component
  - Design panel layout with price range display
  - Implement low/median/high price visualization
  - Create trend indicator with arrow and percentage
  - Add data source logos (eBay, TCGPlayer, PriceCharting)
  - Display confidence score with visual indicator
  - Show comparable sales count and time window
  - Add last updated timestamp
  - Create "Save to Vault" CTA button
  - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [x] 8.2 Implement valuation refresh functionality
  - Add refresh button to ValuationPanel
  - Implement loading state during refresh
  - Update display with new valuation data
  - Handle errors with retry option
  - Show toast notification on successful refresh
  - _Requirements: 5.8_

- [x] 8.3 Handle unavailable valuation data
  - Display last cached valuation with timestamp
  - Add "Data unavailable" indicator
  - Provide explanation and retry option
  - _Requirements: 5.6_

- [x] 8.4 Create valuation workflow page
  - Integrate authenticity and valuation sections
  - Create progressive disclosure flow
  - Add navigation between sections
  - Implement "Save to Vault" action
  - Add success confirmation and redirect to vault
  - _Requirements: 5.7_

- [ ]\* 8.5 Write valuation tests
  - Unit tests for ValuationPanel component
  - Test price range display
  - Test trend calculations
  - Test refresh functionality
  - Test cached data display
  - _Requirements: 15.1_

- [x] 9. Vault and portfolio management
- [x] 9.1 Create VaultGrid component
  - Implement responsive grid layout (1-4 columns based on screen size)
  - Create card thumbnail component with image and value
  - Add hover/long-press quick actions (refresh, delete)
  - Implement card click navigation to detail view
  - Add loading skeleton for initial load
  - Implement virtualization for collections > 200 items
  - _Requirements: 6.1, 6.6, 6.7, 6.8, 6.9_

- [x] 9.2 Create PortfolioSummary component
  - Design summary card layout
  - Display total collection value
  - Display total card count
  - Show 14-day value change with percentage
  - Create sparkline chart for performance visualization
  - Add loading state
  - _Requirements: 6.2_

- [x] 9.3 Create VaultFilters component
  - Implement filter UI for set, type, rarity, authenticity
  - Create sort dropdown (value, date added, rarity)
  - Add filter chips showing active filters
  - Implement clear all filters action
  - Persist filter state in URL query parameters
  - _Requirements: 6.4, 6.5_

- [x] 9.4 Implement vault page
  - Create /vault route
  - Integrate PortfolioSummary at top
  - Add VaultFilters component
  - Integrate VaultGrid component
  - Implement pagination with cursor-based loading
  - Add "Load More" button or infinite scroll
  - Create empty vault state with upload CTA
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 9.5 Implement card deletion
  - Add delete confirmation dialog
  - Implement optimistic UI update
  - Call deleteCard API endpoint
  - Handle errors with rollback
  - Show success toast notification
  - Update portfolio summary after deletion
  - _Requirements: 6.7_

- [ ]\* 9.6 Write vault tests
  - Unit tests for VaultGrid component
  - Unit tests for PortfolioSummary component
  - Unit tests for VaultFilters component
  - Integration test for filtering and sorting
  - Integration test for pagination
  - E2E test for vault navigation
  - Test virtualization performance
  - _Requirements: 15.1, 15.2, 15.6_

- [x] 10. Card detail view
- [x] 10.1 Create CardDetail component
  - Design detail page layout
  - Implement large card image with zoom functionality
  - Display card metadata (name, set, rarity, condition)
  - Integrate AuthenticityBadge with full breakdown
  - Add action buttons (Re-evaluate, Delete, Share)
  - _Requirements: 7.1, 7.2, 7.3, 7.6_

- [x] 10.2 Create valuation history chart
  - Lazy-load Recharts library
  - Create line chart component for valuation history
  - Display low/median/high price bands over time
  - Add interactive tooltips on hover
  - Implement responsive chart sizing (min 320px height)
  - Add loading skeleton while chart loads
  - Include aria-descriptions for accessibility
  - _Requirements: 7.4, 10.5, 10.6, 10.7, 10.8, 10.9_

- [x] 10.3 Create market data sources table
  - Display recent comparable sales
  - Show source, date, price, condition for each comp
  - Add sorting by date or price
  - Implement responsive table (cards on mobile)
  - _Requirements: 7.5_

- [x] 10.4 Implement card detail page
  - Create /cards/[id] route
  - Fetch card data with SWR
  - Integrate CardDetail component
  - Integrate valuation history chart
  - Integrate market data sources table
  - Add loading state
  - Handle 404 (card not found) error
  - Handle 403 (not owner) error
  - _Requirements: 7.1, 7.8, 7.9_

- [x] 10.5 Implement card actions
  - Implement re-evaluate action (refresh valuation)
  - Implement delete action with confirmation
  - Implement share action (copy link or native share)
  - Add loading states for actions
  - Show success/error notifications
  - _Requirements: 7.6_

- [ ]\* 10.6 Write card detail tests
  - Unit tests for CardDetail component
  - Unit tests for valuation history chart
  - Integration test for card detail page
  - Test error states (404, 403)
  - E2E test for card detail navigation
  - Test chart lazy loading
  - _Requirements: 15.1, 15.6_

- [x] 11. Error handling and user feedback
- [x] 11.1 Create ProblemDetails error handler
  - Create error handler in apps/web/lib/errors.ts
  - Use ProblemDetails type and schema from @collectiq/shared
  - Implement error parsing utility
  - Create error mapping for common status codes
  - Generate user-friendly messages with remediation
  - Add requestId tracking
  - _Requirements: 11.1, 11.2, 11.9_

- [x] 11.2 Create ErrorAlert component
  - Design alert component with icon and message
  - Add retry button when applicable
  - Add dismiss button
  - Implement different severity levels (error, warning, info)
  - _Requirements: 11.2, 11.9_

- [x] 11.3 Implement error states for all flows
  - Add 401 redirect to Cognito Hosted UI
  - Add 403 forbidden message
  - Add 404 not found message
  - Add 413 image too large error
  - Add 415 unsupported media error
  - Add 429 rate limit dialog with countdown
  - Add 5xx server error with retry
  - _Requirements: 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

- [x] 11.4 Implement toast notifications
  - Create toast system using shadcn/ui Toast
  - Add success toasts for actions (card saved, deleted, etc.)
  - Add error toasts for failures
  - Implement toast queue and auto-dismiss
  - _Requirements: 11.10_

- [ ]\* 11.5 Write error handling tests
  - Unit tests for error parsing
  - Unit tests for error mapping
  - Integration tests for each error scenario
  - E2E tests for error flows
  - _Requirements: 15.1, 15.2_

- [x] 12. Responsive design and mobile optimization
- [x] 12.1 Implement responsive layouts
  - Create mobile-first CSS with Tailwind breakpoints
  - Implement single-column layouts for mobile
  - Add responsive grid columns (1-4 based on screen)
  - Ensure touch targets are at least 44x44 pixels
  - Test on various screen sizes (320px to 1920px)
  - _Requirements: 8.1, 8.5_

- [x] 12.2 Optimize mobile upload experience
  - Integrate native camera on mobile devices
  - Implement file picker for mobile
  - Add image compression for large files on mobile
  - Test on iOS Safari and Android Chrome
  - _Requirements: 8.2_

- [x] 12.3 Implement mobile-specific UI patterns
  - Use bottom sheets for filters and modals
  - Implement swipe gestures where appropriate
  - Add pull-to-refresh for vault
  - Ensure safe-area padding for iOS notch
  - Handle orientation changes gracefully
  - _Requirements: 8.3, 8.6, 8.7_

- [ ]\* 12.4 Test responsive design
  - Manual testing on physical devices
  - Browser DevTools responsive testing
  - E2E tests on mobile viewports
  - Test landscape and portrait orientations
  - _Requirements: 15.6_

- [x] 13. Accessibility implementation
- [x] 13.1 Implement keyboard navigation
  - Ensure all interactive elements are keyboard accessible
  - Add visible focus indicators (2px Holo Cyan ring)
  - Implement roving tabindex for card grids
  - Add skip links to main content
  - Test tab order on all pages
  - _Requirements: 9.1, 9.2, 9.9_

- [x] 13.2 Implement ARIA attributes
  - Add aria-live regions for async status updates
  - Add aria-labels for icon buttons
  - Add aria-descriptions for complex widgets
  - Implement focus trap in modals
  - Add aria-expanded for collapsible sections
  - _Requirements: 9.3, 9.4_

- [x] 13.3 Ensure semantic HTML
  - Use semantic elements (nav, main, article, section)
  - Proper heading hierarchy (h1-h6)
  - Use button elements for actions (not divs)
  - Use form elements with labels
  - _Requirements: 9.8_

- [x] 13.4 Implement color accessibility
  - Ensure all color combinations meet WCAG AA contrast (4.5:1)
  - Never rely solely on color to convey information
  - Add patterns or icons alongside color coding
  - Test with color blindness simulators
  - _Requirements: 9.6_

- [x] 13.5 Implement motion accessibility
  - Respect prefers-reduced-motion media query
  - Disable animations when reduced motion is preferred
  - Use instant transitions instead of animations
  - Test with reduced motion enabled
  - _Requirements: 9.7_

- [x] 13.6 Add descriptive alt text
  - Write descriptive alt text for all card images
  - Use empty alt for decorative images
  - Provide context in alt text
  - _Requirements: 9.5_

- [ ]\* 13.7 Run accessibility audits
  - Run axe-core automated tests
  - Manual keyboard navigation testing
  - Screen reader testing (VoiceOver, NVDA)
  - Generate accessibility report
  - Fix all critical and serious issues
  - _Requirements: 15.8_

- [x] 14. Performance optimization
- [x] 14.1 Implement code splitting
  - Configure route-based code splitting (automatic with Next.js)
  - Lazy load Recharts library
  - Dynamic import for CameraCapture component
  - Dynamic import for heavy modals
  - Analyze bundle size with @next/bundle-analyzer
  - _Requirements: 10.4, 10.5_

- [x] 14.2 Optimize images
  - Use Next.js Image component for all images
  - Add blur placeholders for smooth loading
  - Implement responsive images with srcset
  - Use WebP format with fallbacks
  - Constrain aspect ratios to prevent layout shift
  - _Requirements: 10.6_

- [x] 14.3 Implement caching strategies
  - Configure SWR with appropriate revalidation settings
  - Implement stale-while-revalidate for vault lists
  - Add cache invalidation on mutations
  - Use HTTP cache headers
  - _Requirements: 10.7_

- [x] 14.4 Optimize animations
  - Use CSS transforms and opacity for animations
  - Avoid expensive reflows (layout thrashing)
  - Add will-change sparingly
  - Target 60fps for all animations
  - Throttle heavy JavaScript operations
  - _Requirements: 10.8_

- [x] 14.5 Implement virtualization
  - Add virtualization for vault grid when > 200 items
  - Use react-window or similar library
  - Implement dynamic row heights
  - Test scroll performance
  - _Requirements: 6.8_

- [ ]\* 14.6 Run performance audits
  - Run Lighthouse CI on all pages
  - Verify LCP < 2.5s on mobile
  - Verify CLS < 0.1
  - Verify INP < 200ms
  - Generate performance report
  - Fix performance issues blocking thresholds
  - _Requirements: 10.1, 10.2, 10.3, 15.10_

- [ ] 15. Security hardening
- [x] 15.1 Implement secure authentication
  - Store JWT in HTTP-only, Secure, SameSite=Lax cookies
  - Never store tokens in localStorage
  - Implement automatic token refresh
  - Clear all cookies on logout
  - _Requirements: 12.1_

- [x] 15.2 Configure Content Security Policy
  - Set strict CSP headers in next.config.mjs or middleware
  - Disallow inline scripts
  - Whitelist trusted domains (API, Cognito, S3, CloudFront)
  - Set frame-ancestors to 'none'
  - _Requirements: 12.2_

- [x] 15.3 Implement security headers
  - Add Referrer-Policy: strict-origin-when-cross-origin in next.config.mjs
  - Add X-Frame-Options: DENY
  - Add X-Content-Type-Options: nosniff
  - Add Permissions-Policy
  - _Requirements: 12.3_

- [x] 15.4 Implement input validation
  - Use Zod schemas from @collectiq/shared for client-side validation
  - Validate file types and sizes before upload
  - Sanitize user input in forms
  - Prevent XSS attacks
  - _Requirements: 12.5_

- [x] 15.5 Implement privacy protections
  - Never log PII in analytics or errors
  - Respect Do Not Track (DNT) header
  - Implement GDPR-compliant data handling
  - Add privacy policy link
  - _Requirements: 12.6, 14.9, 14.10_

- [ ]\* 15.6 Run security audit
  - Check for common vulnerabilities (OWASP Top 10)
  - Verify CSP is working correctly
  - Test authentication flows for security issues
  - Verify no tokens in client-side storage
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

- [x] 16. Analytics and telemetry
- [x] 16.1 Implement event tracking
  - Create analytics utility in apps/web/lib/analytics.ts
  - Consider using telemetry utilities from packages/telemetry if applicable
  - Implement upload_started event
  - Implement upload_succeeded event
  - Implement analyze_started event
  - Implement analyze_succeeded event
  - Implement card_saved event
  - Implement valuation_refreshed event
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 16.2 Implement privacy-safe logging
  - Never include PII in events
  - Include requestId for traceability
  - Add event timestamp
  - Implement event batching
  - _Requirements: 14.7, 14.8_

- [x] 16.3 Implement feature flags
  - Create feature flag system
  - Add flags for pricing, authenticity, charts
  - Guard risky features behind flags
  - Implement environment-based flag configuration
  - _Requirements: 14.9_

- [ ]\* 16.4 Test analytics implementation
  - Verify events are fired correctly
  - Test DNT respect
  - Verify no PII in logs
  - Test feature flag toggling
  - _Requirements: 14.9, 14.10_

- [ ] 17. Testing and quality assurance
- [ ]\* 17.1 Write unit tests
  - Test utility functions (formatters, validators) in apps/web/lib
  - Test Zod schema parsing using schemas from @collectiq/shared
  - Test API client methods
  - Test component logic and hooks
  - Test auth guards
  - Achieve > 80% code coverage
  - _Requirements: 15.1_

- [ ]\* 17.2 Write integration tests
  - Test upload flow end-to-end
  - Test vault pagination and filtering
  - Test error state handling
  - Test optimistic UI updates
  - _Requirements: 15.2_

- [ ]\* 17.3 Write E2E tests
  - Test auth redirect for unauthenticated users
  - Test happy path: upload → identify → valuation → save
  - Test session expiry modal
  - Test vault filtering and card detail navigation
  - Test on Safari and Chrome
  - _Requirements: 15.4, 15.5, 15.6, 15.7_

- [ ]\* 17.4 Run accessibility tests
  - Run axe-core automated checks
  - Manual keyboard navigation testing
  - Screen reader testing
  - Generate accessibility report
  - _Requirements: 15.8, 15.9_

- [ ]\* 17.5 Run performance tests
  - Run Lighthouse CI
  - Verify Core Web Vitals thresholds
  - Test on slow 3G network
  - Generate performance report
  - _Requirements: 15.10_

- [ ] 18. Documentation and deployment
- [x] 18.1 Write developer documentation
  - Create comprehensive README with setup instructions
  - Document environment variables
  - Document common development scripts
  - Create architecture decision records (ADRs)
  - Document component API contracts
  - _Requirements: All_

- [x] 18.2 Configure CI/CD pipeline
  - Set up GitHub Actions workflow
  - Add lint and typecheck steps
  - Add test execution step
  - Add build step
  - Configure preview deployments for PRs
  - _Requirements: All_

- [ ] 18.3 Configure production deployment
  - Set up AWS Amplify or Vercel hosting
  - Configure environment variables in deployment platform
  - Set up custom domain with SSL
  - Configure CDN distribution
  - Set up error tracking (Sentry or CloudWatch)
  - _Requirements: All_

- [ ] 18.4 Create demo and user documentation
  - Create demo script for judges/users
  - Record demo video
  - Write user guide
  - Create FAQ document
  - _Requirements: All_

- [ ] 18.5 Final QA and launch preparation
  - Complete end-to-end testing on staging
  - Verify all features work as expected
  - Test on multiple devices and browsers
  - Verify performance and accessibility
  - Create launch checklist
  - _Requirements: All_
