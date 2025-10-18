# Requirements Document

## Introduction

CollectIQ is an AI-powered collector assistant that enables users to identify, authenticate, and valuate Pokémon Trading Card Game (TCG) cards in real-time through a modern web application. The frontend provides an authentication-first, real-time experience that integrates with AWS-powered backend services including Cognito for authentication, Rekognition for image analysis, and Bedrock for AI-driven valuation and authenticity detection.

The frontend must deliver a seamless, accessible, and performant user experience across desktop and mobile devices, with support for camera capture, drag-and-drop uploads, real-time pricing visualization, and secure vault management. The application follows a progressive workflow: authenticate → upload → identify → authenticate card → valuate → save to vault → manage collection.

This specification defines the functional and non-functional requirements for the CollectIQ web application frontend, built with Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui components.

## Requirements

### Requirement 1: User Authentication & Authorization

**User Story:** As a collector, I want to securely sign in to my account so that I can access my personal card vault and ensure my collection data is protected.

#### Acceptance Criteria

1. WHEN a user visits the application without authentication THEN the system SHALL redirect them to Amazon Cognito's Hosted UI
2. WHEN a user successfully authenticates via Amazon Cognito Hosted UI THEN the system SHALL receive authorization code and exchange it for JWT tokens stored in secure HTTP-only cookies
3. WHEN a user's session expires THEN the system SHALL display a session-expired modal with re-authentication option that redirects to Hosted UI
4. WHEN a user signs out THEN the system SHALL clear the session cookies, call Cognito logout endpoint, and redirect to Hosted UI
5. IF a user attempts to access a protected route (/upload, /vault, /cards/:id) without authentication THEN the system SHALL redirect to Cognito Hosted UI with a state parameter preserving the intended destination
6. WHEN a user completes email verification via Cognito Hosted UI THEN the system SHALL allow full access to the application
7. WHEN a user requests password reset THEN the system SHALL use Cognito Hosted UI's built-in password reset flow
8. WHEN a user signs up via Cognito Hosted UI THEN the system SHALL handle the OAuth callback and create the user session
9. WHEN the OAuth callback is received THEN the system SHALL validate the state parameter to prevent CSRF attacks

### Requirement 2: Card Upload & Image Capture

**User Story:** As a collector, I want to upload photos of my trading cards from my device or camera so that the system can identify and valuate them.

#### Acceptance Criteria

1. WHEN a user accesses the upload interface THEN the system SHALL provide both drag-and-drop and file picker options
2. WHEN a user uploads an image THEN the system SHALL validate the file type (JPG, PNG, HEIC) and size (≤ 12 MB)
3. IF a file fails validation THEN the system SHALL display an inline error message with specific remediation guidance
4. WHEN a user uploads a valid image THEN the system SHALL request a presigned S3 URL from POST /upload/presign endpoint
5. WHEN the presigned URL is received THEN the system SHALL upload the file directly to S3 with a progress indicator
6. WHEN a user is on a mobile device THEN the system SHALL provide a camera capture option using getUserMedia API
7. WHEN camera permission is requested THEN the system SHALL display a permission helper dialog
8. WHEN an upload is in progress THEN the system SHALL display a progress bar and thumbnail preview
9. WHEN a user cancels an upload THEN the system SHALL abort the request and clean up temporary resources
10. WHEN an upload completes successfully THEN the system SHALL create a card record via POST /cards with the S3 key and trigger Step Functions workflow for analysis

### Requirement 3: Card Analysis & Processing

**User Story:** As a collector, I want the system to automatically analyze my card after upload so that I can see valuation and authenticity results.

#### Acceptance Criteria

1. WHEN a card is created via POST /cards THEN the system SHALL trigger a Step Functions workflow for automated analysis
2. WHEN the workflow is running THEN the system SHALL display a processing screen with status updates
3. WHEN the workflow completes THEN the system SHALL update the card record with analysis results (authenticity score, valuation data)
4. WHEN displaying the processing screen THEN the system SHALL show progress indicators for: feature extraction, authenticity analysis, and valuation
5. WHEN analysis completes THEN the system SHALL redirect to the card detail view showing full results
6. IF analysis fails THEN the system SHALL display an error state with retry option via POST /cards/{id}/revalue
7. WHEN a user navigates away during processing THEN the system SHALL allow them to return and check status via GET /cards/{id}

### Requirement 4: Authenticity Analysis & Verification

**User Story:** As a collector, I want to verify the authenticity of my cards so that I can identify potential counterfeits and protect my investment.

#### Acceptance Criteria

1. WHEN a card is identified THEN the system SHALL display an authenticity analysis screen with visual and metric breakdowns
2. WHEN displaying authenticity results THEN the system SHALL show an AuthenticityBadge with a score from 0.0 to 1.0
3. WHEN a user hovers over the authenticity badge THEN the system SHALL display a tooltip with detailed breakdown (text match, border ratio, holographic pattern scores)
4. WHEN authenticity analysis is complete THEN the system SHALL display visual fingerprint graphs, text validation results, and holographic signal analysis
5. IF a card is flagged as potentially fake (score < 0.5) THEN the system SHALL display a warning indicator with explanation
6. WHEN authenticity results are displayed THEN the system SHALL provide an option to report incorrect results for feedback
7. WHEN displaying authenticity metrics THEN the system SHALL use accessible color coding that doesn't rely solely on color to convey meaning

### Requirement 5: Real-Time Valuation & Market Data

**User Story:** As a collector, I want to see real-time market valuations for my cards so that I can make informed decisions about buying, selling, or holding.

#### Acceptance Criteria

1. WHEN a card analysis completes THEN the system SHALL display valuation data from the Card object (valueLow, valueMedian, valueHigh)
2. WHEN displaying valuation THEN the system SHALL show low, median, and high price estimates from the card record
3. WHEN displaying valuation THEN the system SHALL show data sources from the card.sources array (eBay, TCGPlayer, PriceCharting)
4. WHEN displaying valuation THEN the system SHALL show comparable sales count from card.compsCount
5. WHEN displaying valuation THEN the system SHALL calculate trend indicators based on historical data (future enhancement)
6. WHEN a user requests valuation refresh THEN the system SHALL call POST /cards/{id}/revalue with forceRefresh=true
7. WHEN revaluation is triggered THEN the system SHALL display a 202 Accepted response with executionArn and status
8. WHEN revaluation is in progress THEN the system SHALL poll GET /cards/{id} to check for updated valuation data

### Requirement 6: Vault Management & Portfolio View

**User Story:** As a collector, I want to view and manage all my cards in a secure vault so that I can track my collection's value and organization.

#### Acceptance Criteria

1. WHEN a user navigates to /vault THEN the system SHALL call GET /cards to fetch the user's card collection
2. WHEN displaying the vault THEN the system SHALL show a portfolio summary card with total value calculated from card.valueMedian, card count, and 14-day performance sparkline (calculated client-side)
3. WHEN the vault is empty THEN the system SHALL display an empty state with "Upload Card" call-to-action
4. WHEN a user applies filters THEN the system SHALL filter cards client-side by set, rarity, or authenticityScore
5. WHEN a user applies sorting THEN the system SHALL sort cards client-side by valueMedian, createdAt, or rarity
6. WHEN a user clicks a card THEN the system SHALL navigate to /cards/{cardId} detail view
7. WHEN displaying vault cards THEN the system SHALL show quick actions for refresh valuation (POST /cards/{id}/revalue) and delete (DELETE /cards/{id})
8. WHEN pagination is needed THEN the system SHALL use cursor-based pagination with nextCursor from GET /cards response
9. WHEN vault data is loading THEN the system SHALL display skeleton placeholders

### Requirement 7: Card Detail View & Historical Data

**User Story:** As a collector, I want to view detailed information about a specific card including historical valuation trends so that I can understand its market performance over time.

#### Acceptance Criteria

1. WHEN a user navigates to /cards/{id} THEN the system SHALL call GET /cards/{id} to fetch card details
2. WHEN displaying card details THEN the system SHALL show card image from S3 using card.frontS3Key (with presigned URL if needed)
3. WHEN displaying card details THEN the system SHALL show authenticityScore and authenticitySignals breakdown
4. WHEN displaying card details THEN the system SHALL show current valuation (valueLow, valueMedian, valueHigh, compsCount, sources)
5. WHEN displaying card details THEN the system SHALL show card metadata (name, set, number, rarity, conditionEstimate)
6. WHEN displaying card details THEN the system SHALL provide actions: Re-evaluate (POST /cards/{id}/revalue), Delete (DELETE /cards/{id}), and Share
7. IF GET /cards/{id} returns 404 THEN the system SHALL display a "Card not found" error state
8. IF GET /cards/{id} returns 403 THEN the system SHALL display a "You don't own this card" error state
9. WHEN historical valuation data is available (future enhancement) THEN the system SHALL display a valuation history chart using Recharts

### Requirement 8: Responsive Design & Mobile Experience

**User Story:** As a collector using a mobile device, I want the application to work seamlessly on my phone so that I can scan cards on-the-go.

#### Acceptance Criteria

1. WHEN a user accesses the application on mobile THEN the system SHALL display a single-column layout optimized for touch
2. WHEN a user accesses the upload screen on mobile THEN the system SHALL provide native camera integration
3. WHEN displaying modals on mobile THEN the system SHALL use bottom sheets for filters and details
4. WHEN displaying the vault on mobile THEN the system SHALL use a responsive grid that adapts to screen size
5. WHEN a user interacts with buttons on mobile THEN the system SHALL provide touch targets of at least 44x44 pixels
6. WHEN displaying content on mobile THEN the system SHALL respect safe-area padding for iOS and Android devices
7. WHEN a user rotates their device THEN the system SHALL handle orientation changes gracefully

### Requirement 9: Accessibility & Keyboard Navigation

**User Story:** As a user with accessibility needs, I want the application to be fully navigable via keyboard and screen reader so that I can use all features independently.

#### Acceptance Criteria

1. WHEN a user navigates via keyboard THEN the system SHALL provide visible focus indicators on all interactive elements
2. WHEN a user opens a dialog or modal THEN the system SHALL trap focus within the modal
3. WHEN a user navigates card grids via keyboard THEN the system SHALL implement roving tabindex for efficient navigation
4. WHEN async operations occur THEN the system SHALL use aria-live regions to announce status changes
5. WHEN displaying images THEN the system SHALL provide descriptive alt text
6. WHEN using color to convey information THEN the system SHALL provide additional non-color indicators
7. WHEN a user enables reduced motion preferences THEN the system SHALL respect prefers-reduced-motion and disable animations
8. WHEN displaying interactive elements THEN the system SHALL use semantic HTML elements
9. WHEN a page loads THEN the system SHALL provide skip links to main content

### Requirement 10: Performance & Core Web Vitals

**User Story:** As a user, I want the application to load quickly and respond smoothly so that I have a fast and enjoyable experience.

#### Acceptance Criteria

1. WHEN a user loads any page THEN the system SHALL achieve Largest Contentful Paint (LCP) < 2.5 seconds on mobile
2. WHEN a user interacts with the page THEN the system SHALL maintain Cumulative Layout Shift (CLS) < 0.1
3. WHEN a user interacts with elements THEN the system SHALL achieve Interaction to Next Paint (INP) < 200ms
4. WHEN loading routes THEN the system SHALL implement code-splitting for optimal bundle sizes
5. WHEN loading charts THEN the system SHALL lazy-load the Recharts library
6. WHEN loading images THEN the system SHALL use Next.js Image component with blur placeholders
7. WHEN rendering lists THEN the system SHALL memoize expensive computations
8. WHEN animating elements THEN the system SHALL prefer CSS transforms and opacity for 60fps performance
9. WHEN making API requests THEN the system SHALL implement preconnect hints for the API domain

### Requirement 11: Error Handling & User Feedback

**User Story:** As a user, I want clear error messages and guidance when something goes wrong so that I can resolve issues and continue using the application.

#### Acceptance Criteria

1. WHEN an API error occurs THEN the system SHALL parse RFC 7807 ProblemDetails format
2. WHEN displaying errors THEN the system SHALL show user-friendly messages with specific remediation guidance
3. WHEN a 401 error occurs THEN the system SHALL redirect to Cognito Hosted UI
4. WHEN a 403 error occurs THEN the system SHALL display "You don't have access to this resource"
5. WHEN a 413 error occurs THEN the system SHALL display "Image too large. Please upload a file under 12 MB"
6. WHEN a 415 error occurs THEN the system SHALL display "Unsupported file type. Please use JPG, PNG, or HEIC"
7. WHEN a 429 error occurs THEN the system SHALL display a rate limit dialog with countdown timer
8. WHEN a 5xx error occurs THEN the system SHALL display a retry button with exponential backoff
9. WHEN an OAuth error occurs (access_denied, invalid_grant) THEN the system SHALL display a user-friendly error message with option to retry authentication
10. WHEN an error is displayed THEN the system SHALL always provide an actionable next step
11. WHEN operations succeed THEN the system SHALL display toast notifications confirming the action

### Requirement 12: Security & Data Protection

**User Story:** As a user, I want my data and session to be secure so that my collection information remains private and protected.

#### Acceptance Criteria

1. WHEN a user authenticates THEN the system SHALL store JWT tokens in secure, HTTP-only, SameSite=Lax cookies
2. WHEN the application loads THEN the system SHALL enforce a strict Content Security Policy (CSP) with no inline scripts
3. WHEN making requests THEN the system SHALL include Referrer-Policy: strict-origin-when-cross-origin header
4. WHEN embedding content THEN the system SHALL set X-Frame-Options: DENY to prevent clickjacking
5. WHEN validating input THEN the system SHALL mirror backend Zod schemas for client-side validation
6. WHEN handling user data THEN the system SHALL never log personally identifiable information (PII)
7. WHEN uploading files THEN the system SHALL validate file types and sizes before requesting presigned URLs
8. WHEN storing data THEN the system SHALL never persist tokens in localStorage or sessionStorage

### Requirement 13: Theme Support & Visual Design

**User Story:** As a user, I want to choose between light and dark themes so that I can use the application comfortably in different lighting conditions.

#### Acceptance Criteria

1. WHEN a user first visits the application THEN the system SHALL respect the prefers-color-scheme media query
2. WHEN a user toggles the theme THEN the system SHALL persist the preference in localStorage
3. WHEN the theme changes THEN the system SHALL apply the new theme using CSS variables without page reload
4. WHEN displaying UI elements THEN the system SHALL use the CollectIQ design system colors (Vault Blue #1A73E8, Holo Cyan #00C6FF, Carbon Gray #1E1E1E)
5. WHEN displaying text THEN the system SHALL use Inter for UI elements and Space Grotesk for headings
6. WHEN displaying components THEN the system SHALL use 12-16px border radius for cards and 8-12px for buttons
7. WHEN animating elements THEN the system SHALL use 200-250ms transitions with ease-in-out easing
8. WHEN displaying focus states THEN the system SHALL use 2px solid Holo Cyan focus rings

### Requirement 14: Analytics & Telemetry

**User Story:** As a product owner, I want to track user interactions and performance metrics so that I can improve the application based on real usage data.

#### Acceptance Criteria

1. WHEN a user uploads a card THEN the system SHALL emit an upload_started event
2. WHEN an upload succeeds THEN the system SHALL emit an upload_succeeded event with duration
3. WHEN analysis begins THEN the system SHALL emit an analyze_started event
4. WHEN analysis completes THEN the system SHALL emit an analyze_succeeded event with confidence scores
5. WHEN a card is saved THEN the system SHALL emit a card_saved event
6. WHEN valuation is refreshed THEN the system SHALL emit a valuation_refreshed event
7. WHEN logging events THEN the system SHALL never include personally identifiable information (PII)
8. WHEN logging events THEN the system SHALL include requestId when available for traceability
9. WHEN analytics is disabled via environment variable THEN the system SHALL not emit any tracking events
10. WHEN Do Not Track (DNT) is enabled THEN the system SHALL respect the user's privacy preference

### Requirement 15: Testing & Quality Assurance

**User Story:** As a developer, I want comprehensive test coverage so that I can confidently deploy changes without breaking existing functionality.

#### Acceptance Criteria

1. WHEN unit tests run THEN the system SHALL test formatters, guards, API client, Zod parsers, and components with logic
2. WHEN integration tests run THEN the system SHALL test the complete upload flow from presign to finalization
3. WHEN integration tests run THEN the system SHALL test vault list pagination and error states
4. WHEN E2E tests run THEN the system SHALL test authentication redirect to Cognito Hosted UI
5. WHEN E2E tests run THEN the system SHALL test the happy path: upload → identify → valuation → save
6. WHEN E2E tests run THEN the system SHALL test session expiry modal behavior
7. WHEN E2E tests run THEN the system SHALL verify Safari browser compatibility
8. WHEN accessibility tests run THEN the system SHALL use axe-core to check for WCAG violations
9. WHEN accessibility tests run THEN the system SHALL verify keyboard navigation paths
10. WHEN performance tests run THEN the system SHALL verify Lighthouse CI thresholds are met
